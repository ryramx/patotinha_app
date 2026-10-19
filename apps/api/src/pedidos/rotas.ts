import type { FastifyInstance } from 'fastify';
import type { FilaPreparo, ListaPedidos, PedidoAReceber } from '@patotinha/shared';
import {
  esquemaCancelamento,
  esquemaFiltroPedidos,
  esquemaNovoPedido,
  esquemaPagamento,
  esquemaParamId,
  esquemaPreparo,
} from '@patotinha/shared';
import { ErroApp, erros } from '../erros.js';
import { pode, usuarioDa } from '../auth/plugin.js';
import { intervaloDeDias } from '../periodo.js';
import { dinheiro } from '../serializar.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  buscarPedidoCompleto,
  paraPedidoAReceberApi,
  paraPedidoApi,
  paraPedidoNaFilaApi,
  paraPedidoResumidoApi,
} from './repositorio.js';
import { criarPedido } from './servico.js';
import { calcularPagamento } from './calculo.js';
import { deCentavos, paraCentavos } from '@patotinha/shared';

const naoEncontrado = () => erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado');

export async function rotasPedidos(app: FastifyInstance) {
  app.post('/pedidos', { preHandler: app.exigir('PEDIDOS_REGISTRAR') }, async (request, reply) => {
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

  app.get(
    '/pedidos',
    { preHandler: app.exigir('PEDIDOS_VER') },
    async (request): Promise<ListaPedidos> => {
      const resultado = esquemaFiltroPedidos.safeParse(request.query);
      if (!resultado.success) {
        throw new ErroApp(422, 'FILTRO_INVALIDO', 'Filtro inválido', resultado.error.issues);
      }
      const filtro = resultado.data;
      // Quem tem "Ver pedidos" vê todos os pedidos, só leitura (D-19).
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
          clienteNome: filtro.cliente
            ? { contains: filtro.cliente, mode: 'insensitive' }
            : undefined,
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
        // A soma em reais é dado financeiro: só para quem tem essa permissão.
        ...(pode(request.usuario, 'FINANCEIRO')
          ? { somaFinalizados: soma._sum.total ? dinheiro(soma._sum.total) : '0.00' }
          : {}),
        quantidadeFinalizados: soma._count,
      };
    },
  );

  app.get('/pedidos/:id', { preHandler: app.exigir('PEDIDOS_VER') }, async (request) => {
    const { id } = esquemaParamId.parse(request.params);
    const pedido = await buscarPedidoCompleto(app.banco, BigInt(id));
    if (!pedido) throw naoEncontrado();
    return paraPedidoApi(pedido);
  });

  // Pagar depois (etapa 15): quem registra pedidos vê os que faltam pagar, de qualquer dia,
  // do mais antigo para o mais novo.
  app.get(
    '/pedidos/a-receber',
    { preHandler: app.exigir('PEDIDOS_REGISTRAR') },
    async (): Promise<{ dados: PedidoAReceber[] }> => {
      const abertos = await app.banco.pedido.findMany({
        where: { status: 'ABERTO' },
        include: { itens: { orderBy: { id: 'asc' } } },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
        take: 200,
      });
      return { dados: abertos.map(paraPedidoAReceberApi) };
    },
  );

  // Recebe o pagamento de um pedido ABERTO: vira FINALIZADO e entra no faturamento.
  app.patch(
    '/pedidos/:id/pagamento',
    { preHandler: app.exigir('PEDIDOS_REGISTRAR') },
    async (request) => {
      const { id } = esquemaParamId.parse(request.params);
      const corpo = esquemaPagamento.safeParse(request.body);
      if (!corpo.success) {
        throw new ErroApp(422, 'FORMA_PAGAMENTO_INVALIDA', 'Escolha uma forma de pagamento válida');
      }
      const usuario = usuarioDa(request);
      const pedido = await app.banco.$transaction(async (tx) => {
        const atual = await tx.pedido.findUnique({ where: { id: BigInt(id) } });
        if (!atual) throw naoEncontrado();
        if (atual.status === 'CANCELADO') {
          throw new ErroApp(409, 'PEDIDO_CANCELADO', 'Este pedido foi cancelado');
        }
        if (atual.status === 'FINALIZADO') {
          throw new ErroApp(409, 'PEDIDO_JA_PAGO', 'Este pedido já foi pago');
        }
        const forma = await tx.formaPagamento.findUnique({
          where: { codigo: corpo.data.formaPagamento },
        });
        const { valorRecebidoCentavos, trocoCentavos } = calcularPagamento(
          paraCentavos(atual.total.toFixed(2)),
          forma,
          corpo.data.valorRecebido,
        );
        // Só passa de ABERTO para FINALIZADO uma vez, mesmo com dois toques ao mesmo tempo.
        const alterados = await tx.pedido.updateMany({
          where: { id: atual.id, status: 'ABERTO' },
          data: {
            status: 'FINALIZADO',
            formaPagamentoId: forma!.id,
            valorRecebido:
              valorRecebidoCentavos === null ? null : deCentavos(valorRecebidoCentavos),
            troco: trocoCentavos === null ? null : deCentavos(trocoCentavos),
            finalizadoEm: new Date(),
          },
        });
        if (alterados.count === 0) {
          throw new ErroApp(409, 'PEDIDO_JA_PAGO', 'Este pedido já foi pago');
        }
        return (await buscarPedidoCompleto(tx, atual.id))!;
      });
      request.log.info(
        {
          evento: 'pedido_pago',
          pedidoId: id,
          total: dinheiro(pedido.total),
          usuarioId: Number(usuario.id),
        },
        'pagamento recebido',
      );
      return paraPedidoApi(pedido);
    },
  );

  // Fila de preparo do dia: pedidos ainda não entregues, por ordem de chegada. Entram os pagos
  // e os de pagar depois (o cliente come e paga no fim).
  app.get('/fila', { preHandler: app.exigir('FILA') }, async (): Promise<FilaPreparo> => {
    const hoje = intervaloDeDias(undefined, undefined, 'FILTRO_INVALIDO');
    const doDia = {
      status: { in: ['FINALIZADO', 'ABERTO'] },
      criadoEm: { gte: hoje.inicio, lt: hoje.fim },
    } satisfies Prisma.PedidoWhereInput;
    const [ativos, entregues] = await Promise.all([
      app.banco.pedido.findMany({
        where: { ...doDia, statusPreparo: { not: 'ENTREGUE' } },
        include: { itens: { orderBy: { id: 'asc' } } },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
        take: 200,
      }),
      app.banco.pedido.findMany({
        where: { ...doDia, statusPreparo: 'ENTREGUE' },
        include: { itens: { orderBy: { id: 'asc' } } },
        orderBy: [{ preparoAtualizadoEm: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);
    return {
      dados: ativos.map(paraPedidoNaFilaApi),
      entreguesRecentes: entregues.map(paraPedidoNaFilaApi),
    };
  });

  // Quem tem a fila avança (ou volta, para corrigir um toque errado) o preparo.
  // Só muda o andamento; itens, valores e status do pedido não mudam (RN-13).
  app.patch('/pedidos/:id/preparo', { preHandler: app.exigir('FILA') }, async (request) => {
    const { id } = esquemaParamId.parse(request.params);
    const corpo = esquemaPreparo.safeParse(request.body);
    if (!corpo.success) {
      throw new ErroApp(422, 'STATUS_PREPARO_INVALIDO', 'Status de preparo inválido');
    }
    const atual = await app.banco.pedido.findUnique({ where: { id: BigInt(id) } });
    if (!atual) throw naoEncontrado();
    if (atual.status === 'CANCELADO') {
      throw new ErroApp(409, 'PEDIDO_CANCELADO', 'Este pedido foi cancelado e saiu da fila');
    }
    await app.banco.pedido.update({
      where: { id: atual.id },
      data: { statusPreparo: corpo.data.status, preparoAtualizadoEm: new Date() },
    });
    request.log.info(
      { evento: 'preparo_alterado', pedidoId: id, status: corpo.data.status },
      'preparo alterado',
    );
    return paraPedidoApi((await buscarPedidoCompleto(app.banco, atual.id))!);
  });

  // Não existe endpoint para editar nem apagar pedido (RN-13).
  app.patch(
    '/pedidos/:id/cancelar',
    { preHandler: app.exigir('PEDIDOS_CANCELAR') },
    async (request) => {
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
    },
  );
}
