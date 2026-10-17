import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import {
  formatarHora,
  type FilaPreparo,
  type Pedido,
  type PedidoNaFila,
  type StatusPreparo,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../api/cliente';
import { useSessao } from '../auth/sessao';
import { useAvisos } from '../componentes/Avisos';
import { Botao } from '../componentes/Botao';
import { EtiquetaPreparo, LinhasEsqueleto, NOME_PREPARO, Vazio } from '../componentes/Diversos';
import { t } from '../textos';

/** Colunas da comanda, na ordem do preparo; cada uma diz qual é o próximo passo. */
const COLUNAS: { status: StatusPreparo; proximo: StatusPreparo; acao: string }[] = [
  { status: 'AGUARDANDO', proximo: 'PREPARANDO', acao: t('fila.comecar') },
  { status: 'PREPARANDO', proximo: 'PRONTO', acao: t('fila.marcarPronto') },
  { status: 'PRONTO', proximo: 'ENTREGUE', acao: t('fila.entregar') },
];
const ANTERIOR: Partial<Record<StatusPreparo, StatusPreparo>> = {
  PREPARANDO: 'AGUARDANDO',
  PRONTO: 'PREPARANDO',
  ENTREGUE: 'PRONTO',
};

/** Minutos desde a chegada, para a cozinha ver quem espera há mais tempo. */
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

function espera(criadoEm: string, agora: number) {
  const minutos = Math.floor((agora - new Date(criadoEm).getTime()) / 60_000);
  return minutos < 1 ? t('fila.agora') : t('fila.ha', { minutos });
}

export function Fila() {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const agora = useAgora();

  // Vários aparelhos (balcão e cozinha) olham a mesma fila: atualiza sozinha.
  const fila = useQuery({
    queryKey: ['fila'],
    queryFn: () => api<FilaPreparo>('/fila'),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const mudar = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusPreparo }) =>
      api<Pedido>(`/pedidos/${id}/preparo`, { metodo: 'PATCH', corpo: { status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fila'] });
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
    onError: (e: ErroDaApi) => {
      avisos.erro(e.codigo === 'PEDIDO_CANCELADO' ? t('fila.pedidoCancelado') : e.message);
      void queryClient.invalidateQueries({ queryKey: ['fila'] });
    },
  });

  if (fila.isPending) {
    return (
      <div className="p-4 md:p-6">
        <LinhasEsqueleto linhas={6} altura="h-24" />
      </div>
    );
  }
  if (fila.isError) {
    return (
      <p className="p-4 text-erro md:p-6" role="alert">
        {fila.error.message}
      </p>
    );
  }

  const { dados, entreguesRecentes } = fila.data;
  const ocupado = (id: number) => mudar.isPending && mudar.variables?.id === id;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">{t('fila.naFila', { quantidade: dados.length })}</p>
        <p className="legenda">{t('fila.atualizado')}</p>
      </div>

      {dados.length === 0 ? (
        <Vazio texto={t('dica.filaVazia')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUNAS.map((coluna) => {
            const pedidos = dados.filter((p) => p.preparo.status === coluna.status);
            return (
              <section
                key={coluna.status}
                aria-label={NOME_PREPARO[coluna.status]}
                className="flex flex-col gap-3"
              >
                <h2 className="titulo-secao flex items-center gap-2">
                  {NOME_PREPARO[coluna.status]}
                  <span className="legenda">({pedidos.length})</span>
                </h2>
                {pedidos.map((p) => (
                  <CartaoComanda
                    key={p.id}
                    pedido={p}
                    posicao={dados.indexOf(p) + 1}
                    agora={agora}
                    acao={coluna.acao}
                    ocupado={ocupado(p.id)}
                    aoAvancar={() => mudar.mutate({ id: p.id, status: coluna.proximo })}
                    aoVoltar={
                      ANTERIOR[coluna.status]
                        ? () => mudar.mutate({ id: p.id, status: ANTERIOR[coluna.status]! })
                        : undefined
                    }
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {entreguesRecentes.length > 0 && (
        <section className="cartao p-4" aria-labelledby="titulo-entregues">
          <h2 id="titulo-entregues" className="titulo-secao mb-2">
            {t('fila.entreguesRecentes')}
          </h2>
          <ul>
            {entreguesRecentes.map((p) => (
              <li
                key={p.id}
                className="flex min-h-12 items-center gap-3 border-t border-borda first:border-t-0"
              >
                <span className="font-bold tabular-nums">Nº {p.id}</span>
                <span className="min-w-0 flex-1 truncate">{p.cliente ?? t('fila.semNome')}</span>
                <EtiquetaPreparo status="ENTREGUE" />
                <Botao
                  variante="texto"
                  icone={<Undo2 size={18} aria-hidden />}
                  carregando={ocupado(p.id)}
                  onClick={() => mudar.mutate({ id: p.id, status: 'PRONTO' })}
                >
                  {t('fila.desfazerEntrega')}
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CartaoComanda({
  pedido,
  posicao,
  agora,
  acao,
  ocupado,
  aoAvancar,
  aoVoltar,
}: {
  pedido: PedidoNaFila;
  posicao: number;
  agora: number;
  acao: string;
  ocupado: boolean;
  aoAvancar: () => void;
  aoVoltar?: () => void;
}) {
  const pronto = pedido.preparo.status === 'PRONTO';
  // O Chef vê a comanda; o detalhe do pedido (valores, pagamento) depende de "Ver pedidos".
  const verPedido = useSessao().pode('PEDIDOS_VER');
  return (
    <article
      aria-label={`Pedido nº ${pedido.id}, ${pedido.cliente ?? t('fila.semNome')}`}
      className={`cartao flex flex-col gap-2 p-4 ${pronto ? 'border-2 border-sucesso' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-titulo text-[24px] font-semibold leading-8">
            {pedido.cliente ?? t('fila.semNome')}
          </p>
          <p className="legenda tabular-nums">
            {verPedido ? (
              <Link
                to={`/pedidos/${pedido.id}`}
                state={{ voltar: '/fila' }}
                className="font-bold text-moldura underline-offset-4 hover:underline"
              >
                Nº {pedido.id}
              </Link>
            ) : (
              <span className="font-bold">Nº {pedido.id}</span>
            )}{' '}
            · {formatarHora(pedido.criadoEm)} · {espera(pedido.criadoEm, agora)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full bg-creme-escuro px-2 py-0.5 text-[14px] font-bold tabular-nums"
          title="Posição na fila"
        >
          {t('fila.posicao', { posicao })}
        </span>
      </div>
      <ul className="text-[18px]">
        {pedido.itens.map((i) => (
          <li key={i.nomeProduto} className="flex gap-2">
            <span className="w-8 shrink-0 text-right font-bold tabular-nums">{i.quantidade}×</span>
            <span>{i.nomeProduto}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Botao variante="principal" className="flex-1" carregando={ocupado} onClick={aoAvancar}>
          {acao}
        </Botao>
        {aoVoltar && (
          <Botao variante="texto" disabled={ocupado} onClick={aoVoltar}>
            {t('fila.voltarEtapa')}
          </Botao>
        )}
      </div>
    </article>
  );
}
