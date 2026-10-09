import { describe, expect, it } from 'vitest';
import { ErroApp } from '../erros.js';
import { agruparItens, calcularPedido, type FormaAtual, type ProdutoAtual } from './calculo.js';

const produtos = new Map<number, ProdutoAtual>([
  [1, { id: 1, nome: 'Pastel de Carne', precoCentavos: 800, ativo: true, categoriaAtiva: true }],
  [2, { id: 2, nome: 'Pastel de Queijo', precoCentavos: 700, ativo: true, categoriaAtiva: true }],
  [3, { id: 3, nome: 'Coca-Cola', precoCentavos: 500, ativo: true, categoriaAtiva: true }],
  [4, { id: 4, nome: 'Pastel de Palmito', precoCentavos: 900, ativo: false, categoriaAtiva: true }],
  [5, { id: 5, nome: 'Bolo', precoCentavos: 600, ativo: true, categoriaAtiva: false }],
]);
const dinheiro: FormaAtual = { id: 1, codigo: 'DINHEIRO', nome: 'Dinheiro', ativo: true };
const pix: FormaAtual = { id: 2, codigo: 'PIX', nome: 'PIX', ativo: true };

const exemplo = [
  { produtoId: 1, quantidade: 2, precoExibido: '8.00' },
  { produtoId: 2, quantidade: 1, precoExibido: '7.00' },
  { produtoId: 3, quantidade: 2, precoExibido: '5.00' },
];

function codigoDoErro(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErroApp);
    return (e as ErroApp).codigo;
  }
  throw new Error('esperava erro');
}

describe('agruparItens', () => {
  it('soma quantidades do mesmo produto num item só (RN-10)', () => {
    const r = agruparItens([
      { produtoId: 1, quantidade: 1, precoExibido: '8.00' },
      { produtoId: 3, quantidade: 1, precoExibido: '5.00' },
      { produtoId: 1, quantidade: 2, precoExibido: '8.00' },
    ]);
    expect(r).toEqual([
      { produtoId: 1, quantidade: 3, precoExibido: '8.00' },
      { produtoId: 3, quantidade: 1, precoExibido: '5.00' },
    ]);
  });
});

describe('calcularPedido', () => {
  it('calcula o exemplo do PRD: R$ 33,00 e troco de R$ 17,00 para R$ 50,00', () => {
    const r = calcularPedido(exemplo, produtos, dinheiro, '50.00');
    expect(r.itens.map((i) => i.subtotalCentavos)).toEqual([1600, 700, 1000]);
    expect(r.totalCentavos).toBe(3300);
    expect(r.valorRecebidoCentavos).toBe(5000);
    expect(r.trocoCentavos).toBe(1700);
  });

  it('copia nome e preço do banco para os itens (RN-07)', () => {
    const r = calcularPedido(exemplo, produtos, pix, null);
    expect(r.itens[0]).toEqual({
      produtoId: 1,
      nomeProduto: 'Pastel de Carne',
      quantidade: 2,
      precoUnitarioCentavos: 800,
      subtotalCentavos: 1600,
    });
  });

  it('dinheiro sem valor recebido grava sem troco', () => {
    for (const vazio of [null, undefined, '']) {
      const r = calcularPedido(exemplo, produtos, dinheiro, vazio);
      expect(r.valorRecebidoCentavos).toBeNull();
      expect(r.trocoCentavos).toBeNull();
    }
  });

  it('valor recebido igual ao total dá troco zero', () => {
    expect(calcularPedido(exemplo, produtos, dinheiro, '33').trocoCentavos).toBe(0);
  });

  it('recusa pedido sem itens', () => {
    expect(codigoDoErro(() => calcularPedido([], produtos, pix, null))).toBe('PEDIDO_SEM_ITENS');
  });

  it('recusa produto inexistente', () => {
    expect(
      codigoDoErro(() =>
        calcularPedido(
          [{ produtoId: 99, quantidade: 1, precoExibido: '1.00' }],
          produtos,
          pix,
          null,
        ),
      ),
    ).toBe('PRODUTO_NAO_ENCONTRADO');
  });

  it('recusa produto inativo e produto de categoria inativa (RN-01, RN-02)', () => {
    for (const produtoId of [4, 5]) {
      expect(
        codigoDoErro(() =>
          calcularPedido([{ produtoId, quantidade: 1, precoExibido: '9.00' }], produtos, pix, null),
        ),
      ).toBe('PRODUTO_INATIVO');
    }
  });

  it('lista vários produtos inativos na mensagem', () => {
    try {
      calcularPedido(
        [
          { produtoId: 4, quantidade: 1, precoExibido: '9.00' },
          { produtoId: 5, quantidade: 1, precoExibido: '6.00' },
        ],
        produtos,
        pix,
        null,
      );
    } catch (e) {
      expect((e as ErroApp).message).toContain('não estão mais disponíveis');
      expect((e as ErroApp).detalhes).toHaveLength(2);
    }
  });

  it('recusa preço adulterado ou alterado, informando o preço atual', () => {
    try {
      calcularPedido([{ produtoId: 1, quantidade: 1, precoExibido: '1.00' }], produtos, pix, null);
      throw new Error('deveria falhar');
    } catch (e) {
      expect((e as ErroApp).codigo).toBe('PRECO_ALTERADO');
      expect((e as ErroApp).detalhes).toEqual([
        { produtoId: 1, nome: 'Pastel de Carne', precoExibido: '1.00', precoAtual: '8.00' },
      ]);
    }
  });

  it('recusa quantidade somada acima do limite de 99 (D-24)', () => {
    expect(
      codigoDoErro(() =>
        calcularPedido(
          [
            { produtoId: 1, quantidade: 60, precoExibido: '8.00' },
            { produtoId: 1, quantidade: 40, precoExibido: '8.00' },
          ],
          produtos,
          pix,
          null,
        ),
      ),
    ).toBe('QUANTIDADE_INVALIDA');
  });

  it('recusa forma de pagamento inexistente ou inativa (RN-11)', () => {
    expect(codigoDoErro(() => calcularPedido(exemplo, produtos, null, null))).toBe(
      'FORMA_PAGAMENTO_INVALIDA',
    );
    expect(
      codigoDoErro(() => calcularPedido(exemplo, produtos, { ...pix, ativo: false }, null)),
    ).toBe('FORMA_PAGAMENTO_INVALIDA');
  });

  it('recusa valor recebido fora do dinheiro e valor menor que o total (RN-12)', () => {
    expect(codigoDoErro(() => calcularPedido(exemplo, produtos, pix, '50.00'))).toBe(
      'VALOR_RECEBIDO_SO_EM_DINHEIRO',
    );
    expect(codigoDoErro(() => calcularPedido(exemplo, produtos, dinheiro, '30.00'))).toBe(
      'VALOR_RECEBIDO_INSUFICIENTE',
    );
  });
});
