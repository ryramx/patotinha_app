import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GraduationCap, Lightbulb } from 'lucide-react';
import { Botao } from '../componentes/Botao';
import { Janela } from '../componentes/Janela';
import { t } from '../textos';
import { ajudaDaTela } from './conteudo';
import { useVeAjuda } from './Tutorial';

/**
 * Lâmpada no cabeçalho de toda tela: explica o que fazer nela e como funciona (etapa 12).
 * Os passos seguem o perfil, como os cards do tutorial.
 */
export function BotaoLampada({ aoVerTutorial }: { aoVerTutorial: () => void }) {
  const local = useLocation();
  const ve = useVeAjuda();
  const [aberta, setAberta] = useState(false);
  const ajuda = ajudaDaTela(local.pathname);
  if (!ajuda) return null;
  const passos = ajuda.passos.filter((p) => ve(p.exige));
  const rotulo = `Como funciona: ${ajuda.titulo}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label={rotulo}
        title={rotulo}
        className="flex h-11 w-10 items-center justify-center rounded-full text-aviso hover:bg-aviso-fundo sm:w-11"
      >
        <Lightbulb size={22} aria-hidden fill="currentColor" fillOpacity={0.18} />
      </button>
      {aberta && (
        <Janela
          titulo={rotulo}
          largura={520}
          aoFechar={() => setAberta(false)}
          rodape={
            <>
              <Botao
                variante="texto"
                icone={<GraduationCap size={20} aria-hidden />}
                className="mr-auto"
                onClick={() => {
                  setAberta(false);
                  aoVerTutorial();
                }}
              >
                {t('ajuda.verTutorial')}
              </Botao>
              <Botao variante="principal" autoFocus onClick={() => setAberta(false)}>
                {t('ajuda.entendi')}
              </Botao>
            </>
          }
        >
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="flex items-start gap-3 rounded-padrao bg-aviso-fundo p-3 font-semibold">
              <Lightbulb size={22} aria-hidden className="mt-0.5 shrink-0 text-aviso" />
              {ajuda.resumo}
            </p>
            <ol className="mt-4 flex flex-col gap-3">
              {passos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-moldura text-[14px] font-extrabold text-sobre-moldura"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{p.texto}</span>
                </li>
              ))}
            </ol>
          </div>
        </Janela>
      )}
    </>
  );
}
