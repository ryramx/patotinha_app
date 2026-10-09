import textos from './textos.pt-BR.json';

type Textos = typeof textos;
type Chaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Chaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type ChaveTexto = Chaves<Textos>;

/** Texto da interface pela chave, trocando {variaveis} (interface, "Textos da interface"). */
export function t(chave: ChaveTexto, variaveis: Record<string, string | number> = {}): string {
  const valor = chave
    .split('.')
    .reduce<unknown>((obj, parte) => (obj as Record<string, unknown>)[parte], textos);
  return String(valor).replace(/\{(\w+)\}/g, (_, nome: string) =>
    String(variaveis[nome] ?? `{${nome}}`),
  );
}
