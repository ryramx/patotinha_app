import type { DadosNovoPedido } from '@patotinha/shared';
import { chaveCliente, deCentavos, paraCentavos } from '@patotinha/shared';
import type { Banco } from '../banco.js';
import { eUnicoViolado } from '../erros.js';
import { calcularPedido, type ProdutoAtual } from './calculo.js';
import { buscarPedidoCompleto, incluirPedidoCompleto } from './repositorio.js';

export type ResultadoCriacao =
  | { criado: true; pedido: NonNullable<Awaited<ReturnType<typeof buscarPedidoCompleto>>> }
  | { criado: false; pedido: NonNullable<Awaited<ReturnType<typeof buscarPedidoCompleto>>> };

/**
 * Registra um pedido já FINALIZADO (opção A do PRD 4.3), ou ABERTO quando o cliente paga
 * depois de comer (etapa 14), numa única transação:
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
      const forma = dados.formaPagamento
        ? await tx.formaPagamento.findUnique({ where: { codigo: dados.formaPagamento } })
        : null;
      const pagarDepois = dados.pagarDepois === true;

      // 4 a 6. Confere preços e regras e calcula tudo com os valores do banco.
      const calculo = calcularPedido(dados.itens, mapa, forma, dados.valorRecebido, pagarDepois);

      // Cadastro leve de clientes: o nome vira sugestão nos próximos pedidos. A grafia mais
      // recente vale, e o telefone só muda quando vem preenchido. ON CONFLICT evita
      // duplicar o cliente se dois pedidos com o mesmo nome novo chegarem juntos.
      const [cliente] = await tx.$queryRaw<{ id: bigint }[]>`
        INSERT INTO clientes (nome, chave, telefone)
        VALUES (${dados.cliente}, ${chaveCliente(dados.cliente)}, ${dados.telefone ?? null})
        ON CONFLICT (chave) DO UPDATE SET
          nome = EXCLUDED.nome,
          telefone = COALESCE(EXCLUDED.telefone, clientes.telefone),
          ultimo_pedido_em = now()
        RETURNING id`;

      // 7. Grava pedido e itens. Usuário vem do token e a hora do servidor (RN-22, RN-23).
      const criado = await tx.pedido.create({
        data: {
          // Pagar depois: ABERTO até receber; já entra na fila de preparo.
          status: pagarDepois ? 'ABERTO' : 'FINALIZADO',
          clienteNome: dados.cliente,
          clienteId: cliente!.id,
          // Entra no fim da fila de preparo (comanda digital).
          statusPreparo: 'AGUARDANDO',
          preparoAtualizadoEm: new Date(),
          usuarioId,
          formaPagamentoId: pagarDepois ? null : forma!.id,
          total: deCentavos(calculo.totalCentavos),
          valorRecebido:
            calculo.valorRecebidoCentavos === null
              ? null
              : deCentavos(calculo.valorRecebidoCentavos),
          troco: calculo.trocoCentavos === null ? null : deCentavos(calculo.trocoCentavos),
          chaveIdempotencia: dados.chaveIdempotencia,
          finalizadoEm: pagarDepois ? null : new Date(),
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
