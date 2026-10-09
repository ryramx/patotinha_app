/**
 * Dinheiro trafega pela API como string decimal com 2 casas ("33.00") e é
 * calculado em centavos inteiros, para nunca haver erro de ponto flutuante.
 */

const REGEX_DECIMAL = /^(\d+)(?:[.,](\d{1,2}))?$/;

/** Converte "8", "8.5", "8,50" ou "8.00" em centavos (800). Lança erro se inválido. */
export function paraCentavos(valor: string): number {
  const texto = valor.trim();
  const partes = REGEX_DECIMAL.exec(texto);
  if (!partes) throw new Error(`Valor monetário inválido: "${valor}"`);
  const reais = Number(partes[1]);
  const centavos = Number((partes[2] ?? '0').padEnd(2, '0'));
  return reais * 100 + centavos;
}

/** Converte centavos (3300) na string da API ("33.00"). */
export function deCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error(`Centavos devem ser inteiros: ${centavos}`);
  const sinal = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const reais = Math.floor(abs / 100);
  const resto = String(abs % 100).padStart(2, '0');
  return `${sinal}${reais}.${resto}`;
}

const formatador = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata para exibição: 123456 ou "1234.56" → "R$ 1.234,56". */
export function formatarReais(valor: number | string): string {
  const centavos = typeof valor === 'string' ? paraCentavos(valor) : valor;
  const sinal = centavos < 0 ? '-' : '';
  return `${sinal}R$ ${formatador.format(Math.abs(centavos) / 100)}`;
}

/** Subtotal de um item, em centavos. */
export function calcularSubtotal(quantidade: number, precoCentavos: number): number {
  return quantidade * precoCentavos;
}

/** Total do pedido = soma dos subtotais (RN-09). */
export function calcularTotal(itens: { quantidade: number; precoCentavos: number }[]): number {
  return itens.reduce(
    (soma, item) => soma + calcularSubtotal(item.quantidade, item.precoCentavos),
    0,
  );
}

/** Troco em centavos, ou null quando não há valor recebido. Negativo indica valor insuficiente. */
export function calcularTroco(
  totalCentavos: number,
  recebidoCentavos: number | null,
): number | null {
  if (recebidoCentavos === null) return null;
  return recebidoCentavos - totalCentavos;
}
