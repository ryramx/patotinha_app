import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { formatarData, formatarHora, formatarReais, LIMITES, type Pedido } from '@patotinha/shared';
import { api, ErroDaApi } from '../api/cliente';
import { useSessao } from '../auth/sessao';
import { useAvisos } from '../componentes/Avisos';
import { Botao } from '../componentes/Botao';
import { MensagemErro } from '../componentes/Campos';
import {
  EtiquetaPreparo,
  EtiquetaStatus,
  IconePagamento,
  LinhasEsqueleto,
  NOME_PAGAMENTO,
  Vazio,
} from '../componentes/Diversos';
import { Janela } from '../componentes/Janela';
import { t } from '../textos';

const SUGESTOES = ['Cliente desistiu', 'Lançado errado', 'Pedido duplicado'];

export function DetalhePedido() {
  const { id } = useParams();
  const { eAdmin } = useSessao();
  const local = useLocation();
  const voltar = (local.state as { voltar?: string } | null)?.voltar ?? '/pedidos';
  const [cancelando, setCancelando] = useState(false);

  const pedido = useQuery({
    queryKey: ['pedidos', 'detalhe', id],
    queryFn: () => api<Pedido>(`/pedidos/${id}`),
    retry: (n, e) => (e as ErroDaApi).status !== 404 && n < 2,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 md:p-6">
      <Link to={voltar} className="font-bold text-moldura underline-offset-4 hover:underline">
        {t('detalhe.voltar')}
      </Link>

      {pedido.isPending ? (
        <LinhasEsqueleto linhas={6} />
      ) : pedido.isError ? (
        (pedido.error as ErroDaApi).status === 404 ? (
          <Vazio texto={t('detalhe.naoEncontrado')} />
        ) : (
          <p className="text-erro" role="alert">
            {pedido.error.message}
          </p>
        )
      ) : (
        <ConteudoPedido
          p={pedido.data}
          podeCancelar={eAdmin}
          aoCancelar={() => setCancelando(true)}
        />
      )}

      {cancelando && pedido.data && (
        <JanelaCancelamento pedido={pedido.data} aoFechar={() => setCancelando(false)} />
      )}
    </div>
  );
}

function ConteudoPedido({
  p,
  podeCancelar,
  aoCancelar,
}: {
  p: Pedido;
  podeCancelar: boolean;
  aoCancelar: () => void;
}) {
  const cancelado = p.status === 'CANCELADO';
  return (
    <>
      {p.cancelamento && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-padrao border-l-4 border-erro bg-erro-fundo px-4 py-3 text-erro"
        >
          <Ban size={20} className="mt-0.5 shrink-0" aria-hidden />
          <p className="font-semibold">
            {t('detalhe.cancelado', {
              nome: p.cancelamento.por.nome,
              data: formatarData(p.cancelamento.em),
              hora: formatarHora(p.cancelamento.em),
              motivo: p.cancelamento.motivo,
            })}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="titulo-tela">{t('detalhe.titulo', { numero: p.id })}</h1>
            <EtiquetaStatus status={p.status} />
            {p.status === 'FINALIZADO' && <EtiquetaPreparo status={p.preparo.status} />}
          </div>
          {p.cliente && (
            <p className="mt-1 text-[20px] font-bold">
              {t('detalhe.cliente', { nome: p.cliente })}
            </p>
          )}
          <p className="legenda mt-1">
            {t('detalhe.por', {
              data: formatarData(p.criadoEm),
              hora: formatarHora(p.criadoEm),
              usuario: p.usuario.nome,
            })}
          </p>
        </div>
        {podeCancelar && p.status === 'FINALIZADO' && (
          <Botao variante="perigo" onClick={aoCancelar}>
            {t('confirmacao.cancelarBotao')}
          </Botao>
        )}
      </div>

      {p.formaPagamento && (
        <div className="cartao inline-flex w-fit items-center gap-3 px-4 py-3">
          <IconePagamento codigo={p.formaPagamento.codigo} tamanho={24} />
          <div>
            <p className="font-bold">{NOME_PAGAMENTO[p.formaPagamento.codigo]}</p>
            {p.valorRecebido && p.troco && (
              <p className="legenda tabular-nums">
                {t('detalhe.recebido', {
                  recebido: formatarReais(p.valorRecebido),
                  troco: formatarReais(p.troco),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="cartao overflow-x-auto">
        <table className="w-full min-w-[480px] text-left">
          <thead className="legenda">
            <tr>
              <th className="w-16 px-4 py-3 font-semibold">Qtd</th>
              <th className="py-3 font-semibold">Produto</th>
              <th className="py-3 pr-4 text-right font-semibold">Preço unitário</th>
              <th className="py-3 pr-4 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {p.itens.map((i) => (
              <tr key={i.produtoId} className="h-12 border-t border-borda even:bg-creme-escuro/50">
                <td className="px-4 font-bold tabular-nums">{i.quantidade}</td>
                <td>{i.nomeProduto}</td>
                <td className="pr-4 text-right tabular-nums">{formatarReais(i.precoUnitario)}</td>
                <td className="pr-4 text-right font-bold tabular-nums">
                  {formatarReais(i.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="m-3 flex items-center justify-between rounded-padrao border-l-4 border-acao bg-creme-escuro px-4 py-2">
          <span className="font-titulo text-[16px] font-semibold uppercase">
            {t('pedido.total')}
          </span>
          <span
            className={`font-titulo text-[40px] font-semibold leading-[48px] tabular-nums ${cancelado ? 'text-desab-texto line-through' : ''}`}
          >
            {formatarReais(p.total)}
          </span>
        </div>
      </div>
    </>
  );
}

function JanelaCancelamento({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const valido = motivo.trim().length >= LIMITES.motivo.min;

  const cancelar = useMutation({
    mutationFn: () =>
      api<Pedido>(`/pedidos/${pedido.id}/cancelar`, {
        metodo: 'PATCH',
        corpo: { motivo: motivo.trim() },
      }),
    onSuccess: (atualizado) => {
      queryClient.setQueryData(['pedidos', 'detalhe', String(pedido.id)], atualizado);
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      void queryClient.invalidateQueries({ queryKey: ['inicio'] });
      void queryClient.invalidateQueries({ queryKey: ['fila'] });
      avisos.sucesso(t('sucesso.pedidoCancelado', { numero: pedido.id }));
      aoFechar();
    },
    onError: (e: ErroDaApi) => {
      if (e.codigo === 'PEDIDO_JA_CANCELADO') {
        avisos.erro(t('erro.pedidoJaCancelado'));
        void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
        aoFechar();
      } else setErro(e.message);
    },
  });

  return (
    <Janela
      titulo={t('confirmacao.cancelarTitulo', { numero: pedido.id })}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" autoFocus onClick={aoFechar}>
            {t('confirmacao.voltar')}
          </Botao>
          <Botao
            variante="perigo"
            disabled={!valido}
            carregando={cancelar.isPending}
            onClick={() =>
              valido ? cancelar.mutate() : setErro('Escreva o motivo (pelo menos 5 letras)')
            }
          >
            {t('confirmacao.cancelarBotao')}
          </Botao>
        </>
      }
    >
      <p className="mb-4">
        {t('confirmacao.cancelarTexto', { total: formatarReais(pedido.total) })}
      </p>
      <label htmlFor="motivo" className="rotulo mb-1 block">
        {t('detalhe.motivo')}
      </label>
      <textarea
        id="motivo"
        rows={3}
        maxLength={LIMITES.motivo.max}
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value);
          setErro(null);
        }}
        aria-invalid={erro ? true : undefined}
        className={`w-full rounded-padrao border bg-superficie p-3 outline-none focus:border-2 focus:border-acao ${erro ? 'border-2 border-erro' : 'border-borda'}`}
      />
      <div className="mt-1 flex items-start justify-between gap-2">
        <div>{erro && <MensagemErro texto={erro} />}</div>
        <span className="legenda tabular-nums">
          {motivo.length}/{LIMITES.motivo.max}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setMotivo(s);
              setErro(null);
            }}
            className="rounded-full border border-borda bg-superficie px-3 py-1 text-[14px] font-semibold hover:border-moldura"
          >
            {s}
          </button>
        ))}
      </div>
    </Janela>
  );
}
