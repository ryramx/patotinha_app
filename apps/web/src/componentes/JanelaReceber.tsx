import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, QrCode } from 'lucide-react';
import {
  formatarReais,
  paraCentavos,
  type CodigoPagamento,
  type FormaPagamento,
  type Pedido,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../api/cliente';
import { useAvisos } from './Avisos';
import { Botao } from './Botao';
import { CampoDinheiro } from './Campos';
import { IconePagamento, NOME_PAGAMENTO } from './Diversos';
import { Janela } from './Janela';
import { JanelaPix } from './JanelaPix';
import { t } from '../textos';

const ORDEM_FORMAS: CodigoPagamento[] = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'];

interface Props {
  pedido: { id: number; cliente: string | null; total: string };
  aoFechar: () => void;
  aoReceber?: (pedido: Pedido) => void;
}

/** Pagar depois (etapa 14): recebe o pagamento de um pedido que o cliente já comeu. */
export function JanelaReceber({ pedido, aoFechar, aoReceber }: Props) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const formas = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: () => api<FormaPagamento[]>('/formas-pagamento'),
    staleTime: Infinity,
  });
  const [forma, setForma] = useState<CodigoPagamento | null>(null);
  const [recebido, setRecebido] = useState<number | null>(null);
  const [verPix, setVerPix] = useState(false);
  const total = paraCentavos(pedido.total);
  const troco = forma === 'DINHEIRO' && recebido !== null ? recebido - total : null;
  const disponiveis = ORDEM_FORMAS.filter(
    (c) => !formas.data || formas.data.some((f) => f.codigo === c),
  );

  const receber = useMutation({
    mutationFn: () =>
      api<Pedido>(`/pedidos/${pedido.id}/pagamento`, {
        metodo: 'PATCH',
        corpo: {
          formaPagamento: forma,
          valorRecebido:
            forma === 'DINHEIRO' && recebido !== null ? (recebido / 100).toFixed(2) : null,
        },
      }),
    onSuccess: (pago) => {
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      void queryClient.invalidateQueries({ queryKey: ['a-receber'] });
      void queryClient.invalidateQueries({ queryKey: ['inicio'] });
      void queryClient.invalidateQueries({ queryKey: ['fila'] });
      avisos.sucesso(t('receber.recebido', { numero: pago.id, total: formatarReais(pago.total) }));
      aoReceber?.(pago);
      aoFechar();
    },
    onError: (e: ErroDaApi) => {
      if (e.codigo === 'PEDIDO_JA_PAGO' || e.codigo === 'PEDIDO_CANCELADO') {
        void queryClient.invalidateQueries({ queryKey: ['a-receber'] });
        void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      }
      avisos.erro(e.message);
    },
  });

  const falta = troco !== null && troco < 0;
  return (
    <Janela
      titulo={t('receber.titulo', { numero: pedido.id })}
      aoFechar={aoFechar}
      largura={460}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            {t('confirmacao.voltar')}
          </Botao>
          <Botao
            variante="principal"
            icone={<Check size={20} aria-hidden />}
            disabled={!forma || falta}
            carregando={receber.isPending}
            textoCarregando={t('pedido.gravando')}
            onClick={() => receber.mutate()}
          >
            {t('receber.confirmar')}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[16px] font-bold">{pedido.cliente ?? t('fila.semNome')}</span>
          <span className="font-titulo text-[36px] font-semibold leading-[44px] text-total tabular-nums">
            {formatarReais(total)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">
          {disponiveis.map((codigo) => {
            const sel = forma === codigo;
            return (
              <button
                key={codigo}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => {
                  setForma(codigo);
                  if (codigo !== 'DINHEIRO') setRecebido(null);
                }}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-padrao font-bold transition-colors ${
                  sel
                    ? 'border-2 border-moldura bg-moldura/12 text-moldura'
                    : 'border border-borda bg-superficie text-texto-suave hover:border-moldura hover:text-texto'
                }`}
              >
                <IconePagamento codigo={codigo} tamanho={24} />
                {NOME_PAGAMENTO[codigo]}
              </button>
            );
          })}
        </div>
        {forma === 'DINHEIRO' && (
          <div className="flex items-end gap-3">
            <CampoDinheiro
              rotulo={t('pedido.valorRecebido')}
              centavos={recebido}
              aoMudar={setRecebido}
              className="flex-1"
              dica={recebido === null ? t('dica.valorRecebido') : undefined}
            />
            {troco !== null && (
              <p
                role="status"
                className={`mb-2 shrink-0 text-[22px] font-bold tabular-nums ${troco < 0 ? 'text-erro' : 'text-sucesso'}`}
              >
                {troco > 0
                  ? t('pedido.troco', { valor: formatarReais(troco) })
                  : troco === 0
                    ? t('pedido.semTroco')
                    : t('pedido.faltam', { valor: formatarReais(-troco) })}
              </p>
            )}
          </div>
        )}
        {forma === 'PIX' && (
          <Botao
            variante="secundario"
            icone={<QrCode size={20} aria-hidden />}
            onClick={() => setVerPix(true)}
          >
            {t('pix.mostrar')}
          </Botao>
        )}
      </div>
      {verPix && (
        <JanelaPix
          totalCentavos={total}
          identificador={`PEDIDO${pedido.id}`}
          descricao={
            pedido.cliente
              ? t('pix.pedido', { numero: pedido.id, cliente: pedido.cliente })
              : t('detalhe.titulo', { numero: pedido.id })
          }
          aoFechar={() => setVerPix(false)}
        />
      )}
    </Janela>
  );
}
