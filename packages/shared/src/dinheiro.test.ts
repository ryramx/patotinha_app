import { describe, expect, it } from 'vitest';
import {
  calcularTotal,
  calcularTroco,
  deCentavos,
  formatarReais,
  paraCentavos,
} from './dinheiro.js';
import { combinaBusca } from './texto.js';
import { isoSaoPaulo, diaEmSaoPaulo, somarDias } from './datas.js';

describe('dinheiro', () => {
  it('converte strings em centavos', () => {
    expect(paraCentavos('8')).toBe(800);
    expect(paraCentavos('8.5')).toBe(850);
    expect(paraCentavos('8,50')).toBe(850);
    expect(paraCentavos('33.00')).toBe(3300);
    expect(() => paraCentavos('-1')).toThrow();
    expect(() => paraCentavos('abc')).toThrow();
  });

  it('converte centavos em string da API', () => {
    expect(deCentavos(3300)).toBe('33.00');
    expect(deCentavos(5)).toBe('0.05');
    expect(() => deCentavos(1.5)).toThrow();
  });

  it('formata em reais no padrão brasileiro', () => {
    expect(formatarReais(123456)).toBe('R$ 1.234,56');
    expect(formatarReais('33.00')).toBe('R$ 33,00');
  });

  it('calcula o pedido do exemplo do PRD: R$ 33,00 e troco de R$ 17,00', () => {
    const total = calcularTotal([
      { quantidade: 2, precoCentavos: 800 },
      { quantidade: 1, precoCentavos: 700 },
      { quantidade: 2, precoCentavos: 500 },
    ]);
    expect(total).toBe(3300);
    expect(calcularTroco(total, 5000)).toBe(1700);
    expect(calcularTroco(total, null)).toBeNull();
    expect(calcularTroco(total, 3000)).toBe(-300);
  });
});

describe('busca', () => {
  it('ignora acentos, maiúsculas e ordem', () => {
    expect(combinaBusca('Pastel de Carne', 'pastel carne')).toBe(true);
    expect(combinaBusca('Pão de Queijo', 'PAO')).toBe(true);
    expect(combinaBusca('Coca-Cola', 'carne')).toBe(false);
  });
});

describe('datas', () => {
  it('usa o dia civil de Brasília', () => {
    // 23h50 em Brasília de 08/10 = 02h50 UTC de 09/10
    expect(diaEmSaoPaulo(new Date('2026-10-09T02:50:00Z'))).toBe('2026-10-08');
    expect(isoSaoPaulo(new Date('2026-10-08T16:20:00Z'))).toBe('2026-10-08T13:20:00-03:00');
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
  });
});
