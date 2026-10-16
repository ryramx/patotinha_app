import type { Pedido, PedidoNaFila, PedidoResumido, Preparo } from '@patotinha/shared';
import type { Banco } from '../banco.js';
import { data, dinheiro, id } from '../serializar.js';
import type { Prisma } from '../generated/prisma/client.js';

export const incluirPedidoCompleto = {
  usuario: true,
  canceladoPor: true,
  formaPagamento: true,
  itens: { orderBy: { id: 'asc' } },
} as const satisfies Prisma.PedidoInclude;

type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedidoCompleto }>;

type ComPreparo = Pick<PedidoCompleto, 'statusPreparo' | 'preparoAtualizadoEm'>;

function preparo(p: ComPreparo): Preparo {
  return {
    status: p.statusPreparo as Preparo['status'],
    atualizadoEm: data(p.preparoAtualizadoEm),
  };
}

export function paraPedidoApi(p: PedidoCompleto): Pedido {
  const pedido: Pedido = {
    id: id(p.id),
    status: p.status as Pedido['status'],
    cliente: p.clienteNome,
    preparo: preparo(p),
    criadoEm: data(p.criadoEm),
    finalizadoEm: data(p.finalizadoEm),
    usuario: { id: id(p.usuario.id), nome: p.usuario.nome },
    formaPagamento: p.formaPagamento
      ? {
          codigo: p.formaPagamento.codigo as NonNullable<Pedido['formaPagamento']>['codigo'],
          nome: p.formaPagamento.nome,
        }
      : null,
    itens: p.itens.map((i) => ({
      produtoId: id(i.produtoId),
      nomeProduto: i.nomeProduto,
      quantidade: i.quantidade,
      precoUnitario: dinheiro(i.precoUnitario),
      subtotal: dinheiro(i.subtotal),
    })),
    total: dinheiro(p.total),
    valorRecebido: dinheiro(p.valorRecebido),
    troco: dinheiro(p.troco),
  };
  if (p.status === 'CANCELADO' && p.canceladoEm && p.canceladoPor && p.motivoCancelamento) {
    pedido.cancelamento = {
      em: data(p.canceladoEm),
      por: { id: id(p.canceladoPor.id), nome: p.canceladoPor.nome },
      motivo: p.motivoCancelamento,
    };
  }
  return pedido;
}

type PedidoResumo = Prisma.PedidoGetPayload<{ include: { usuario: true; formaPagamento: true } }>;

export function paraPedidoResumidoApi(p: PedidoResumo): PedidoResumido {
  return {
    id: id(p.id),
    cliente: p.clienteNome,
    preparo: preparo(p),
    criadoEm: data(p.criadoEm),
    total: dinheiro(p.total),
    formaPagamento: (p.formaPagamento?.codigo ?? null) as PedidoResumido['formaPagamento'],
    status: p.status as PedidoResumido['status'],
    usuario: { id: id(p.usuario.id), nome: p.usuario.nome },
  };
}

export function buscarPedidoCompleto(banco: Banco | Prisma.TransactionClient, pedidoId: bigint) {
  return banco.pedido.findUnique({ where: { id: pedidoId }, include: incluirPedidoCompleto });
}

type PedidoFila = Prisma.PedidoGetPayload<{ include: { itens: true } }>;

export function paraPedidoNaFilaApi(p: PedidoFila): PedidoNaFila {
  return {
    id: id(p.id),
    cliente: p.clienteNome,
    criadoEm: data(p.criadoEm),
    preparo: preparo(p),
    itens: p.itens.map((i) => ({ nomeProduto: i.nomeProduto, quantidade: i.quantidade })),
  };
}
