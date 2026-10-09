import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleCheck, TriangleAlert, OctagonX, X } from 'lucide-react';

type Tipo = 'sucesso' | 'aviso' | 'erro';

interface Aviso {
  id: number;
  tipo: Tipo;
  texto: string;
  acao?: { rotulo: string; executar: () => void };
  fixo?: boolean;
}

interface OpcoesAviso {
  acao?: Aviso['acao'];
  duracaoMs?: number;
  fixo?: boolean;
}

interface ContextoAvisos {
  sucesso: (texto: string, opcoes?: OpcoesAviso) => number;
  aviso: (texto: string, opcoes?: OpcoesAviso) => number;
  erro: (texto: string, opcoes?: OpcoesAviso) => number;
  fechar: (id: number) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

// Sucesso some em 4 s, aviso em 6 s, erro só ao fechar; no máximo 3 empilhados.
const DURACAO: Record<Tipo, number | null> = { sucesso: 4000, aviso: 6000, erro: null };
const ICONE = { sucesso: CircleCheck, aviso: TriangleAlert, erro: OctagonX };
const COR: Record<Tipo, string> = {
  sucesso: 'bg-sucesso-fundo text-sucesso border-sucesso',
  aviso: 'bg-aviso-fundo text-aviso border-aviso',
  erro: 'bg-erro-fundo text-erro border-erro',
};

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximo = useRef(1);

  const fechar = useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);

  const mostrar = useCallback(
    (tipo: Tipo, texto: string, opcoes: OpcoesAviso = {}) => {
      const id = proximo.current++;
      setAvisos((l) => [...l, { id, tipo, texto, acao: opcoes.acao, fixo: opcoes.fixo }].slice(-3));
      const duracao = opcoes.fixo ? null : (opcoes.duracaoMs ?? DURACAO[tipo]);
      if (duracao) setTimeout(() => fechar(id), duracao);
      return id;
    },
    [fechar],
  );

  const valor = useMemo(
    () => ({
      sucesso: (texto: string, o?: OpcoesAviso) => mostrar('sucesso', texto, o),
      aviso: (texto: string, o?: OpcoesAviso) => mostrar('aviso', texto, o),
      erro: (texto: string, o?: OpcoesAviso) => mostrar('erro', texto, o),
      fechar,
    }),
    [mostrar, fechar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        className="nao-imprimir pointer-events-none fixed left-1/2 top-3 z-50 flex w-[400px] max-w-[calc(100vw-24px)] -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
      >
        {avisos.map((a) => {
          const Icone = ICONE[a.tipo];
          return (
            <div
              key={a.id}
              role={a.tipo === 'erro' ? 'alert' : 'status'}
              className={`anim-toast pointer-events-auto flex items-start gap-3 rounded-padrao border-l-4 px-4 py-3 shadow-elevada ${COR[a.tipo]}`}
            >
              <Icone size={20} className="mt-0.5 shrink-0" aria-hidden />
              <p className="flex-1 font-semibold text-texto">{a.texto}</p>
              {a.acao && (
                <button
                  type="button"
                  className="font-bold underline underline-offset-4"
                  onClick={() => {
                    a.acao!.executar();
                    fechar(a.id);
                  }}
                >
                  {a.acao.rotulo}
                </button>
              )}
              <button
                type="button"
                onClick={() => fechar(a.id)}
                aria-label="Fechar aviso"
                className="text-texto-suave hover:text-texto"
              >
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAvisos fora do ProvedorAvisos');
  return ctx;
}
