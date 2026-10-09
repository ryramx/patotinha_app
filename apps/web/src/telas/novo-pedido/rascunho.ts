import type { CodigoPagamento } from '@patotinha/shared';

/** Rascunho do pedido em montagem, salvo no navegador a cada mudança (PRD 7.3, H-22). */
export interface ItemRascunho {
  produtoId: number;
  nome: string;
  precoCentavos: number;
  quantidade: number;
}

export interface Rascunho {
  itens: ItemRascunho[];
  forma: CodigoPagamento | null;
  recebidoCentavos: number | null;
  chaveIdempotencia: string;
}

const CHAVE = 'patotinha.rascunho';
const CHAVE_SESSAO = 'patotinha.rascunho.retomado';

export function novaChave(): string {
  return crypto.randomUUID();
}

export function rascunhoVazio(): Rascunho {
  return { itens: [], forma: null, recebidoCentavos: null, chaveIdempotencia: novaChave() };
}

export function lerRascunho(): Rascunho | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    if (!texto) return null;
    const r = JSON.parse(texto) as Rascunho;
    if (!Array.isArray(r.itens) || typeof r.chaveIdempotencia !== 'string') return null;
    return r;
  } catch {
    return null;
  }
}

export function salvarRascunho(r: Rascunho) {
  try {
    if (r.itens.length === 0 && r.forma === null) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    // Navegador sem armazenamento: o pedido só não sobrevive a um recarregamento.
  }
}

export function apagarRascunho() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
}

export function temRascunho(): boolean {
  return (lerRascunho()?.itens.length ?? 0) > 0;
}

/** Nesta aba, o rascunho já foi retomado (não pergunta de novo ao voltar à tela). */
export function rascunhoJaRetomado(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO) === '1';
  } catch {
    return false;
  }
}

export function marcarRascunhoRetomado(valor: boolean) {
  try {
    if (valor) sessionStorage.setItem(CHAVE_SESSAO, '1');
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // ignora
  }
}
