import type { DadosNovoPedido } from '@patotinha/shared';
import { deCentavos, paraCentavos } from '@patotinha/shared';
import type { Banco } from '../banco.js';
import { eUnicoViolado } from '../erros.js';
import { calcularPedido, type ProdutoAtual } from './calculo.js';
import { buscarPedidoCompleto, incluirPedidoCompleto } from './repositorio.js';

export type ResultadoCriacao =
  | { criado: true; pedido: NonNullable<Awaited<ReturnType<typeof buscarPedidoCompleto>>> }
  | { criado: false; pedido: NonNullable<Awaited<ReturnType<typeof buscarPedidoCompleto>>> };

/**
 * Registra um pedido já FINALIZADO (opção A do PRD 4.3) numa única transação:
 * ou grava pedido e itens, ou nada (RNF-17). Ordem do PRD 13.1, passo 8.
 */
export async function criarPedido(
  banco: Banco,
  dados: DadosNovoPedido,
  usuarioId: bigint,
): Promise<ResultadoCriacao> {
  // 1. Mesma chave de idempotência: devolve o pedido já gravado (RN-26).
  const existente = await banco.pedido.findUnique({
    where: { chaveIdempotencia: dados.chaveIdempotencia },
    include: incluirPedidoCompleto,
  });
  if (existente) return { criado: false, pedido: existente };

  try {
    const pedido = await banco.$transaction(async (tx) => {
      // 2 a 3. Carrega os produtos e a forma de pagamento atuais.
      const ids = [...new Set(dados.itens.map((i) => BigInt(i.produtoId)))];
      const produtos = await tx.produto.findMany({
        where: { id: { in: ids } },
        include: { categoria: true },
      });
      const mapa = new Map<number, ProdutoAtual>(
        produtos.map((p) => [
          Number(p.id),
          {
            id: Number(p.id),
            nome: p.nome,
            precoCentavos: paraCentavos(p.preco.toFixed(2)),
            ativo: p.ativo,
            categoriaAtiva: p.categoria.ativo,
          },
        ]),
      );
      const forma = await tx.formaPagamento.findUnique({ where: { codigo: dados.formaPagamento } });

      // 4 a 6. Confere preços e regras e calcula tudo com os valores do banco.
      const calculo = calcularPedido(dados.itens, mapa, forma, dados.valorRecebido);

      // 7. Grava pedido e itens. Usuário vem do token e a hora do servidor (RN-22, RN-23).
      const criado = await tx.pedido.create({
        data: {
          status: 'FINALIZADO',
          usuarioId,
          formaPagamentoId: forma!.id,
          total: deCentavos(calculo.totalCentavos),
          valorRecebido:
            calculo.valorRecebidoCentavos === null
              ? null
              : deCentavos(calculo.valorRecebidoCentavos),
          troco: calculo.trocoCentavos === null ? null : deCentavos(calculo.trocoCentavos),
          chaveIdempotencia: dados.chaveIdempotencia,
          finalizadoEm: new Date(),
          itens: {
            create: calculo.itens.map((i) => ({
              produtoId: BigInt(i.produtoId),
              nomeProduto: i.nomeProduto,
              quantidade: i.quantidade,
              precoUnitario: deCentavos(i.precoUnitarioCentavos),
              subtotal: deCentavos(i.subtotalCentavos),
            })),
          },
        },
      });
      return (await buscarPedidoCompleto(tx, criado.id))!;
    });
    return { criado: true, pedido };
  } catch (e) {
    // Duas requisições com a mesma chave ao mesmo tempo: a segunda devolve a primeira.
    if (eUnicoViolado(e)) {
      const gravado = await banco.pedido.findUnique({
        where: { chaveIdempotencia: dados.chaveIdempotencia },
        include: incluirPedidoCompleto,
      });
      if (gravado) return { criado: false, pedido: gravado };
    }
    throw e;
  }
}
