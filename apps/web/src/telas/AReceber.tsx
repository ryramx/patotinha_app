import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandCoins } from 'lucide-react';
import {
  formatarData,
  formatarHora,
  formatarReais,
  diaEmSaoPaulo,
  paraCentavos,
  type PedidoAReceber,
} from '@patotinha/shared';
import { api } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import { EtiquetaPreparo, LinhasEsqueleto, Vazio } from '../componentes/Diversos';
import { JanelaReceber } from '../componentes/JanelaReceber';
import { t } from '../textos';

/** Pagar depois (etapa 14): pedidos que o cliente vai pagar no fim, para cobrar. */
export function AReceber() {
  const [recebendo, setRecebendo] = useState<PedidoAReceber | null>(null);
  const lista = useQuery({
    queryKey: ['a-receber'],
    queryFn: () => api<{ dados: PedidoAReceber[] }>('/pedidos/a-receber'),
    // O balcão acompanha a cozinha: atualiza sozinho, como a fila.
    refetchInterval: 15_000,
  });
  const pedidos = lista.data?.dados ?? [];
  const soma = pedidos.reduce((s, p) => s + paraCentavos(p.total), 0);
  const hoje = diaEmSaoPaulo();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-texto-suave">{t('receber.intro')}</p>
        {pedidos.length > 0 && (
          <p className="font-bold tabular-nums" role="status">
            {t('receber.soma', { quantidade: pedidos.length, total: formatarReais(soma) })}
          </p>
        )}
      </div>
      {lista.isPending ? (
        <div className="cartao p-4">
          <LinhasEsqueleto linhas={4} />
        </div>
      ) : lista.isError ? (
        <p className="text-erro" role="alert">
          {lista.error.message}
        </p>
      ) : pedidos.length === 0 ? (
        <Vazio texto={t('receber.vazio')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pedidos.map((p) => {
            const pronto = p.preparo.status === 'PRONTO' || p.preparo.status === 'ENTREGUE';
            const dia = diaEmSaoPaulo(p.criadoEm) === hoje ? '' : `${formatarData(p.criadoEm)} · `;
            return (
              <article
                key={p.id}
                aria-label={`Pedido nº ${p.id}, ${p.cliente ?? t('fila.semNome')}`}
                className={`cartao flex flex-col gap-2 p-4 ${pronto ? 'border-2 border-moldura' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-titulo text-[24px] font-semibold leading-8">
                      {p.cliente ?? t('fila.semNome')}
                    </p>
                    <p className="legenda tabular-nums">
                      Nº {p.id} · {dia}
                      {formatarHora(p.criadoEm)}
                    </p>
                  </div>
                  <EtiquetaPreparo status={p.preparo.status} />
                </div>
                <p className="text-[15px] text-texto-suave">
                  {p.itens.map((i) => `${i.quantidade}× ${i.nomeProduto}`).join(', ')}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-titulo text-[28px] font-semibold text-total tabular-nums">
                    {formatarReais(p.total)}
                  </span>
                  <Botao
                    variante={pronto ? 'principal' : 'secundario'}
                    icone={<HandCoins size={20} aria-hidden />}
                    onClick={() => setRecebendo(p)}
                  >
                    {t('receber.receber')}
                  </Botao>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {recebendo && <JanelaReceber pedido={recebendo} aoFechar={() => setRecebendo(null)} />}
    </div>
  );
}
