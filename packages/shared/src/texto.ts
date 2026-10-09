/** Remove acentos e passa para minúsculas, para buscas como "pastel carne" → "Pastel de Carne". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Todas as palavras da busca aparecem no nome, em qualquer ordem. */
export function combinaBusca(nome: string, busca: string): boolean {
  const alvo = normalizarBusca(nome);
  return normalizarBusca(busca)
    .split(/\s+/)
    .filter(Boolean)
    .every((palavra) => alvo.includes(palavra));
}
