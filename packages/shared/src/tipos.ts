import type { CodigoPagamento, StatusPedido, StatusPreparo } from './esquemas.js';
import type { Perfil, Permissao } from './perfis.js';

/** Formatos das respostas da API (PRD 14). Dinheiro como string "33.00", datas ISO 8601. */

export interface ErroApi {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  perfil: Perfil;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type UsuarioSessao = Pick<Usuario, 'id' | 'nome' | 'login' | 'perfil'> & {
  /** O que o perfil do usuário pode fazer agora; o administrador tem todas. */
  permissoes: Permissao[];
  /** Já viu os cards do tutorial de primeiro acesso (guardado no servidor, vale em todo aparelho). */
  tutorialVisto: boolean;
};

export interface PerfilAcesso {
  codigo: Perfil;
  nome: string;
  permissoes: Permissao[];
  /** O perfil Administrador é fixo: sempre tem todas as permissões. */
  editavel: boolean;
  usuariosAtivos: number;
  atualizadoEm: string;
}

export interface Categoria {
  id: number;
  nome: string;
  ativo: boolean;
  produtosAtivos: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Produto {
  id: number;
  nome: string;
  preco: string;
  /** O que o produto leva, mostrado abaixo do nome no novo pedido. */
  ingredientes: string | null;
  ativo: boolean;
  categoria: { id: number; nome: string; ativo: boolean };
  criadoEm: string;
  atualizadoEm: string;
}

export interface FormaPagamento {
  id: number;
  codigo: CodigoPagamento;
  nome: string;
}

export interface ItemPedido {
  produtoId: number;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: string;
  subtotal: string;
}

/** Comanda: em que pé está o preparo do pedido. */
export interface Preparo {
  status: StatusPreparo;
  atualizadoEm: string | null;
}

export interface Pedido {
  id: number;
  status: StatusPedido;
  /** Nome dito no balcão. Pedidos de antes da comanda não têm. */
  cliente: string | null;
  preparo: Preparo;
  criadoEm: string;
  finalizadoEm: string | null;
  usuario: { id: number; nome: string };
  formaPagamento: { codigo: CodigoPagamento; nome: string } | null;
  itens: ItemPedido[];
  total: string;
  valorRecebido: string | null;
  troco: string | null;
  cancelamento?: { em: string; por: { id: number; nome: string }; motivo: string };
}

export interface PedidoResumido {
  id: number;
  cliente: string | null;
  preparo: Preparo;
  criadoEm: string;
  total: string;
  formaPagamento: CodigoPagamento | null;
  status: StatusPedido;
  usuario: { id: number; nome: string };
}

export interface Pagina<T> {
  dados: T[];
  pagina: number;
  tamanho: number;
  total: number;
}

export interface ListaPedidos extends Pagina<PedidoResumido> {
  /** Só para quem tem a permissão Financeiro. */
  somaFinalizados?: string;
  quantidadeFinalizados: number;
}

/** Pedido na fila de preparo: o que a cozinha precisa ver. */
export interface PedidoNaFila {
  id: number;
  cliente: string | null;
  criadoEm: string;
  preparo: Preparo;
  itens: { nomeProduto: string; quantidade: number }[];
}

export interface FilaPreparo {
  dados: PedidoNaFila[];
  /** Últimos entregues, para desfazer um toque errado. */
  entreguesRecentes: PedidoNaFila[];
}

/** Sugestão do campo Nome do cliente no novo pedido. */
export interface ClienteSugerido {
  id: number;
  nome: string;
  /** Só números, com DDD. */
  telefone: string | null;
  pedidos: number;
  ultimoPedidoEm: string;
}

export interface RelatorioVendas {
  periodo: { de: string; ate: string };
  pedidosFinalizados: number;
  pedidosCancelados: number;
  valorCancelados: string;
  faturamento: string;
  porFormaPagamento: { codigo: CodigoPagamento; nome: string; pedidos: number; total: string }[];
  cartaoTotal: string;
  cartaoPedidos: number;
  produtosMaisVendidos: { produtoId: number; nome: string; quantidade: number; valor: string }[];
}

export interface StatusCategoriaResposta extends Categoria {
  produtosAfetados: number;
}

/** Pix da loja (etapa 13): sem chave cadastrada, o pedido mostra o aviso para configurar. */
export interface ConfigPix {
  configurado: boolean;
  tipoChave: import('./pix.js').TipoChavePix | null;
  /** Já normalizada: CPF e CNPJ só números, celular com +55. */
  chave: string | null;
  nome: string | null;
  cidade: string | null;
  atualizadoEm: string | null;
}
