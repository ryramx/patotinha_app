/**
 * Cardápio oficial da Patotinha, transcrito da arte do cardápio (outubro de 2026).
 * É a fonte do script cadastrar-cardapio.ts; para mudar preço ou incluir produto,
 * altere aqui e rode o workflow "Cadastrar cardápio" de novo.
 */
export interface ProdutoCardapio {
  nome: string;
  /** Preço em reais, com ponto decimal. */
  preco: string;
  ingredientes?: string;
}

export const CARDAPIO_OFICIAL: Record<string, ProdutoCardapio[]> = {
  Pastéis: [
    { nome: 'A Patotinha', preco: '8.00', ingredientes: 'Queijo coalho e mussarela' },
    { nome: 'Fazenda', preco: '8.00', ingredientes: 'Frango e queijo coalho' },
    { nome: 'Todo Neto Gosta', preco: '9.00', ingredientes: 'Queijo coalho, mussarela e prato' },
    { nome: 'A Moda da Vovó', preco: '9.00', ingredientes: 'Frango, bacon e queijo mussarela' },
    { nome: 'Caipira', preco: '9.00', ingredientes: 'Charque e queijo coalho' },
    { nome: 'A Moda do Vovô', preco: '10.00', ingredientes: 'Charque, queijo coalho e catupiry' },
    { nome: 'Misto', preco: '10.00', ingredientes: 'Presunto, queijo mussarela e prato' },
    {
      nome: 'Cachorrão',
      preco: '11.00',
      ingredientes: 'Carne moída, queijo mussarela e calabresa',
    },
    { nome: 'Pizza', preco: '11.00', ingredientes: 'Calabresa, queijo mussarela e catupiry' },
    {
      nome: 'Mistão',
      preco: '15.00',
      ingredientes: 'Presunto, queijo prato, mussarela, frango e bacon',
    },
    { nome: 'Frutos do Mar', preco: '16.00', ingredientes: 'Camarão, queijo mussarela e catupiry' },
    {
      nome: 'X-Tudo',
      preco: '18.00',
      ingredientes:
        'Frango, carne moída, calabresa, bacon, presunto, queijo coalho, prato e mussarela',
    },
    {
      nome: 'Moda da Casa',
      preco: '23.00',
      ingredientes:
        'Charque, carne moída, frango, bacon, calabresa, presunto, camarão, queijo mussarela, prato e catupiry',
    },
  ],
  Lanches: [
    { nome: 'Coxinha de Frango', preco: '6.00' },
    { nome: 'Coxinha de Frango com Catupiry', preco: '7.00' },
    { nome: 'Coxinha de Charque com Catupiry', preco: '7.00' },
    { nome: 'Cachorro Quente', preco: '7.00' },
    { nome: 'Batata-Frita M (Simples)', preco: '10.00' },
    { nome: 'Batata-Frita M (Bacon e Calabresa)', preco: '15.00' },
    { nome: 'Batata-Frita G (Simples)', preco: '18.00' },
    { nome: 'Batata-Frita G (Bacon e Calabresa)', preco: '23.00' },
    { nome: 'Batata-Frita GG (Bacon, Calabresa e Cheddar)', preco: '28.00' },
  ],
  Bebidas: [
    { nome: 'Refrigerante Lata', preco: '5.00' },
    { nome: 'Refrigerante 1L', preco: '8.00' },
    { nome: 'Refrigerante 2L', preco: '14.00' },
  ],
};
