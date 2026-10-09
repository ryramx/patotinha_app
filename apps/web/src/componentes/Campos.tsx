import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { deCentavos, formatarReais, paraCentavos } from '@patotinha/shared';
import { t } from '../textos';

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string | null;
  dica?: ReactNode;
  direita?: ReactNode;
  esquerda?: ReactNode;
}

export function MensagemErro({ id, texto }: { id?: string; texto: string }) {
  return (
    <p id={id} role="alert" className="mt-1 flex items-center gap-1 text-[14px] text-erro">
      <CircleAlert size={16} aria-hidden /> {texto}
    </p>
  );
}

export const CampoTexto = forwardRef<HTMLInputElement, PropsCampo>(function CampoTexto(
  { rotulo, erro, dica, direita, esquerda, className = '', id, ...resto },
  ref,
) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  const idErro = `${idCampo}-erro`;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="rotulo mb-1 block">
        {rotulo}
      </label>
      <div className="relative flex items-center">
        {esquerda && (
          <span className="pointer-events-none absolute left-3 text-texto-suave">{esquerda}</span>
        )}
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          {...resto}
          className={`h-12 w-full rounded-padrao border bg-superficie px-3 text-[16px] outline-none transition-colors
            hover:border-texto focus:border-2 focus:border-acao disabled:bg-desab-fundo
            ${erro ? 'border-2 border-erro hover:border-erro focus:border-erro' : 'border-borda'}
            ${esquerda ? 'pl-10' : ''} ${direita ? 'pr-12' : ''}`}
        />
        {direita && <span className="absolute right-1">{direita}</span>}
      </div>
      {erro ? (
        <MensagemErro id={idErro} texto={erro} />
      ) : dica ? (
        <p className="legenda mt-1">{dica}</p>
      ) : null}
    </div>
  );
});

export const CampoSenha = forwardRef<HTMLInputElement, Omit<PropsCampo, 'type' | 'direita'>>(
  function CampoSenha(props, ref) {
    const [visivel, setVisivel] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    return (
      <CampoTexto
        ref={ref}
        {...props}
        type={visivel ? 'text' : 'password'}
        onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
        dica={capsLock ? t('dica.capsLock') : props.dica}
        direita={
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? t('login.esconderSenha') : t('login.mostrarSenha')}
            className="flex h-10 w-10 items-center justify-center rounded-padrao text-texto-suave hover:text-texto"
          >
            {visivel ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        }
      />
    );
  },
);

interface PropsDinheiro extends Omit<PropsCampo, 'value' | 'onChange' | 'type'> {
  /** Valor em centavos, ou null quando vazio. */
  centavos: number | null;
  aoMudar: (centavos: number | null) => void;
}

/**
 * Valor em reais com prefixo R$ e digitação da direita para a esquerda, como em caixa:
 * digitar 5, 0, 0, 0 mostra 50,00. Aceita colar "50" ou "50,00".
 */
export const CampoDinheiro = forwardRef<HTMLInputElement, PropsDinheiro>(function CampoDinheiro(
  { centavos, aoMudar, ...resto },
  ref,
) {
  const texto = centavos === null ? '' : formatarReais(centavos).replace('R$', '').trim();
  return (
    <CampoTexto
      ref={ref}
      {...resto}
      inputMode="decimal"
      autoComplete="off"
      esquerda="R$"
      className={`${resto.className ?? ''} [&_input]:text-right [&_input]:tabular-nums`}
      value={texto}
      onPaste={(e) => {
        const colado = e.clipboardData.getData('text').replace(/[R$\s.]/g, '');
        try {
          aoMudar(paraCentavos(colado.replace(',', '.')));
          e.preventDefault();
        } catch {
          e.preventDefault();
        }
      }}
      onKeyDown={(e) => {
        resto.onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          const novo = (centavos ?? 0) * 10 + Number(e.key);
          if (novo <= 9_999_999_99) aoMudar(novo);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          const novo = Math.floor((centavos ?? 0) / 10);
          aoMudar(novo === 0 ? null : novo);
        } else if (e.key === 'Delete') {
          e.preventDefault();
          aoMudar(null);
        }
      }}
      onChange={(e) => {
        // Celular sem keydown confiável: interpreta só os dígitos digitados.
        const digitos = e.target.value.replace(/\D/g, '');
        aoMudar(digitos ? Number(digitos) : null);
      }}
    />
  );
});

/** Converte texto digitado num preço ("8,50") para a string da API ("8.50"). */
export function textoParaPreco(texto: string): string | null {
  try {
    return deCentavos(paraCentavos(texto.replace(/[R$\s.]/g, '').replace(',', '.')));
  } catch {
    return null;
  }
}
