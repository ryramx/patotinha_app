import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { NOMES_PERFIL } from '@patotinha/shared';
import { primeiroNome, useSessao } from '../auth/sessao';
import { Botao } from '../componentes/Botao';
import { useFocoPreso } from '../componentes/Janela';
import { CARDS_TUTORIAL, type Exige } from './conteudo';

/** Filtra pelo perfil: quem não abre a tela não vê o card (nem o passo) dela. */
export function useVeAjuda() {
  const { eAdmin, pode } = useSessao();
  return (exige?: Exige) => !exige || exige.some((p) => (p === 'ADMIN' ? eAdmin : pode(p)));
}

/**
 * Tutorial de primeiro acesso: cards um a um, com o que cada parte do sistema faz.
 * Abre sozinho uma vez por usuário; Pular, Esc ou Começar a usar fecham e marcam como visto.
 */
export function Tutorial({ aoFechar }: { aoFechar: () => void }) {
  const { usuario } = useSessao();
  const ve = useVeAjuda();
  const cards = CARDS_TUTORIAL.filter((c) => ve(c.exige));
  const [indice, setIndice] = useState(0);
  const ref = useFocoPreso(aoFechar);
  const toque = useRef<number | null>(null);

  const card = cards[indice]!;
  const ultimo = indice === cards.length - 1;
  const total = cards.length;
  const trocar = (n: number) => setIndice(Math.min(total - 1, Math.max(0, n)));

  // Setas do teclado trocam de card (fora de campos de texto, que o tutorial não tem).
  useEffect(() => {
    const tratar = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(total - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', tratar);
    return () => document.removeEventListener('keydown', tratar);
  }, [total]);
  const preencher = (texto: string) =>
    texto
      .replace('{nome}', primeiroNome(usuario?.nome ?? ''))
      .replace('{perfil}', usuario ? NOMES_PERFIL[usuario.perfil] : '');

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-veu p-3 sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-roledescription="tutorial"
        aria-labelledby="titulo-tutorial"
        aria-describedby="texto-tutorial"
        className="anim-janela relative w-[480px] max-w-full overflow-hidden rounded-grande bg-superficie shadow-elevada"
        onTouchStart={(e) => {
          toque.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const inicio = toque.current;
          const fim = e.changedTouches[0]?.clientX;
          toque.current = null;
          if (inicio === null || fim === undefined || Math.abs(fim - inicio) < 50) return;
          trocar(fim < inicio ? indice + 1 : indice - 1);
        }}
      >
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar o tutorial"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-texto-suave hover:bg-creme-escuro hover:text-texto"
        >
          <X size={22} aria-hidden />
        </button>

        {/* A faixa de cima leva a cor de destaque: vermelho no claro, dourado no escuro. */}
        <div className="flex flex-col items-center gap-3 bg-moldura/10 px-6 pb-6 pt-8">
          <span
            key={card.id}
            className="anim-janela flex h-20 w-20 items-center justify-center rounded-full bg-moldura text-sobre-moldura shadow-elevada"
            aria-hidden
          >
            <card.Icone size={40} strokeWidth={2.2} />
          </span>
          <p className="legenda" aria-live="polite">
            {indice + 1} de {cards.length}
          </p>
        </div>

        <div className="px-6 pb-2 pt-5 text-center">
          <h2 id="titulo-tutorial" className="text-[21px] font-extrabold leading-7">
            {preencher(card.titulo)}
          </h2>
          <p id="texto-tutorial" className="mt-3 min-h-[96px] text-[16px] text-texto-suave">
            {preencher(card.texto)}
          </p>
        </div>

        <div className="flex justify-center gap-1.5 py-3" aria-hidden>
          {cards.map((c, i) => (
            <span
              key={c.id}
              className={`h-2 rounded-full transition-all ${i === indice ? 'w-6 bg-moldura' : 'w-2 bg-borda'}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-borda px-4 py-4 sm:px-6">
          {ultimo ? (
            <span />
          ) : (
            <Botao variante="texto" onClick={aoFechar}>
              Pular
            </Botao>
          )}
          <div className="ml-auto flex gap-2">
            {indice > 0 && (
              <Botao
                variante="secundario"
                icone={<ChevronLeft size={20} aria-hidden />}
                onClick={() => trocar(indice - 1)}
              >
                <span className="max-sm:sr-only">Voltar</span>
              </Botao>
            )}
            {ultimo ? (
              <Botao variante="principal" autoFocus onClick={aoFechar}>
                Começar a usar
              </Botao>
            ) : (
              <Botao variante="principal" autoFocus onClick={() => trocar(indice + 1)}>
                Próximo <ChevronRight size={20} aria-hidden />
              </Botao>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
