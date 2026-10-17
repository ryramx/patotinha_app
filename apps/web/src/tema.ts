import { useCallback, useSyncExternalStore } from 'react';

/**
 * Modo Claro e Modo Escuro (interface, "Temas"). A escolha fica guardada neste aparelho; sem
 * escolha, segue o tema do sistema. O tema vai no atributo data-tema do <html>, que troca os
 * tokens de cor (estilos/tokens.css).
 */
export type Tema = 'claro' | 'escuro';

const CHAVE = 'patotinha.tema';
const COR_BARRA: Record<Tema, string> = { claro: '#ffffff', escuro: '#1c1210' };
const ouvintes = new Set<() => void>();

function temaSalvo(): Tema | null {
  try {
    const valor = localStorage.getItem(CHAVE);
    return valor === 'claro' || valor === 'escuro' ? valor : null;
  } catch {
    return null;
  }
}

function temaDoSistema(): Tema {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function temaAtual(): Tema {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

function aplicar(tema: Tema) {
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema]);
  ouvintes.forEach((avisar) => avisar());
}

/** Chamado uma vez, antes da primeira tela. */
export function iniciarTema() {
  aplicar(temaSalvo() ?? temaDoSistema());
  // Sem escolha guardada, acompanha a troca de tema do sistema.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!temaSalvo()) aplicar(temaDoSistema());
  });
}

export function escolherTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Navegador sem armazenamento: o tema vale até recarregar.
  }
  aplicar(tema);
}

export function useTema() {
  const tema = useSyncExternalStore((avisar) => {
    ouvintes.add(avisar);
    return () => ouvintes.delete(avisar);
  }, temaAtual);
  const alternar = useCallback(() => escolherTema(tema === 'escuro' ? 'claro' : 'escuro'), [tema]);
  return { tema, alternar };
}
