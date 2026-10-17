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

/** Chave do cadastro de clientes: "  José  da Silva" e "jose da silva" são o mesmo cliente. */
export function chaveCliente(nome: string): string {
  return normalizarBusca(nome).replace(/\s+/g, ' ');
}

/** Telefone guardado só com números (DDD + número) mostrado como (11) 98765-4321. */
export function formatarTelefone(digitos: string): string {
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digitos;
}
