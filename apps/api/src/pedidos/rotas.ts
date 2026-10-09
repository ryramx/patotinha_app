import type { FastifyInstance } from 'fastify';
import type { ListaPedidos } from '@patotinha/shared';
import {
  esquemaCancelamento,
  esquemaFiltroPedidos,
  esquemaNovoPedido,
  esquemaParamId,
} from '@patotinha/shared';
import { ErroApp, erros } from '../erros.js';
import { usuarioDa } from '../auth/plugin.js';
import { intervaloDeDias } from '../periodo.js';
import { dinheiro } from '../serializar.js';
import type { Prisma } from '../generated/prisma/client.js';
import { buscarPedidoCompleto, paraPedidoApi, paraPedidoResumidoApi } from './repositorio.js';
import { criarPedido } from './servico.js';

const naoEncontrado = () => erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado');

export async function rotasPedidos(app: FastifyInstance) {
  app.post('/pedidos', { preHandler: app.autenticar }, async (request, reply) => {
    const resultado = esquemaNovoPedido.safeParse(request.body);
    if (!resultado.success) {
      const issue = resultado.error.issues[0];
      if (issue?.path[0] === 'itens' && issue.path[2] === 'quantidade') {
        throw new ErroApp(422, 'QUANTIDADE_INVALIDA', issue.message, [
          { campo: issue.path.join('.') },
        ]);
      }
      throw resultado.error;
    }
    const usuario = usuarioDa(request);
    const { criado, pedido } = await criarPedido(app.banco, resultado.data, usuario.id);
    if (criado) {
      request.log.info(
        {
          evento: 'pedido_criado',
          pedidoId: Number(pedido.id),
          total: dinheiro(pedido.total),
          usuarioId: Number(usuario.id),
        },
        'pedido criado',
      );
    }
    return reply.status(criado ? 201 : 200).send(paraPedidoApi(pedido));
  });

  app.get('/pedidos', { preHandler: app.autenticar }, async (request): Promise<ListaPedidos> => {
    const resultado = esquemaFiltroPedidos.safeParse(request.query);
    if (!resultado.success) {
      throw new ErroApp(422, 'FILTRO_INVALIDO', 'Filtro inválido', resultado.error.issues);
    }
    const filtro = resultado.data;
    // Funcionário vê todos os pedidos, só leitura (D-19).
    let where: Prisma.PedidoWhereInput;
    if (filtro.numero) {
      // Nº do pedido busca só aquele pedido, ignorando os outros filtros.
      where = { id: BigInt(filtro.numero) };
    } else {
      const periodo = intervaloDeDias(filtro.de, filtro.ate, 'FILTRO_INVALIDO');
      where = {
        criadoEm: { gte: periodo.inicio, lt: periodo.fim },
        status: filtro.status,
        formaPagamento: filtro.formaPagamento ? { codigo: filtro.formaPagamento } : undefined,
        usuarioId: filtro.usuarioId ? BigInt(filtro.usuarioId) : undefined,
      };
    }
    const [dados, total, soma] = await Promise.all([
      app.banco.pedido.findMany({
        where,
        include: { usuario: true, formaPagamento: true },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        skip: (filtro.pagina - 1) * filtro.tamanho,
        take: filtro.tamanho,
      }),
      app.banco.pedido.count({ where }),
      app.banco.pedido.aggregate({
        where: { AND: [where, { status: 'FINALIZADO' }] },
        _sum: { total: true },
        _count: true,
      }),
    ]);
    return {
      dados: dados.map(paraPedidoResumidoApi),
      pagina: filtro.pagina,
      tamanho: filtro.tamanho,
      total,
      somaFinalizados: soma._sum.total ? dinheiro(soma._sum.total) : '0.00',
      quantidadeFinalizados: soma._count,
    };
  });

  app.get('/pedidos/:id', { preHandler: app.autenticar }, async (request) => {
    const { id } = esquemaParamId.parse(request.params);
    const pedido = await buscarPedidoCompleto(app.banco, BigInt(id));
    if (!pedido) throw naoEncontrado();
    return paraPedidoApi(pedido);
  });

  // Não existe endpoint para editar nem apagar pedido (RN-13).
  app.patch('/pedidos/:id/cancelar', { preHandler: app.exigirAdmin }, async (request) => {
    const { id } = esquemaParamId.parse(request.params);
    const corpo = esquemaCancelamento.safeParse(request.body);
    const usuario = usuarioDa(request);

    const pedido = await app.banco.$transaction(async (tx) => {
      const atual = await tx.pedido.findUnique({ where: { id: BigInt(id) } });
      if (!atual) throw naoEncontrado();
      if (atual.status === 'CANCELADO') {
        throw new ErroApp(409, 'PEDIDO_JA_CANCELADO', 'Este pedido já foi cancelado');
      }
      if (!corpo.success) {
        throw new ErroApp(
          422,
          'MOTIVO_OBRIGATORIO',
          corpo.error.issues[0]?.message ?? 'Informe o motivo',
        );
      }
      // Só muda status e dados do cancelamento; itens e valores ficam como estão (RN-14, RN-15).
      const alterados = await tx.pedido.updateMany({
        where: { id: atual.id, status: { not: 'CANCELADO' } },
        data: {
          status: 'CANCELADO',
          canceladoEm: new Date(),
          canceladoPorId: usuario.id,
          motivoCancelamento: corpo.data.motivo,
        },
      });
      if (alterados.count === 0) {
        throw new ErroApp(409, 'PEDIDO_JA_CANCELADO', 'Este pedido já foi cancelado');
      }
      return (await buscarPedidoCompleto(tx, atual.id))!;
    });

    request.log.info(
      { evento: 'pedido_cancelado', pedidoId: id, usuarioId: Number(usuario.id) },
      'pedido cancelado',
    );
    return paraPedidoApi(pedido);
  });
}
