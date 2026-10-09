import type { FastifyInstance } from 'fastify';
import type { CodigoPagamento, RelatorioVendas } from '@patotinha/shared';
import { deCentavos, esquemaFiltroRelatorio, paraCentavos } from '@patotinha/shared';
import { ErroApp } from '../erros.js';
import { intervaloDeDias } from '../periodo.js';

interface LinhaMaisVendido {
  produto_id: bigint;
  nome: string;
  quantidade: bigint;
  valor: string;
}

export async function rotasRelatorios(app: FastifyInstance) {
  app.get(
    '/relatorios/vendas',
    { preHandler: app.exigirAdmin },
    async (request): Promise<RelatorioVendas> => {
      const resultado = esquemaFiltroRelatorio.safeParse(request.query);
      if (!resultado.success) {
        throw new ErroApp(422, 'PERIODO_INVALIDO', 'Período inválido', resultado.error.issues);
      }
      const filtro = resultado.data;
      // "Dia" é o dia civil em Brasília (RN-24); pedidos contam no período em que foram criados.
      const periodo = intervaloDeDias(filtro.de, filtro.ate, 'PERIODO_INVALIDO');
      const noPeriodo = { criadoEm: { gte: periodo.inicio, lt: periodo.fim } };

      const [formas, porForma, cancelados, maisVendidos] = await Promise.all([
        app.banco.formaPagamento.findMany({ orderBy: { id: 'asc' } }),
        app.banco.pedido.groupBy({
          by: ['formaPagamentoId'],
          where: { ...noPeriodo, status: 'FINALIZADO' },
          _count: { _all: true },
          _sum: { total: true },
        }),
        app.banco.pedido.aggregate({
          where: { ...noPeriodo, status: 'CANCELADO' },
          _count: { _all: true },
          _sum: { total: true },
        }),
        // Consulta parametrizada; o nome é o gravado na venda mais recente do produto.
        app.banco.$queryRaw<LinhaMaisVendido[]>`
          SELECT i.produto_id,
                 (array_agg(i.nome_produto ORDER BY i.id DESC))[1] AS nome,
                 sum(i.quantidade)::bigint AS quantidade,
                 sum(i.subtotal)::text AS valor
            FROM itens_pedido i
            JOIN pedidos p ON p.id = i.pedido_id
           WHERE p.status = 'FINALIZADO'
             AND p.criado_em >= ${periodo.inicio}
             AND p.criado_em <  ${periodo.fim}
           GROUP BY i.produto_id
           ORDER BY sum(i.quantidade) DESC, sum(i.subtotal) DESC, i.produto_id
           LIMIT ${filtro.limiteProdutos}`,
      ]);

      // Cancelados ficam fora do faturamento e dos totais por forma (RN-16).
      const linhas = formas
        .filter((f) => f.ativo || porForma.some((g) => g.formaPagamentoId === f.id))
        .map((f) => {
          const grupo = porForma.find((g) => g.formaPagamentoId === f.id);
          return {
            codigo: f.codigo as CodigoPagamento,
            nome: f.nome,
            pedidos: grupo?._count._all ?? 0,
            centavos: grupo?._sum.total ? paraCentavos(grupo._sum.total.toFixed(2)) : 0,
          };
        });
      const faturamento = linhas.reduce((s, l) => s + l.centavos, 0);
      const cartoes = linhas.filter((l) => l.codigo === 'DEBITO' || l.codigo === 'CREDITO');

      return {
        periodo: { de: periodo.de, ate: periodo.ate },
        pedidosFinalizados: linhas.reduce((s, l) => s + l.pedidos, 0),
        pedidosCancelados: cancelados._count._all,
        valorCancelados: cancelados._sum.total ? cancelados._sum.total.toFixed(2) : '0.00',
        faturamento: deCentavos(faturamento),
        porFormaPagamento: linhas.map(({ centavos, ...l }) => ({
          ...l,
          total: deCentavos(centavos),
        })),
        cartaoTotal: deCentavos(cartoes.reduce((s, l) => s + l.centavos, 0)),
        cartaoPedidos: cartoes.reduce((s, l) => s + l.pedidos, 0),
        produtosMaisVendidos: maisVendidos.map((m) => ({
          produtoId: Number(m.produto_id),
          nome: m.nome,
          quantidade: Number(m.quantidade),
          valor: deCentavos(paraCentavos(m.valor)),
        })),
      };
    },
  );
}
