import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Crown, Printer } from 'lucide-react';
import { formatarReais, paraCentavos, type RelatorioVendas } from '@patotinha/shared';
import { api, query } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import {
  Esqueleto,
  IconePagamento,
  LinhasEsqueleto,
  NOME_PAGAMENTO,
} from '../componentes/Diversos';
import { SeletorPeriodo } from '../componentes/SeletorPeriodo';
import { periodoDaUrl, periodoParaUrl } from './Historico';
import { t } from '../textos';

const meses = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "1 a 8 de outubro de 2026" */
function periodoPorExtenso(de: string, ate: string) {
  const [a1, m1, d1] = de.split('-').map(Number) as [number, number, number];
  const [a2, m2, d2] = ate.split('-').map(Number) as [number, number, number];
  const fim = `${d2} de ${meses[m2 - 1]} de ${a2}`;
  if (de === ate) return fim;
  if (a1 === a2 && m1 === m2) return `${d1} a ${fim}`;
  if (a1 === a2) return `${d1} de ${meses[m1 - 1]} a ${fim}`;
  return `${d1} de ${meses[m1 - 1]} de ${a1} a ${fim}`;
}

export function Resumo() {
  const [params, setParams] = useSearchParams();
  const periodo = periodoDaUrl(params);

  const relatorio = useQuery({
    queryKey: ['inicio', 'relatorio', periodo.de, periodo.ate],
    queryFn: () =>
      api<RelatorioVendas>(
        `/relatorios/vendas${query({ de: periodo.de, ate: periodo.ate, limiteProdutos: 10 })}`,
      ),
    placeholderData: keepPreviousData,
  });
  const r = relatorio.data;
  const faturamento = r ? paraCentavos(r.faturamento) : 0;
  const pct = (valor: string) =>
    faturamento ? Math.round((paraCentavos(valor) / faturamento) * 1000) / 10 : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div className="nao-imprimir flex flex-wrap items-end justify-between gap-3">
        <SeletorPeriodo
          comMes
          valor={periodo}
          aoMudar={(p) => {
            const novo = new URLSearchParams(params);
            periodoParaUrl(p, novo);
            setParams(novo, { replace: true });
          }}
        />
        <Botao icone={<Printer size={20} aria-hidden />} onClick={() => window.print()}>
          {t('resumo.imprimir')}
        </Botao>
      </div>
      <p className="font-titulo text-[20px] font-medium">
        {periodoPorExtenso(periodo.de, periodo.ate)}
      </p>

      {relatorio.isError && (
        <p className="text-erro" role="alert">
          {relatorio.error.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {r ? (
          <>
            <div className="cartao border-moldura/40 p-4">
              <p className="legenda">{t('resumo.faturamento')}</p>
              <p className="font-titulo text-[32px] font-semibold leading-10 text-total tabular-nums">
                {formatarReais(r.faturamento)}
              </p>
            </div>
            <div className="cartao p-4">
              <p className="legenda">{t('resumo.finalizados')}</p>
              <p className="font-titulo text-[32px] font-semibold leading-10 tabular-nums">
                {r.pedidosFinalizados}
              </p>
              <p className="legenda tabular-nums">
                {t('resumo.mediaPorPedido', {
                  valor: formatarReais(
                    r.pedidosFinalizados ? Math.round(faturamento / r.pedidosFinalizados) : 0,
                  ),
                })}
              </p>
            </div>
            <div className="cartao p-4">
              <p className="legenda">{t('resumo.cancelados')}</p>
              <p className="font-titulo text-[32px] font-semibold leading-10 tabular-nums">
                {r.pedidosCancelados}
              </p>
              <p className="legenda tabular-nums">
                {t('resumo.valorCancelados', { valor: formatarReais(r.valorCancelados) })}
              </p>
            </div>
          </>
        ) : (
          [1, 2, 3].map((i) => <Esqueleto key={i} className="h-[120px]" />)
        )}
      </div>

      {!r ? (
        <LinhasEsqueleto linhas={6} />
      ) : r.pedidosFinalizados === 0 ? (
        <p className="cartao enfeite p-8 text-center text-[24px] text-moldura">
          {t('dica.resumoVazio')}
        </p>
      ) : (
        <>
          {r.maisVendidoPorCategoria.length > 0 && (
            <section aria-labelledby="titulo-carro-chefe">
              <h2 id="titulo-carro-chefe" className="titulo-secao mb-1">
                {t('resumo.carroChefe')}
              </h2>
              <p className="legenda mb-3">{t('resumo.carroChefeDica')}</p>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {r.maisVendidoPorCategoria.map((m) => (
                  <li
                    key={m.categoriaId}
                    className="cartao flex flex-col gap-1 border-moldura/40 p-4"
                    data-testid="carro-chefe"
                  >
                    <span className="legenda inline-flex items-center gap-1.5">
                      <Crown size={18} className="text-moldura" aria-hidden /> {m.categoria}
                    </span>
                    <span className="font-titulo text-[24px] font-semibold leading-8">
                      {m.nome}
                    </span>
                    <span className="legenda tabular-nums">
                      {t(m.quantidade === 1 ? 'resumo.vendidoUm' : 'resumo.vendidos', {
                        quantidade: m.quantidade,
                        valor: formatarReais(m.valor),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="cartao overflow-x-auto p-4" aria-labelledby="titulo-formas">
              <h2 id="titulo-formas" className="titulo-secao mb-3">
                {t('resumo.porForma')}
              </h2>
              <table className="w-full text-left">
                <thead className="legenda">
                  <tr>
                    <th className="py-2 font-semibold">Forma</th>
                    <th className="py-2 text-right font-semibold">Pedidos</th>
                    <th className="py-2 text-right font-semibold">Valor</th>
                    <th className="w-[35%] py-2 pl-4 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porFormaPagamento.map((f) => (
                    <tr key={f.codigo} className="h-11 border-t border-borda">
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <IconePagamento codigo={f.codigo} /> {NOME_PAGAMENTO[f.codigo]}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{f.pedidos}</td>
                      <td className="text-right font-bold tabular-nums">
                        {formatarReais(f.total)}
                      </td>
                      <td className="pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-3 flex-1 rounded-full bg-creme-escuro">
                            <div
                              className="h-3 rounded-full bg-acao"
                              style={{ width: `${pct(f.total)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-[13px] tabular-nums">
                            {pct(f.total).toLocaleString('pt-BR')}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="h-11 border-t-2 border-borda italic">
                    <td>{t('resumo.cartao')}</td>
                    <td className="text-right tabular-nums">{r.cartaoPedidos}</td>
                    <td className="text-right font-bold tabular-nums">
                      {formatarReais(r.cartaoTotal)}
                    </td>
                    <td className="pl-4 text-right text-[13px] tabular-nums">
                      {pct(r.cartaoTotal).toLocaleString('pt-BR')}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="cartao overflow-x-auto p-4" aria-labelledby="titulo-mais">
              <h2 id="titulo-mais" className="titulo-secao mb-3">
                {t('resumo.maisVendidos')}
              </h2>
              <table className="w-full text-left">
                <thead className="legenda">
                  <tr>
                    <th className="w-10 py-2 font-semibold">#</th>
                    <th className="py-2 font-semibold">Produto</th>
                    <th className="py-2 text-right font-semibold">Quantidade</th>
                    <th className="py-2 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {r.produtosMaisVendidos.map((p, i) => (
                    <tr key={p.produtoId} className="h-11 border-t border-borda">
                      <td className="font-bold">{i + 1}</td>
                      <td>{p.nome}</td>
                      <td className="text-right tabular-nums">{p.quantidade}</td>
                      <td className="text-right font-bold tabular-nums">
                        {formatarReais(p.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
