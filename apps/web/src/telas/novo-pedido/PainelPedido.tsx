import { useEffect, useRef, useState, type RefObject } from 'react';
import { Check, Minus, Plus, Trash2, TriangleAlert, UserRound, X } from 'lucide-react';
import {
  formatarReais,
  LIMITES,
  type CodigoPagamento,
  type FormaPagamento,
} from '@patotinha/shared';
import { Botao } from '../../componentes/Botao';
import { CampoDinheiro, CampoTexto } from '../../componentes/Campos';
import { IconePagamento, NOME_PAGAMENTO } from '../../componentes/Diversos';
import { t } from '../../textos';
import type { ItemRascunho, Rascunho } from './rascunho';

export type Problema = { tipo: 'preco'; de: number; para: number } | { tipo: 'indisponivel' };

interface Props {
  rascunho: Rascunho;
  formas: FormaPagamento[];
  totalCentavos: number;
  problemas: Map<number, Problema>;
  piscando: { produtoId: number; novo: boolean; vez: number } | null;
  enviando: boolean;
  semConexao: boolean;
  dicaFinalizar: string | null;
  refCliente: RefObject<HTMLInputElement | null>;
  aoMudarCliente: (nome: string) => void;
  aoMudarQuantidade: (produtoId: number, quantidade: number) => void;
  aoRemover: (produtoId: number) => void;
  aoEscolherForma: (forma: CodigoPagamento) => void;
  aoMudarRecebido: (centavos: number | null) => void;
  aoFinalizar: () => void;
  aoLimpar: () => void;
  aoFecharCelular: () => void;
}

const ORDEM_FORMAS: CodigoPagamento[] = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'];
const TECLA: Record<CodigoPagamento, string> = {
  DINHEIRO: 'F2',
  PIX: 'F3',
  DEBITO: 'F4',
  CREDITO: 'F5',
};

export function PainelPedido(props: Props) {
  const { rascunho, totalCentavos, problemas, piscando } = props;
  const refLista = useRef<HTMLUListElement>(null);
  const unidades = rascunho.itens.reduce((s, i) => s + i.quantidade, 0);

  // Item novo: a lista rola até ele.
  useEffect(() => {
    if (piscando?.novo) refLista.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [piscando]);

  const formasDisponiveis = ORDEM_FORMAS.filter(
    (codigo) => props.formas.length === 0 || props.formas.some((f) => f.codigo === codigo),
  );
  const troco =
    rascunho.forma === 'DINHEIRO' && rascunho.recebidoCentavos !== null
      ? rascunho.recebidoCentavos - totalCentavos
      : null;

  return (
    <div className="cartao flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between border-b border-borda px-4 py-3">
        <h2 className="titulo-secao">{t('pedido.titulo')}</h2>
        <div className="flex items-center gap-2">
          {rascunho.itens.length > 0 && (
            <span className="legenda">
              {rascunho.itens.length === 1
                ? t('pedido.umItem', { unidades })
                : t('pedido.itens', { itens: rascunho.itens.length, unidades })}
            </span>
          )}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center md:hidden"
            aria-label={t('cadastro.fechar')}
            onClick={props.aoFecharCelular}
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Comanda: nome para chamar o cliente quando o pedido ficar pronto. */}
      <div className="border-b border-borda px-4 py-3">
        <CampoTexto
          ref={props.refCliente}
          rotulo={t('pedido.cliente')}
          value={rascunho.cliente}
          maxLength={LIMITES.clienteNome.max}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          esquerda={<UserRound size={20} aria-hidden />}
          dica={t('pedido.clienteDica')}
          onChange={(e) => props.aoMudarCliente(e.target.value)}
        />
      </div>

      {/* Lista de itens: rola sozinha; o rodapé nunca rola. */}
      {rascunho.itens.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-[40px]" aria-hidden>
            🥟
          </span>
          <p className="enfeite text-[22px] leading-8 text-moldura">{t('dica.painelVazio')}</p>
        </div>
      ) : (
        <ul ref={refLista} className="min-h-0 flex-1 overflow-y-auto" aria-label="Itens do pedido">
          {rascunho.itens.map((item) => (
            <LinhaItem
              key={item.produtoId}
              item={item}
              problema={problemas.get(item.produtoId)}
              piscar={piscando?.produtoId === item.produtoId ? piscando : null}
              aoMudar={(q) => props.aoMudarQuantidade(item.produtoId, q)}
              aoRemover={() => props.aoRemover(item.produtoId)}
            />
          ))}
        </ul>
      )}

      <div className="shrink-0 border-t border-borda px-4 pb-3 pt-3">
        <div className="flex items-center justify-between rounded-padrao border-l-4 border-acao bg-creme-escuro px-4 py-2">
          <span className="font-titulo text-[16px] font-semibold uppercase">
            {t('pedido.total')}
          </span>
          <span
            key={totalCentavos}
            className="anim-total font-titulo text-[40px] font-semibold leading-[48px] tabular-nums"
            data-testid="total"
          >
            {formatarReais(totalCentavos)}
          </span>
        </div>

        <div
          className="mt-3 grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Forma de pagamento"
        >
          {formasDisponiveis.map((codigo) => {
            const sel = rascunho.forma === codigo;
            return (
              <button
                key={codigo}
                type="button"
                role="radio"
                aria-checked={sel}
                title={`${NOME_PAGAMENTO[codigo]} · ${TECLA[codigo]}`}
                disabled={rascunho.itens.length === 0}
                onClick={() => props.aoEscolherForma(codigo)}
                className={`relative flex min-h-14 items-center justify-center gap-2 rounded-padrao border font-bold transition-colors disabled:border-borda disabled:bg-desab-fundo disabled:text-desab-texto ${
                  sel
                    ? 'border-moldura bg-moldura text-sobre-moldura'
                    : 'border-borda bg-superficie hover:border-moldura active:bg-moldura/12'
                }`}
              >
                <IconePagamento codigo={codigo} tamanho={24} />
                {NOME_PAGAMENTO[codigo]}
                {sel && <Check size={18} className="absolute right-2 top-2" aria-hidden />}
              </button>
            );
          })}
        </div>

        {rascunho.forma === 'DINHEIRO' && (
          <div className="mt-3 flex items-end gap-3">
            <CampoDinheiro
              rotulo={t('pedido.valorRecebido')}
              centavos={rascunho.recebidoCentavos}
              aoMudar={props.aoMudarRecebido}
              className="flex-1"
              dica={rascunho.recebidoCentavos === null ? t('dica.valorRecebido') : undefined}
            />
            {troco !== null && (
              <p
                role="status"
                className={`mb-2 shrink-0 text-[24px] font-bold tabular-nums ${troco < 0 ? 'text-erro' : 'text-sucesso'}`}
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

        {props.dicaFinalizar && (
          <p className="legenda mt-3 text-center" id="dica-finalizar">
            {props.dicaFinalizar}
          </p>
        )}
        <Botao
          variante="principal"
          tamanho="grande"
          className="mt-2 min-h-16 w-full"
          title={`${t('pedido.finalizar')} · Ctrl+Enter`}
          disabled={Boolean(props.dicaFinalizar)}
          aria-describedby={props.dicaFinalizar ? 'dica-finalizar' : undefined}
          carregando={props.enviando}
          textoCarregando={t('pedido.gravando')}
          onClick={props.aoFinalizar}
        >
          {props.semConexao ? t('pedido.tentarDeNovo') : t('pedido.finalizar')}
        </Botao>
        <div className="mt-2 text-center">
          <Botao
            variante="texto"
            disabled={rascunho.itens.length === 0}
            onClick={props.aoLimpar}
            className="text-[14px]"
          >
            {t('pedido.limpar')}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function LinhaItem({
  item,
  problema,
  piscar,
  aoMudar,
  aoRemover,
}: {
  item: ItemRascunho;
  problema?: Problema;
  piscar: { novo: boolean; vez: number } | null;
  aoMudar: (q: number) => void;
  aoRemover: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(String(item.quantidade));
  const refCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) refCampo.current?.select();
  }, [editando]);

  const confirmar = () => {
    setEditando(false);
    const limpo = texto.trim();
    if (limpo === '' || limpo === '0') return aoMudar(0);
    if (!/^\d+$/.test(limpo) || Number(limpo) > LIMITES.quantidadeMax) {
      // Valor inválido: o campo volta ao valor anterior com aviso (UC-04).
      setTexto(String(item.quantidade));
      return aoMudar(Number.NaN);
    }
    aoMudar(Number(limpo));
  };

  const animacao = piscar ? (piscar.novo ? 'anim-item-novo' : 'anim-piscar') : '';
  return (
    <li
      key={piscar ? piscar.vez : undefined}
      className={`border-b border-borda px-3 py-2 ${problema ? 'bg-aviso-fundo' : ''} ${animacao}`}
    >
      <div className="flex min-h-10 items-center gap-1">
        <button
          type="button"
          onClick={() => aoMudar(item.quantidade - 1)}
          aria-label={t('pedido.diminuir', { nome: item.nome })}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-padrao border border-borda hover:border-moldura"
        >
          <Minus size={20} />
        </button>
        {editando ? (
          <input
            ref={refCampo}
            value={texto}
            inputMode="numeric"
            aria-label={t('pedido.quantidadeDe', { nome: item.nome })}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar();
              if (e.key === 'Escape') {
                setTexto(String(item.quantidade));
                setEditando(false);
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setTexto(String(Math.min(LIMITES.quantidadeMax, Number(texto || 0) + 1)));
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setTexto(String(Math.max(0, Number(texto || 0) - 1)));
              }
            }}
            className="h-10 w-12 rounded-padrao border-2 border-acao text-center font-bold tabular-nums"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTexto(String(item.quantidade));
              setEditando(true);
            }}
            aria-label={`${t('pedido.quantidadeDe', { nome: item.nome })}: ${item.quantidade}`}
            className="h-10 w-12 rounded-padrao text-center text-[18px] font-bold tabular-nums hover:bg-creme-escuro"
          >
            {item.quantidade}
          </button>
        )}
        <button
          type="button"
          onClick={() => aoMudar(item.quantidade + 1)}
          aria-label={t('pedido.aumentar', { nome: item.nome })}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-padrao border border-borda hover:border-moldura"
        >
          <Plus size={20} />
        </button>
        <div className="ml-2 min-w-0 flex-1">
          <p className="truncate font-bold" title={item.nome}>
            {item.nome}
          </p>
          <p className="legenda tabular-nums">
            {t('pedido.cada', { preco: formatarReais(item.precoCentavos) })}
          </p>
        </div>
        <span className="shrink-0 font-bold tabular-nums">
          {formatarReais(item.quantidade * item.precoCentavos)}
        </span>
        <button
          type="button"
          onClick={aoRemover}
          aria-label={t('pedido.remover', { nome: item.nome })}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-padrao text-desab-texto hover:text-erro"
        >
          <Trash2 size={20} />
        </button>
      </div>
      {problema && (
        <p className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-aviso">
          <TriangleAlert size={16} aria-hidden />
          {problema.tipo === 'preco'
            ? t('pedido.precoMudouLinha', {
                de: formatarReais(problema.de),
                para: formatarReais(problema.para),
              })
            : t('pedido.indisponivelLinha')}
        </p>
      )}
    </li>
  );
}
