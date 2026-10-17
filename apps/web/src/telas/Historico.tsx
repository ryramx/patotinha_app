import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  diaEmSaoPaulo,
  formatarData,
  formatarHora,
  formatarReais,
  LIMITES,
  somarDias,
  type ListaPedidos,
  type Usuario,
} from '@patotinha/shared';
import { api, query } from '../api/cliente';
import { primeiroNome, useSessao } from '../auth/sessao';
import { Botao } from '../componentes/Botao';
import {
  EtiquetaStatus,
  LinhasEsqueleto,
  Pagamento,
  Paginacao,
  Vazio,
  NOME_PAGAMENTO,
} from '../componentes/Diversos';
import {
  periodoDoAtalho,
  SeletorPeriodo,
  type AtalhoPeriodo,
  type Periodo,
} from '../componentes/SeletorPeriodo';
import { t } from '../textos';

const TAMANHO = 50;

/** Lê o período do endereço; os filtros ficam na URL para voltar do detalhe sem perder nada. */
export function periodoDaUrl(params: URLSearchParams): Periodo {
  const atalho = (params.get('periodo') ?? 'hoje') as AtalhoPeriodo;
  if (atalho === 'personalizado') {
    const hoje = diaEmSaoPaulo();
    return { atalho, de: params.get('de') ?? hoje, ate: params.get('ate') ?? hoje };
  }
  return periodoDoAtalho(
    ['hoje', 'ontem', '7dias', 'mes'].includes(atalho) ? (atalho as 'hoje') : 'hoje',
  );
}

export function periodoParaUrl(p: Periodo, params: URLSearchParams) {
  params.set('periodo', p.atalho);
  if (p.atalho === 'personalizado') {
    params.set('de', p.de);
    params.set('ate', p.ate);
  } else {
    params.delete('de');
    params.delete('ate');
  }
}

function dataAmigavel(iso: string) {
  const dia = diaEmSaoPaulo(iso);
  const hoje = diaEmSaoPaulo();
  if (dia === hoje) return 'Hoje';
  if (dia === somarDias(hoje, -1)) return 'Ontem';
  return formatarData(iso);
}

export function Historico() {
  const { pode } = useSessao();
  const filtroUsuario = pode('USUARIOS');
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const periodo = periodoDaUrl(params);
  const status = params.get('status') ?? '';
  const pagamento = params.get('pagamento') ?? '';
  const usuarioId = params.get('usuario') ?? '';
  const numero = params.get('numero') ?? '';
  const cliente = params.get('cliente') ?? '';
  const pagina = Number(params.get('pagina') ?? 1) || 1;

  const mudar = (fn: (p: URLSearchParams) => void) => {
    const novo = new URLSearchParams(params);
    fn(novo);
    novo.delete('pagina'); // filtro novo volta para a primeira página
    setParams(novo, { replace: true });
  };
  const definir = (chave: string, valor: string) =>
    mudar((p) => {
      if (valor) p.set(chave, valor);
      else p.delete(chave);
    });

  const lista = useQuery({
    queryKey: [
      'pedidos',
      'historico',
      periodo.de,
      periodo.ate,
      status,
      pagamento,
      usuarioId,
      numero,
      cliente,
      pagina,
    ],
    queryFn: () =>
      api<ListaPedidos>(
        `/pedidos${query({
          de: periodo.de,
          ate: periodo.ate,
          status: status || undefined,
          formaPagamento: pagamento || undefined,
          usuarioId: usuarioId || undefined,
          numero: numero || undefined,
          cliente: cliente.trim() || undefined,
          pagina,
          tamanho: TAMANHO,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });
  const usuarios = useQuery({
    queryKey: ['usuarios', 'todos'],
    queryFn: () => api<Usuario[]>('/usuarios'),
    enabled: filtroUsuario,
  });

  const filtrosAtivos = useMemo(() => {
    const lista: { rotulo: string; limpar: () => void }[] = [];
    if (status)
      lista.push({
        rotulo: status === 'CANCELADO' ? 'Cancelado' : 'Finalizado',
        limpar: () => definir('status', ''),
      });
    if (pagamento)
      lista.push({
        rotulo: NOME_PAGAMENTO[pagamento as 'PIX'],
        limpar: () => definir('pagamento', ''),
      });
    if (usuarioId) {
      const u = usuarios.data?.find((x) => String(x.id) === usuarioId);
      lista.push({
        rotulo: u?.nome ?? `Usuário ${usuarioId}`,
        limpar: () => definir('usuario', ''),
      });
    }
    if (numero) lista.push({ rotulo: `Nº ${numero}`, limpar: () => definir('numero', '') });
    if (cliente.trim())
      lista.push({ rotulo: `Cliente: ${cliente.trim()}`, limpar: () => definir('cliente', '') });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pagamento, usuarioId, numero, cliente, usuarios.data, params]);
  const temFiltro = filtrosAtivos.length > 0 || periodo.atalho !== 'hoje';

  const select = 'h-10 rounded-padrao border border-borda bg-superficie px-2';

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="cartao flex flex-col gap-3 p-4">
        <SeletorPeriodo
          valor={periodo}
          aoMudar={(p) => mudar((params) => periodoParaUrl(p, params))}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col">
            <span className="rotulo">{t('historico.status')}</span>
            <select
              className={select}
              value={status}
              onChange={(e) => definir('status', e.target.value)}
            >
              <option value="">{t('historico.todos')}</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </label>
          <label className="flex flex-col">
            <span className="rotulo">{t('historico.pagamento')}</span>
            <select
              className={select}
              value={pagamento}
              onChange={(e) => definir('pagamento', e.target.value)}
            >
              <option value="">{t('historico.todos')}</option>
              {Object.entries(NOME_PAGAMENTO).map(([codigo, nome]) => (
                <option key={codigo} value={codigo}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          {filtroUsuario && (
            <label className="flex flex-col">
              <span className="rotulo">{t('historico.usuario')}</span>
              <select
                className={select}
                value={usuarioId}
                onChange={(e) => definir('usuario', e.target.value)}
              >
                <option value="">{t('historico.todos')}</option>
                {usuarios.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} {u.ativo ? '' : t('historico.inativo')}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col">
            <span className="rotulo">{t('historico.numero')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={numero}
              onChange={(e) => definir('numero', e.target.value.replace(/\D/g, ''))}
              className={`${select} w-[140px]`}
            />
          </label>
          <label className="flex flex-col">
            <span className="rotulo">{t('historico.cliente')}</span>
            <input
              type="search"
              value={cliente}
              maxLength={LIMITES.clienteNome.max}
              onChange={(e) => definir('cliente', e.target.value)}
              className={`${select} w-[180px]`}
            />
          </label>
          {temFiltro && (
            <Botao
              variante="texto"
              className="ml-auto h-10"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              {t('historico.limparFiltros')}
            </Botao>
          )}
        </div>
        {filtrosAtivos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filtrosAtivos.map((f) => (
              <button
                key={f.rotulo}
                type="button"
                onClick={f.limpar}
                className="inline-flex items-center gap-1 rounded-full bg-creme-escuro px-3 py-1 text-[14px] font-bold hover:bg-borda"
                aria-label={`Remover filtro ${f.rotulo}`}
              >
                {f.rotulo} <X size={14} aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cartao flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          {lista.isPending ? (
            <div className="p-4">
              <LinhasEsqueleto linhas={8} altura="h-12" />
            </div>
          ) : lista.isError ? (
            <p className="p-4 text-erro" role="alert">
              {lista.error.message}
            </p>
          ) : lista.data.dados.length === 0 ? (
            <Vazio texto={t('dica.historicoVazio')}>
              {temFiltro && (
                <Botao onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  {t('historico.limparFiltros')}
                </Botao>
              )}
            </Vazio>
          ) : (
            <table className="w-full min-w-[860px] text-left">
              <thead className="legenda sticky top-0 z-10 bg-superficie shadow-[0_1px_0_var(--cor-borda)]">
                <tr>
                  <th className="w-20 px-4 py-3 font-semibold">Nº</th>
                  <th className="py-3 font-semibold">{t('historico.cliente')}</th>
                  <th className="w-[110px] py-3 font-semibold">Data</th>
                  <th className="w-[70px] py-3 font-semibold">Hora</th>
                  <th className="w-[120px] py-3 pr-6 text-right font-semibold">Total</th>
                  <th className="w-[140px] py-3 font-semibold">Pagamento</th>
                  <th className="w-[120px] py-3 font-semibold">Status</th>
                  <th className="py-3 font-semibold">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.dados.map((p) => {
                  const abrir = () =>
                    navegar(`/pedidos/${p.id}`, { state: { voltar: `/pedidos?${params}` } });
                  return (
                    <tr
                      key={p.id}
                      tabIndex={0}
                      onClick={abrir}
                      onKeyDown={(e) => e.key === 'Enter' && abrir()}
                      className="h-12 cursor-pointer border-t border-borda even:bg-creme-escuro/50 hover:bg-creme-escuro focus-visible:outline-[3px]"
                    >
                      <td className="px-4 font-bold">{p.id}</td>
                      <td className="max-w-[180px] truncate pr-3">{p.cliente ?? '—'}</td>
                      <td>{dataAmigavel(p.criadoEm)}</td>
                      <td>{formatarHora(p.criadoEm)}</td>
                      <td
                        className={`pr-6 text-right tabular-nums ${p.status === 'CANCELADO' ? 'text-desab-texto line-through' : ''}`}
                      >
                        {formatarReais(p.total)}
                      </td>
                      <td>
                        <Pagamento codigo={p.formaPagamento} />
                      </td>
                      <td>
                        <EtiquetaStatus status={p.status} />
                      </td>
                      <td>{primeiroNome(p.usuario.nome)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {lista.data && lista.data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borda px-4 py-3">
            {/* A soma em reais só vem para quem tem Financeiro. */}
            <p className="font-bold tabular-nums">
              {lista.data.somaFinalizados !== undefined &&
                t('historico.totalFiltro', {
                  total: formatarReais(lista.data.somaFinalizados),
                  quantidade: lista.data.quantidadeFinalizados,
                })}
            </p>
            <Paginacao
              pagina={pagina}
              tamanho={TAMANHO}
              total={lista.data.total}
              unidade="pedidos"
              aoMudar={(n) => {
                const novo = new URLSearchParams(params);
                novo.set('pagina', String(n));
                setParams(novo, { replace: true });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
