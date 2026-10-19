import type { ReactNode } from 'react';
import {
  Ban,
  BellRing,
  CircleCheck,
  Clock,
  Banknote,
  Flame,
  HandPlatter,
  QrCode,
  CreditCard,
} from 'lucide-react';
import type { CodigoPagamento, StatusPedido, StatusPreparo } from '@patotinha/shared';
import { t } from '../textos';

/** Status nunca só por cor: palavra + ícone. */
export function EtiquetaStatus({ status }: { status: StatusPedido }) {
  const config = {
    FINALIZADO: { texto: 'Finalizado', cor: 'bg-sucesso-fundo text-sucesso', Icone: CircleCheck },
    CANCELADO: { texto: 'Cancelado', cor: 'bg-erro-fundo text-erro', Icone: Ban },
    ABERTO: { texto: 'A pagar', cor: 'bg-aviso-fundo text-aviso', Icone: Clock },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[14px] font-bold ${config.cor}`}
    >
      <config.Icone size={14} aria-hidden /> {config.texto}
    </span>
  );
}

export const NOME_PREPARO: Record<StatusPreparo, string> = {
  AGUARDANDO: t('fila.aguardando'),
  PREPARANDO: t('fila.preparando'),
  PRONTO: t('fila.pronto'),
  ENTREGUE: t('fila.entregue'),
};

/** Andamento da comanda: palavra + ícone, como o status do pedido. */
export function EtiquetaPreparo({ status }: { status: StatusPreparo }) {
  const config = {
    AGUARDANDO: { cor: 'bg-desab-fundo text-texto', Icone: Clock },
    PREPARANDO: { cor: 'bg-aviso-fundo text-aviso', Icone: Flame },
    PRONTO: { cor: 'bg-sucesso-fundo text-sucesso', Icone: BellRing },
    ENTREGUE: { cor: 'bg-creme-escuro text-texto-suave', Icone: HandPlatter },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[14px] font-bold ${config.cor}`}
    >
      <config.Icone size={14} aria-hidden /> {NOME_PREPARO[status]}
    </span>
  );
}

export function EtiquetaAtivo({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sucesso-fundo px-3 py-0.5 text-[14px] font-bold text-sucesso">
      <CircleCheck size={14} aria-hidden /> {t('cadastro.ativo')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-desab-fundo px-3 py-0.5 text-[14px] font-bold text-texto-suave">
      <Ban size={14} aria-hidden /> {t('cadastro.inativo')}
    </span>
  );
}

export const NOME_PAGAMENTO: Record<CodigoPagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
};

export function IconePagamento({
  codigo,
  tamanho = 20,
}: {
  codigo: CodigoPagamento;
  tamanho?: number;
}) {
  if (codigo === 'DINHEIRO') return <Banknote size={tamanho} aria-hidden />;
  if (codigo === 'PIX') return <QrCode size={tamanho} aria-hidden />;
  if (codigo === 'DEBITO') return <CreditCard size={tamanho} aria-hidden />;
  return (
    <span className="relative inline-flex" aria-hidden>
      <CreditCard size={tamanho} />
      <span className="absolute -bottom-1 -right-1.5 rounded-sm bg-current px-0.5 text-[9px] font-bold leading-none">
        <span className="text-superficie">C</span>
      </span>
    </span>
  );
}

export function Pagamento({ codigo }: { codigo: CodigoPagamento | null }) {
  if (!codigo) return <span className="text-texto-suave">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <IconePagamento codigo={codigo} /> {NOME_PAGAMENTO[codigo]}
    </span>
  );
}

export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`esqueleto ${className}`} aria-hidden />;
}

export function LinhasEsqueleto({
  linhas = 6,
  altura = 'h-11',
}: {
  linhas?: number;
  altura?: string;
}) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} className={`${altura} w-full`} />
      ))}
    </div>
  );
}

/** Tela vazia: frase curta em Pacifico e uma ação. */
export function Vazio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <p className="enfeite text-[28px] leading-10 text-moldura">{texto}</p>
      {children}
    </div>
  );
}

export function Paginacao({
  pagina,
  tamanho,
  total,
  unidade,
  aoMudar,
}: {
  pagina: number;
  tamanho: number;
  total: number;
  unidade: string;
  aoMudar: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const inicio = total === 0 ? 0 : (pagina - 1) * tamanho + 1;
  const fim = Math.min(total, pagina * tamanho);
  const primeira = Math.max(1, Math.min(pagina - 2, paginas - 4));
  const visiveis = Array.from({ length: Math.min(5, paginas) }, (_, i) => primeira + i);
  const base = 'h-10 min-w-10 rounded-padrao px-2 font-bold disabled:text-desab-texto';
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Paginação">
      <span className="legenda mr-2">
        {inicio}–{fim} de {total} {unidade}
      </span>
      <button
        type="button"
        className={`${base} hover:bg-creme-escuro`}
        disabled={pagina <= 1}
        onClick={() => aoMudar(pagina - 1)}
      >
        Anterior
      </button>
      {visiveis.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === pagina ? 'page' : undefined}
          className={`${base} ${n === pagina ? 'bg-moldura text-sobre-moldura' : 'hover:bg-creme-escuro'}`}
          onClick={() => aoMudar(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={`${base} hover:bg-creme-escuro`}
        disabled={pagina >= paginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}
