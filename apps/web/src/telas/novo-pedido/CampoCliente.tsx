import { useEffect, useId, useState, type RefObject } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Phone, UserRound } from 'lucide-react';
import { chaveCliente, formatarTelefone, LIMITES, type ClienteSugerido } from '@patotinha/shared';
import { api } from '../../api/cliente';
import { CampoTexto } from '../../componentes/Campos';
import { t } from '../../textos';

interface Props {
  nome: string;
  telefone: string;
  erroTelefone: string | null;
  refNome: RefObject<HTMLInputElement | null>;
  aoMudarNome: (nome: string) => void;
  aoMudarTelefone: (telefone: string) => void;
  aoEscolher: (cliente: ClienteSugerido) => void;
}

/** Máscara do telefone enquanto digita: (11) 9876-5432 ou (11) 98765-4321. */
export function mascararTelefone(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const meio = d.length === 11 ? 7 : 6;
  if (d.length <= meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}

/**
 * Nome do cliente com sugestões de quem já pediu (cadastro leve de clientes) e telefone
 * opcional. Digitar um nome novo continua funcionando como antes: o cliente é cadastrado
 * sozinho quando o pedido é finalizado.
 */
export function CampoCliente(props: Props) {
  const idLista = useId();
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const [mostrarTelefone, setMostrarTelefone] = useState(false);
  const [termo, setTermo] = useState('');

  // Espera a pessoa parar de digitar um instante antes de buscar.
  useEffect(() => {
    const espera = setTimeout(() => setTermo(props.nome.trim()), 200);
    return () => clearTimeout(espera);
  }, [props.nome]);

  // Pedido finalizado ou limpo: o telefone volta a ficar escondido.
  useEffect(() => {
    if (!props.nome && !props.telefone) setMostrarTelefone(false);
  }, [props.nome, props.telefone]);

  const busca = useQuery({
    queryKey: ['clientes', termo],
    queryFn: ({ signal }) =>
      api<{ dados: ClienteSugerido[] }>(`/clientes?busca=${encodeURIComponent(termo)}`, {
        sinal: signal,
      }),
    enabled: termo.length > 0,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const chave = chaveCliente(props.nome);
  const sugestoes = props.nome.trim() ? (busca.data?.dados ?? []) : [];
  // Só o próprio nome já escolhido: não há o que sugerir.
  const soOEscolhido = sugestoes.length === 1 && chaveCliente(sugestoes[0]!.nome) === chave;
  const visivel = aberta && sugestoes.length > 0 && !soOEscolhido;

  const escolher = (cliente: ClienteSugerido) => {
    props.aoEscolher(cliente);
    setMostrarTelefone(false);
    setAberta(false);
    setAtiva(-1);
  };

  return (
    <div>
      <div className="relative">
        <CampoTexto
          ref={props.refNome}
          rotulo={t('pedido.cliente')}
          value={props.nome}
          maxLength={LIMITES.clienteNome.max}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visivel}
          aria-controls={idLista}
          aria-activedescendant={visivel && ativa >= 0 ? `${idLista}-${ativa}` : undefined}
          esquerda={<UserRound size={20} aria-hidden />}
          dica={t('pedido.clienteDica')}
          onChange={(e) => {
            props.aoMudarNome(e.target.value);
            setAberta(true);
            setAtiva(-1);
          }}
          onFocus={() => setAberta(true)}
          onBlur={() => setAberta(false)}
          onKeyDown={(e) => {
            if (!visivel) {
              if (e.key === 'ArrowDown' && sugestoes.length > 0) {
                e.preventDefault();
                setAberta(true);
                setAtiva(0);
              }
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAtiva((i) => (i + 1) % sugestoes.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtiva((i) => (i <= 0 ? sugestoes.length - 1 : i - 1));
            } else if (e.key === 'Enter' && !e.ctrlKey && ativa >= 0) {
              e.preventDefault();
              escolher(sugestoes[ativa]!);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setAberta(false);
            }
          }}
        />
        {visivel && (
          <ul
            id={idLista}
            role="listbox"
            aria-label={t('pedido.sugestoes')}
            className="absolute inset-x-0 top-[76px] z-20 max-h-72 overflow-y-auto rounded-padrao border border-borda bg-superficie py-1 shadow-elevada"
          >
            {sugestoes.map((c, i) => (
              <li
                key={c.id}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === ativa}
                // mousedown em vez de click: o campo não perde o foco antes da escolha.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(c);
                }}
                onMouseEnter={() => setAtiva(i)}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                  i === ativa ? 'bg-creme-escuro' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{c.nome}</span>
                  {c.telefone && (
                    <span className="legenda block tabular-nums">
                      {formatarTelefone(c.telefone)}
                    </span>
                  )}
                </span>
                <span className="legenda shrink-0">
                  {c.pedidos === 1
                    ? t('pedido.umPedidoCliente')
                    : t('pedido.pedidosCliente', { quantidade: c.pedidos })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mostrarTelefone ? (
        <CampoTexto
          className="mt-2"
          rotulo={t('pedido.telefone')}
          value={props.telefone}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(11) 98765-4321"
          esquerda={<Phone size={20} aria-hidden />}
          erro={props.erroTelefone}
          onChange={(e) => props.aoMudarTelefone(mascararTelefone(e.target.value))}
        />
      ) : props.telefone ? (
        // Telefone que veio do cadastro: uma linha só, para não roubar espaço dos itens.
        <p className="mt-1 flex min-h-10 items-center gap-2 text-[14px]">
          <Phone size={16} aria-hidden className="text-texto-suave" />
          <span className="tabular-nums" data-testid="telefone-cliente">
            {props.telefone}
          </span>
          <button
            type="button"
            className="font-bold text-moldura hover:underline"
            onClick={() => setMostrarTelefone(true)}
          >
            {t('pedido.trocarTelefone')}
          </button>
        </p>
      ) : (
        props.nome.trim() !== '' && (
          <button
            type="button"
            className="mt-1 flex min-h-10 items-center gap-1 text-[14px] font-bold text-moldura hover:underline"
            onClick={() => setMostrarTelefone(true)}
          >
            <Phone size={16} aria-hidden />
            {t('pedido.adicionarTelefone')}
          </button>
        )
      )}
    </div>
  );
}
