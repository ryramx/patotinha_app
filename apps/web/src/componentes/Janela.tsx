import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Botao } from './Botao';
import { t } from '../textos';

/** Prende o foco dentro da janela e fecha com Esc. */
function useFocoPreso(aoFechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Guarda a função num ref: o efeito roda só ao abrir, senão cada nova renderização
  // devolveria o foco ao elemento anterior no meio da digitação.
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const tratar = (e: KeyboardEvent) => {
      // Com janelas empilhadas, só a de cima responde.
      const abertas = document.querySelectorAll('[role="dialog"]');
      if (abertas[abertas.length - 1] !== ref.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fechar.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const focaveis = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focaveis.length) return;
        const primeiro = focaveis[0]!;
        const ultimo = focaveis[focaveis.length - 1]!;
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener('keydown', tratar, true);
    return () => {
      document.removeEventListener('keydown', tratar, true);
      anterior?.focus?.();
    };
  }, []);
  return ref;
}

interface PropsJanela {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: number;
}

/** Janela centralizada de 440 px, sobre véu marrom. */
export function Janela({ titulo, aoFechar, children, rodape, largura = 440 }: PropsJanela) {
  const ref = useFocoPreso(aoFechar);
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-veu p-4"
      onMouseDown={aoFechar}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-janela"
        style={{ width: largura }}
        className="anim-janela max-w-full rounded-grande bg-superficie p-6 shadow-elevada"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="titulo-janela" className="titulo-secao mb-3 normal-case">
          {titulo}
        </h2>
        <div>{children}</div>
        {rodape && <div className="mt-6 flex flex-wrap justify-end gap-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface PropsConfirmacao {
  titulo: string;
  texto: ReactNode;
  confirmar: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
  perigo?: boolean;
  carregando?: boolean;
  voltar?: string;
}

/**
 * Pergunta no título, consequência em uma linha, botões com verbos. Foco inicial em
 * Voltar; Enter não confirma ação destrutiva (interface, "Janela de confirmação").
 */
export function Confirmacao({
  titulo,
  texto,
  confirmar,
  aoConfirmar,
  aoFechar,
  perigo = true,
  carregando,
  voltar = t('confirmacao.voltar'),
}: PropsConfirmacao) {
  return (
    <Janela
      titulo={titulo}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" autoFocus onClick={aoFechar}>
            {voltar}
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'principal'}
            carregando={carregando}
            onClick={aoConfirmar}
            onKeyDown={(e) => {
              if (perigo && e.key === 'Enter') e.preventDefault();
            }}
          >
            {confirmar}
          </Botao>
        </>
      }
    >
      <p>{texto}</p>
    </Janela>
  );
}

interface PropsPainel {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape: ReactNode;
}

/** Painel lateral de formulário: 420 px, desliza da direita, fecha com Esc ou X. */
export function PainelLateral({ titulo, aoFechar, children, rodape }: PropsPainel) {
  const ref = useFocoPreso(aoFechar);
  return createPortal(
    <div className="fixed inset-0 z-30 flex justify-end bg-veu" onMouseDown={aoFechar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-painel"
        className="anim-painel flex h-full w-[420px] max-w-full flex-col bg-superficie shadow-elevada"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-borda px-6 py-4">
          <h2 id="titulo-painel" className="titulo-secao">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label={t('cadastro.fechar')}
            className="flex h-10 w-10 items-center justify-center rounded-padrao hover:bg-creme-escuro"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex justify-end gap-3 border-t border-borda px-6 py-4">{rodape}</div>
      </div>
    </div>,
    document.body,
  );
}
