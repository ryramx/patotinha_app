import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

type Variante = 'principal' | 'secundario' | 'perigo' | 'texto' | 'moldura';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  textoCarregando?: string;
  icone?: ReactNode;
  tamanho?: 'normal' | 'grande';
}

const estilos: Record<Variante, string> = {
  // Dourado só na ação principal da tela; texto sempre Marrom Torrado (contraste AA).
  principal:
    'bg-acao text-texto-acao font-bold hover:bg-acao-hover active:brightness-[.92] active:translate-y-px disabled:bg-desab-fundo disabled:text-desab-texto disabled:hover:bg-desab-fundo',
  secundario:
    'border-[1.5px] border-moldura text-moldura bg-transparent hover:bg-moldura/6 active:bg-moldura/12 disabled:border-desab-texto disabled:text-desab-texto',
  perigo:
    'border-[1.5px] border-erro text-erro bg-transparent hover:bg-erro/6 active:bg-erro/12 disabled:border-desab-texto disabled:text-desab-texto',
  texto: 'text-moldura underline-offset-4 hover:underline disabled:text-desab-texto',
  moldura: 'text-sobre-moldura hover:bg-moldura-escura',
};

/** Girador só depois de 300 ms, para não piscar em respostas rápidas. */
function useGiradorAtrasado(ativo: boolean) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    if (!ativo) {
      setMostrar(false);
      return;
    }
    const id = setTimeout(() => setMostrar(true), 300);
    return () => clearTimeout(id);
  }, [ativo]);
  return mostrar;
}

export function Botao({
  variante = 'secundario',
  carregando = false,
  textoCarregando,
  icone,
  tamanho = 'normal',
  className = '',
  children,
  disabled,
  ...resto
}: Props) {
  const girador = useGiradorAtrasado(carregando);
  const altura =
    variante === 'texto'
      ? ''
      : tamanho === 'grande'
        ? 'min-h-14 px-6 text-[18px]'
        : 'min-h-12 px-4';
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-padrao font-bold transition-colors duration-150 ${altura} ${estilos[variante]} ${className}`}
    >
      {carregando && girador ? (
        <LoaderCircle size={16} className="animate-spin" aria-hidden />
      ) : (
        icone
      )}
      {carregando && textoCarregando ? textoCarregando : children}
    </button>
  );
}
