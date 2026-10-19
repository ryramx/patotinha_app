import { deCentavos, formatarReais, LIMITES, paraCentavos } from '@patotinha/shared';
import { ErroApp } from '../erros.js';

/**
 * Regras de cálculo do pedido (PRD 13.1, passos 2 a 5), sem acesso ao banco,
 * para poderem ser testadas com todos os ramos (PRD 7.2).
 */

export interface ItemRecebido {
  produtoId: number;
  quantidade: number;
  precoExibido: string;
}

export interface ProdutoAtual {
  id: number;
  nome: string;
  precoCentavos: number;
  ativo: boolean;
  categoriaAtiva: boolean;
}

export interface FormaAtual {
  id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export interface ItemCalculado {
  produtoId: number;
  nomeProduto: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  subtotalCentavos: number;
}

export interface PedidoCalculado {
  itens: ItemCalculado[];
  totalCentavos: number;
  valorRecebidoCentavos: number | null;
  trocoCentavos: number | null;
}

/** Produto repetido vira um item só, com as quantidades somadas (RN-10). */
export function agruparItens(itens: ItemRecebido[]): ItemRecebido[] {
  const porProduto = new Map<number, ItemRecebido>();
  for (const item of itens) {
    const existente = porProduto.get(item.produtoId);
    if (existente) existente.quantidade += item.quantidade;
    else porProduto.set(item.produtoId, { ...item });
  }
  return [...porProduto.values()];
}

/**
 * Confere produtos, preços, quantidade e pagamento e calcula subtotais, total e troco
 * sempre com os preços do banco (RN-07, RN-08, RN-09). Lança ErroApp na primeira regra violada.
 */
export function calcularPedido(
  itensRecebidos: ItemRecebido[],
  produtos: Map<number, ProdutoAtual>,
  forma: FormaAtual | null,
  valorRecebido: string | null | undefined,
  pagarDepois = false,
): PedidoCalculado {
  if (itensRecebidos.length === 0) {
    throw new ErroApp(422, 'PEDIDO_SEM_ITENS', 'Adicione pelo menos um produto');
  }
  const itens = agruparItens(itensRecebidos);

  const inexistentes = itens.filter((i) => !produtos.has(i.produtoId));
  if (inexistentes.length) {
    throw new ErroApp(
      404,
      'PRODUTO_NAO_ENCONTRADO',
      'Um dos produtos do pedido não existe mais',
      inexistentes.map((i) => ({ produtoId: i.produtoId })),
    );
  }

  const inativos = itens
    .map((i) => produtos.get(i.produtoId)!)
    .filter((p) => !p.ativo || !p.categoriaAtiva);
  if (inativos.length) {
    const nomes = inativos.map((p) => p.nome).join(', ');
    throw new ErroApp(
      409,
      'PRODUTO_INATIVO',
      inativos.length === 1
        ? `${nomes} não está mais disponível. Remova-o para finalizar`
        : `${nomes} não estão mais disponíveis. Remova-os para finalizar`,
      inativos.map((p) => ({ produtoId: p.id, nome: p.nome })),
    );
  }

  const precosMudaram = itens
    .map((i) => ({ item: i, produto: produtos.get(i.produtoId)! }))
    .filter(({ item, produto }) => paraCentavos(item.precoExibido) !== produto.precoCentavos);
  if (precosMudaram.length) {
    const primeiro = precosMudaram[0]!;
    throw new ErroApp(
      409,
      'PRECO_ALTERADO',
      `O preço de ${primeiro.produto.nome} mudou. Confira o total e finalize de novo`,
      precosMudaram.map(({ item, produto }) => ({
        produtoId: produto.id,
        nome: produto.nome,
        precoExibido: deCentavos(paraCentavos(item.precoExibido)),
        precoAtual: deCentavos(produto.precoCentavos),
      })),
    );
  }

  const acimaDoLimite = itens.filter((i) => i.quantidade > LIMITES.quantidadeMax);
  if (acimaDoLimite.length) {
    throw new ErroApp(
      422,
      'QUANTIDADE_INVALIDA',
      `Use um número de 1 a ${LIMITES.quantidadeMax}`,
      acimaDoLimite.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
    );
  }

  const calculados: ItemCalculado[] = itens.map((i) => {
    const produto = produtos.get(i.produtoId)!;
    return {
      produtoId: produto.id,
      nomeProduto: produto.nome,
      quantidade: i.quantidade,
      precoUnitarioCentavos: produto.precoCentavos,
      subtotalCentavos: i.quantidade * produto.precoCentavos,
    };
  });
  const totalCentavos = calculados.reduce((soma, i) => soma + i.subtotalCentavos, 0);

  // Pagar depois (etapa 14): sem forma nem valor recebido agora; o pagamento vem no fim.
  if (pagarDepois) {
    if (forma || (valorRecebido !== null && valorRecebido !== undefined && valorRecebido !== '')) {
      throw new ErroApp(
        422,
        'PAGAR_DEPOIS_SEM_PAGAMENTO',
        'Pedido para pagar depois não leva forma de pagamento agora',
      );
    }
    return { itens: calculados, totalCentavos, valorRecebidoCentavos: null, trocoCentavos: null };
  }
  return {
    itens: calculados,
    totalCentavos,
    ...calcularPagamento(totalCentavos, forma, valorRecebido),
  };
}

/** Confere a forma de pagamento e calcula o troco (na hora do pedido ou ao receber depois). */
export function calcularPagamento(
  totalCentavos: number,
  forma: FormaAtual | null,
  valorRecebido: string | null | undefined,
): { valorRecebidoCentavos: number | null; trocoCentavos: number | null } {
  if (!forma || !forma.ativo) {
    throw new ErroApp(422, 'FORMA_PAGAMENTO_INVALIDA', 'Escolha uma forma de pagamento válida');
  }
  let valorRecebidoCentavos: number | null = null;
  let trocoCentavos: number | null = null;
  if (valorRecebido !== null && valorRecebido !== undefined && valorRecebido !== '') {
    // Regras usam o código da forma, nunca o id (PRD 6.4).
    if (forma.codigo !== 'DINHEIRO') {
      throw new ErroApp(
        422,
        'VALOR_RECEBIDO_SO_EM_DINHEIRO',
        'Valor recebido só pode ser informado em pagamento em dinheiro',
      );
    }
    valorRecebidoCentavos = paraCentavos(valorRecebido);
    if (valorRecebidoCentavos < totalCentavos) {
      throw new ErroApp(
        422,
        'VALOR_RECEBIDO_INSUFICIENTE',
        `Valor recebido menor que o total. Faltam ${formatarReais(totalCentavos - valorRecebidoCentavos)}`,
        { faltam: deCentavos(totalCentavos - valorRecebidoCentavos) },
      );
    }
    trocoCentavos = valorRecebidoCentavos - totalCentavos;
  }
  return { valorRecebidoCentavos, trocoCentavos };
}
