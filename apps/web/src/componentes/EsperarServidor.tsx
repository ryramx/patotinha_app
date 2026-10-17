import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Botao } from './Botao';
import { t } from '../textos';

/**
 * Tela "Carregando…" enquanto a API acorda (Plano, etapa 9).
 *
 * O site fica num Static Site do Render, que nunca dorme; a API fica num serviço gratuito que
 * desliga depois de 15 minutos parado e leva cerca de 1 minuto para voltar. Antes de mostrar
 * qualquer tela, perguntamos a /api/vivo (não toca no banco) até ela responder.
 * Toda a aparência está em TelaCarregando, para ser fácil de reestilizar.
 */

const INTERVALO_MS = 2_000;
const TEMPO_POR_TENTATIVA_MS = 15_000;
/** Depois disso, para de tentar sozinho e oferece "Tentar de novo". */
const DESISTIR_DEPOIS_MS = 150_000;
/** Respostas rápidas não mostram a mensagem de "acordando", só a logo. */
const AVISAR_DEPOIS_MS = 2_500;

type Estado = 'conferindo' | 'acordando' | 'falhou' | 'pronto';

async function servidorAcordado(): Promise<boolean> {
  try {
    const resposta = await fetch('/api/vivo', {
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_POR_TENTATIVA_MS),
    });
    if (!resposta.ok) return false;
    // Enquanto acorda, o Render pode devolver uma página HTML própria em vez do JSON.
    const corpo = (await resposta.json().catch(() => null)) as { status?: string } | null;
    return corpo?.status === 'ok';
  } catch {
    return false;
  }
}

export function EsperarServidor({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('conferindo');
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    let ativo = true;
    const inicio = Date.now();
    // Só troca "conferindo" por "acordando": se a API já respondeu, o aviso não pode tirar a
    // tela do ar.
    const aviso = setTimeout(
      () => ativo && setEstado((e) => (e === 'conferindo' ? 'acordando' : e)),
      AVISAR_DEPOIS_MS,
    );

    (async () => {
      while (ativo) {
        if (await servidorAcordado()) {
          clearTimeout(aviso);
          if (ativo) setEstado('pronto');
          return;
        }
        if (!ativo) return;
        if (Date.now() - inicio > DESISTIR_DEPOIS_MS) {
          setEstado('falhou');
          return;
        }
        setEstado('acordando');
        await new Promise((r) => setTimeout(r, INTERVALO_MS));
      }
    })();

    return () => {
      ativo = false;
      clearTimeout(aviso);
    };
  }, [rodada]);

  const tentarDeNovo = useCallback(() => {
    setEstado('acordando');
    setRodada((n) => n + 1);
  }, []);

  if (estado === 'pronto') return children;
  return <TelaCarregando estado={estado} aoTentarDeNovo={tentarDeNovo} />;
}

export function TelaCarregando({
  estado,
  aoTentarDeNovo,
}: {
  estado: Exclude<Estado, 'pronto'>;
  aoTentarDeNovo?: () => void;
}) {
  return (
    <main
      className="flex h-full flex-col items-center justify-center gap-6 bg-marca px-6 text-center text-sobre-marca"
      aria-busy={estado !== 'falhou'}
    >
      <img
        src="/logo.webp"
        alt={t('sistema.nome')}
        className={`w-44 ${estado === 'falhou' ? '' : 'animate-pulse'}`}
      />
      {estado === 'acordando' && (
        <div role="status" className="max-w-sm space-y-2">
          <p className="text-xl font-semibold">{t('carregando.titulo')}</p>
          <p className="text-sobre-marca/80">{t('carregando.acordando')}</p>
        </div>
      )}
      {estado === 'falhou' && (
        <div role="alert" className="max-w-sm space-y-4">
          <p className="text-xl font-semibold">{t('carregando.falhouTitulo')}</p>
          <p className="text-sobre-marca/80">{t('carregando.falhou')}</p>
          <Botao variante="principal" onClick={aoTentarDeNovo}>
            {t('carregando.tentarDeNovo')}
          </Botao>
        </div>
      )}
    </main>
  );
}
