import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChefHat, CirclePlus } from 'lucide-react';
import {
  diaEmSaoPaulo,
  formatarDiaPorExtenso,
  formatarHora,
  formatarReais,
  horaEmSaoPaulo,
  type ListaPedidos,
  type RelatorioVendas,
} from '@patotinha/shared';
import { api, query } from '../api/cliente';
import { primeiroNome, useSessao } from '../auth/sessao';
import { Botao } from '../componentes/Botao';
import {
  EtiquetaStatus,
  Esqueleto,
  LinhasEsqueleto,
  Pagamento,
  Vazio,
} from '../componentes/Diversos';
import { t } from '../textos';

function saudacao() {
  const hora = horaEmSaoPaulo();
  return hora < 12 ? t('inicio.bomDia') : hora < 18 ? t('inicio.boaTarde') : t('inicio.boaNoite');
}

export function Inicio() {
  const { usuario, eAdmin } = useSessao();
  const navegar = useNavigate();
  const hoje = diaEmSaoPaulo();

  const pedidos = useQuery({
    queryKey: ['pedidos', 'inicio', hoje],
    queryFn: () => api<ListaPedidos>(`/pedidos${query({ de: hoje, ate: hoje, tamanho: 10 })}`),
  });
  // Cartões do dia (só administrador), atualizados a cada 60 s.
  const resumo = useQuery({
    queryKey: ['inicio', 'resumo', hoje],
    queryFn: () =>
      api<RelatorioVendas>(
        `/relatorios/vendas${query({ de: hoje, ate: hoje, limiteProdutos: 1 })}`,
      ),
    enabled: eAdmin,
    refetchInterval: 60_000,
  });

  const valorForma = (codigo: string) =>
    resumo.data?.porFormaPagamento.find((f) => f.codigo === codigo)?.total ?? '0.00';
  const cartoes = resumo.data
    ? [
        {
          rotulo: t('inicio.faturamento'),
          valor: formatarReais(resumo.data.faturamento),
          destaque: true,
        },
        { rotulo: t('inicio.finalizados'), valor: String(resumo.data.pedidosFinalizados) },
        { rotulo: t('inicio.dinheiro'), valor: formatarReais(valorForma('DINHEIRO')) },
        { rotulo: t('inicio.pix'), valor: formatarReais(valorForma('PIX')) },
      ]
    : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="enfeite text-[28px] leading-10 text-moldura">
            {saudacao()}, {primeiroNome(usuario?.nome ?? '')}!
          </p>
          <p className="text-[14px] capitalize text-texto-suave">
            {formatarDiaPorExtenso(new Date())}
          </p>
        </div>
        <Botao
          variante="principal"
          className="min-h-[72px] w-full text-[18px] sm:w-80"
          icone={<CirclePlus size={28} aria-hidden />}
          title="Novo pedido · F1"
          onClick={() => navegar('/pedidos/novo')}
        >
          {t('menu.novoPedido')}
        </Botao>
      </div>
      <Botao
        className="w-full sm:w-80 sm:self-end"
        icone={<ChefHat size={22} aria-hidden />}
        onClick={() => navegar('/fila')}
      >
        {t('menu.fila')}
      </Botao>

      {eAdmin && (
        <section aria-label="Números de hoje">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cartoes
              ? cartoes.map((c) => (
                  <Link
                    key={c.rotulo}
                    to="/resumo"
                    className={`cartao flex flex-col gap-1 p-4 hover:shadow-elevada ${c.destaque ? 'border-moldura/40 [&>span:last-child]:text-total' : ''}`}
                  >
                    <span className="legenda">{c.rotulo}</span>
                    <span className="font-titulo text-[32px] font-semibold leading-10 tabular-nums">
                      {c.valor}
                    </span>
                  </Link>
                ))
              : [1, 2, 3, 4].map((i) => <Esqueleto key={i} className="h-[104px]" />)}
          </div>
          <Link
            to="/resumo"
            className="mt-2 inline-block font-bold text-moldura underline-offset-4 hover:underline"
          >
            {t('inicio.verResumo')}
          </Link>
        </section>
      )}

      <section className="cartao p-4" aria-labelledby="titulo-hoje">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="titulo-hoje" className="titulo-secao">
            {t('inicio.pedidosHoje')}
          </h2>
          <Link to="/pedidos" className="font-bold text-moldura underline-offset-4 hover:underline">
            {t('inicio.verTodos')}
          </Link>
        </div>
        {pedidos.isPending ? (
          <LinhasEsqueleto linhas={5} />
        ) : pedidos.isError ? (
          <p className="text-erro">{t('erro.semConexaoCarregar')}</p>
        ) : pedidos.data.dados.length === 0 ? (
          <Vazio texto={t('dica.inicioVazio')} />
        ) : (
          <table className="w-full text-left">
            <thead className="legenda">
              <tr>
                <th className="py-2 pr-3 font-semibold">Nº</th>
                <th className="py-2 pr-3 font-semibold">Cliente</th>
                <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Hora</th>
                <th className="py-2 text-right font-semibold">Total</th>
                <th className="hidden py-2 pl-6 font-semibold sm:table-cell">Pagamento</th>
                <th className="py-2 pl-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.data.dados.map((p) => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  onClick={() => navegar(`/pedidos/${p.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navegar(`/pedidos/${p.id}`)}
                  className="h-11 cursor-pointer border-t border-borda even:bg-creme-escuro/50 hover:bg-creme-escuro"
                >
                  <td className="pr-3 font-bold tabular-nums">{p.id}</td>
                  <td className="max-w-[120px] truncate pr-3 sm:max-w-[160px]">
                    {p.cliente ?? '—'}
                  </td>
                  <td className="hidden whitespace-nowrap pr-3 sm:table-cell">
                    {formatarHora(p.criadoEm)}
                  </td>
                  <td
                    className={`whitespace-nowrap text-right tabular-nums ${p.status === 'CANCELADO' ? 'text-desab-texto line-through' : ''}`}
                  >
                    {formatarReais(p.total)}
                  </td>
                  <td className="hidden pl-6 sm:table-cell">
                    <Pagamento codigo={p.formaPagamento} />
                  </td>
                  <td className="pl-4">
                    <EtiquetaStatus status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
