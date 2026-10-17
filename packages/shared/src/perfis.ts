/**
 * Perfis de acesso e o que cada um pode fazer (etapa 10, docs/perfis.md).
 * Os perfis são fixos; as permissões de cada um ficam no banco e o administrador
 * muda na tela "Perfis e permissões". O administrador sempre pode tudo.
 */

export const PERFIS = ['ADMIN', 'GERENTE', 'CHEF', 'FUNCIONARIO'] as const;
export type Perfil = (typeof PERFIS)[number];

export const NOMES_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CHEF: 'Chef',
  FUNCIONARIO: 'Funcionário',
};

export const PERMISSOES = [
  'PEDIDOS_REGISTRAR',
  'PEDIDOS_VER',
  'PEDIDOS_CANCELAR',
  'FILA',
  'FINANCEIRO',
  'CARDAPIO',
  'USUARIOS',
] as const;
export type Permissao = (typeof PERMISSOES)[number];

/** Na ordem em que aparecem na tela "Perfis e permissões". */
export const DESCRICAO_PERMISSOES: Record<Permissao, { nome: string; descricao: string }> = {
  PEDIDOS_REGISTRAR: {
    nome: 'Registrar pedidos',
    descricao: 'Abrir o Novo pedido e gravar vendas no balcão',
  },
  PEDIDOS_VER: {
    nome: 'Ver pedidos',
    descricao: 'Pedidos de hoje no Início, Histórico e detalhe de cada pedido',
  },
  PEDIDOS_CANCELAR: {
    nome: 'Cancelar pedidos',
    descricao: 'Cancelar um pedido já gravado, com motivo',
  },
  FILA: {
    nome: 'Fila de preparo',
    descricao: 'Ver as comandas e avançar o preparo (Aguardando, Preparando, Pronto, Entregue)',
  },
  FINANCEIRO: {
    nome: 'Financeiro',
    descricao: 'Resumo de vendas, faturamento do dia e totais por forma de pagamento',
  },
  CARDAPIO: {
    nome: 'Cardápio',
    descricao: 'Cadastrar e alterar produtos, preços e categorias',
  },
  USUARIOS: {
    nome: 'Usuários',
    descricao: 'Cadastrar usuários, trocar o perfil e redefinir senhas (menos de administradores)',
  },
};

/** Permissões de fábrica, gravadas pela migração e usadas pelo botão "Voltar ao padrão". */
export const PERMISSOES_PADRAO: Record<Perfil, readonly Permissao[]> = {
  ADMIN: PERMISSOES,
  GERENTE: ['PEDIDOS_REGISTRAR', 'PEDIDOS_VER', 'FINANCEIRO'],
  CHEF: ['FILA'],
  FUNCIONARIO: ['PEDIDOS_REGISTRAR'],
};
