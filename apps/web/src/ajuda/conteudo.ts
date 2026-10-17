import {
  ChartColumnBig,
  ChefHat,
  Cookie,
  House,
  Lightbulb,
  PlusCircle,
  Receipt,
  ShieldCheck,
  Smile,
  SunMoon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permissao } from '@patotinha/shared';

/** Quem vê: alguma destas permissões; 'ADMIN' é só o administrador; sem `exige`, todos. */
export type Exige = (Permissao | 'ADMIN')[];

export interface CardTutorial {
  id: string;
  Icone: LucideIcon;
  titulo: string;
  texto: string;
  exige?: Exige;
}

/**
 * Cards do tutorial de primeiro acesso (etapa 12, docs/tutorial.md). Cada pessoa vê só os
 * cards das telas que o perfil dela abre. {nome} e {perfil} são trocados na hora.
 */
export const CARDS_TUTORIAL: CardTutorial[] = [
  {
    id: 'boas-vindas',
    Icone: Smile,
    titulo: 'Olá, {nome}! Que bom ter você aqui',
    texto:
      'Este é o sistema de pedidos da Patotinha da Vovó. Nestes cards mostramos rapidinho o que cada parte faz. Você entrou com o perfil {perfil}, então só aparece o que você usa.',
  },
  {
    id: 'novo-pedido',
    Icone: PlusCircle,
    titulo: 'Novo pedido: a venda no balcão',
    texto:
      'Toque nos produtos para montar o pedido; cada toque soma mais um. Digite o nome do cliente, escolha a forma de pagamento e toque em Finalizar pedido. No computador, a tecla F1 abre esta tela de qualquer lugar.',
    exige: ['PEDIDOS_REGISTRAR'],
  },
  {
    id: 'fila',
    Icone: ChefHat,
    titulo: 'Fila de preparo: as comandas da cozinha',
    texto:
      'Cada pedido vira um cartão com o nome do cliente e os itens, na ordem de chegada. Toque em Começar preparo, depois Marcar pronto e, quando entregar, Entregue ao cliente. A fila se atualiza sozinha.',
    exige: ['FILA'],
  },
  {
    id: 'historico',
    Icone: Receipt,
    titulo: 'Histórico: todos os pedidos',
    texto:
      'Procure pedidos por dia, número, cliente, forma de pagamento ou status. Toque num pedido para ver os itens, o troco e o andamento do preparo.',
    exige: ['PEDIDOS_VER'],
  },
  {
    id: 'inicio',
    Icone: House,
    titulo: 'Início: como está o dia',
    texto:
      'Mostra os pedidos de hoje e, para quem cuida do caixa, o faturamento, o total em dinheiro e em PIX. Tem atalhos para abrir um novo pedido e a fila.',
    exige: ['PEDIDOS_VER', 'FINANCEIRO'],
  },
  {
    id: 'resumo',
    Icone: ChartColumnBig,
    titulo: 'Resumo de vendas: as contas',
    texto:
      'Escolha o período (hoje, ontem, 7 dias, o mês) e veja o faturamento, quantos pedidos, o total por forma de pagamento e os mais vendidos. Dá para imprimir.',
    exige: ['FINANCEIRO'],
  },
  {
    id: 'cardapio',
    Icone: Cookie,
    titulo: 'Cardápio: produtos e categorias',
    texto:
      'No menu Cadastros (no celular, em Mais) você cadastra produtos, muda preços e ingredientes e organiza as categorias. Desativar tira o produto do Novo pedido sem apagar os pedidos antigos.',
    exige: ['CARDAPIO'],
  },
  {
    id: 'usuarios',
    Icone: Users,
    titulo: 'Usuários: quem usa o sistema',
    texto:
      'Em Cadastros › Usuários você cria o acesso de cada pessoa, escolhe o perfil dela e gera uma senha nova quando alguém esquecer.',
    exige: ['USUARIOS'],
  },
  {
    id: 'perfis',
    Icone: ShieldCheck,
    titulo: 'Perfis e permissões',
    texto:
      'Em Cadastros › Perfis e permissões você escolhe o que o Gerente, o Chef e o Funcionário podem fazer. Vale na hora para todos daquele perfil.',
    exige: ['ADMIN'],
  },
  {
    id: 'topo',
    Icone: SunMoon,
    titulo: 'No alto da tela',
    texto:
      'A bolinha verde mostra que o sistema está conectado (vermelha é sem internet). A lua ou o sol troca entre o Modo Claro e o Modo Escuro. Tocando no seu nome você troca a senha, vê os atalhos e sai.',
  },
  {
    id: 'lampada',
    Icone: Lightbulb,
    titulo: 'Ficou com dúvida? Toque na lâmpada',
    texto:
      'Em todas as telas tem uma lâmpada no alto. Ela explica o que fazer naquela tela e como ela funciona. Este tutorial também pode ser visto de novo no menu com o seu nome › Ver tutorial.',
  },
];

export interface Passo {
  texto: string;
  exige?: Exige;
}

export interface AjudaTela {
  rota: RegExp;
  titulo: string;
  resumo: string;
  passos: Passo[];
}

/** O que a lâmpada de cada tela mostra: para que serve e como usar, passo a passo. */
export const AJUDA_TELAS: AjudaTela[] = [
  {
    rota: /^\/pedidos\/novo/,
    titulo: 'Novo pedido',
    resumo: 'Aqui você registra a venda do balcão, do primeiro produto até o pagamento.',
    passos: [
      { texto: 'Escolha a categoria nas abas (Pastéis, Bebidas...) ou digite na busca.' },
      {
        texto:
          'Toque no produto para colocar no pedido. Cada toque soma mais um; use − e + no pedido para ajustar, ou a lixeira para tirar.',
      },
      {
        texto:
          'Digite o nome do cliente: é ele que aparece na fila da cozinha para chamar quando ficar pronto. Quem já pediu aparece como sugestão; o telefone é opcional.',
      },
      {
        texto:
          'Escolha a forma de pagamento. Em Dinheiro, digite o valor recebido para o sistema calcular o troco.',
      },
      {
        texto:
          'Toque em Finalizar pedido. Se a internet cair, o pedido continua na tela e é só tentar de novo, sem duplicar.',
      },
      {
        texto:
          'No computador: F1 abre esta tela, "/" vai para a busca, F2 a F5 escolhem o pagamento e Ctrl+Enter finaliza.',
      },
    ],
  },
  {
    rota: /^\/pedidos\/\d+/,
    titulo: 'Detalhe do pedido',
    resumo: 'Mostra tudo de um pedido já gravado.',
    passos: [
      { texto: 'No alto: número, cliente, data, hora e quem registrou.' },
      { texto: 'Embaixo: os itens, o total, a forma de pagamento, o valor recebido e o troco.' },
      { texto: 'O andamento do preparo mostra se o pedido está na fila, pronto ou entregue.' },
      {
        texto:
          'Cancelar pedido pede um motivo. O pedido sai do faturamento, mas continua no histórico como cancelado. Não dá para desfazer.',
        exige: ['PEDIDOS_CANCELAR'],
      },
      { texto: 'Use "Voltar ao histórico" para voltar à lista.' },
    ],
  },
  {
    rota: /^\/pedidos/,
    titulo: 'Histórico de pedidos',
    resumo: 'A lista de todos os pedidos, com filtros para achar qualquer um.',
    passos: [
      { texto: 'Escolha o período: hoje, ontem, últimos 7 dias, este mês ou datas à sua escolha.' },
      {
        texto:
          'Filtre por status, forma de pagamento, quem registrou, número do pedido ou nome do cliente.',
      },
      { texto: 'Toque num pedido para abrir o detalhe.' },
      {
        texto: 'Embaixo aparece o total finalizado dos pedidos filtrados.',
        exige: ['FINANCEIRO'],
      },
      { texto: 'Limpar filtros volta a mostrar os pedidos de hoje.' },
    ],
  },
  {
    rota: /^\/fila/,
    titulo: 'Fila de preparo',
    resumo: 'As comandas da cozinha: o que preparar e em que ordem.',
    passos: [
      {
        texto:
          'Os pedidos chegam sozinhos em Aguardando, na ordem de chegada (1º, 2º...), com o nome do cliente e os itens.',
      },
      { texto: 'Toque em Começar preparo quando for fazer; o cartão vai para Preparando.' },
      { texto: 'Ficou pronto? Marcar pronto. Chame o cliente pelo nome.' },
      { texto: 'Entregou? Entregue ao cliente, e o cartão sai da fila.' },
      {
        texto:
          'Tocou errado? Voltar etapa no cartão, ou Voltar para a fila em "Entregues há pouco".',
      },
      {
        texto:
          'A tela se atualiza a cada 10 segundos, então o tablet da cozinha fica sempre em dia.',
      },
    ],
  },
  {
    rota: /^\/resumo/,
    titulo: 'Resumo de vendas',
    resumo: 'As contas do período: quanto vendeu e como pagaram.',
    passos: [
      {
        texto: 'Escolha o período no alto: hoje, ontem, últimos 7 dias, este mês ou outras datas.',
      },
      {
        texto: 'Os cartões mostram o faturamento, os pedidos finalizados, a média e os cancelados.',
      },
      { texto: 'Por forma de pagamento: quanto entrou em dinheiro, PIX e cartão.' },
      { texto: 'Mais vendidos: os produtos que mais saíram no período.' },
      { texto: 'Imprimir gera uma folha para guardar ou conferir o caixa.' },
    ],
  },
  {
    rota: /^\/produtos/,
    titulo: 'Produtos',
    resumo: 'O cardápio: o que aparece para vender no Novo pedido.',
    passos: [
      { texto: 'Use a busca e os filtros Ativos, Inativos e Todos para achar um produto.' },
      {
        texto:
          'Novo produto abre o formulário: nome, categoria, preço e ingredientes (opcional, aparece no Novo pedido).',
      },
      { texto: 'Editar muda o produto. Um preço novo vale só para os pedidos a partir de agora.' },
      {
        texto:
          'Desativar tira o produto do Novo pedido sem apagar os pedidos antigos. Ativar traz de volta.',
      },
    ],
  },
  {
    rota: /^\/categorias/,
    titulo: 'Categorias',
    resumo: 'As abas do Novo pedido (Pastéis, Bebidas, Doces...).',
    passos: [
      { texto: 'Nova categoria cria uma aba nova no Novo pedido.' },
      { texto: 'Editar troca o nome.' },
      {
        texto:
          'Desativar esconde a categoria e os produtos dela do Novo pedido. Os pedidos antigos não mudam.',
      },
    ],
  },
  {
    rota: /^\/usuarios/,
    titulo: 'Usuários',
    resumo: 'Quem pode entrar no sistema e com qual perfil.',
    passos: [
      { texto: 'Novo usuário: nome, login e perfil (Gerente, Chef ou Funcionário).' },
      {
        texto:
          'Gerar senha cria uma senha para a pessoa. Anote e entregue; depois ela troca no menu com o nome dela.',
      },
      { texto: 'Esqueceu a senha? Redefinir senha cria uma nova.' },
      {
        texto: 'Desativar impede a pessoa de entrar, mas os pedidos dela continuam no histórico.',
      },
      {
        texto: 'Só um administrador cria ou altera outro administrador.',
      },
    ],
  },
  {
    rota: /^\/perfis/,
    titulo: 'Perfis e permissões',
    resumo: 'O que cada perfil pode ver e fazer no sistema.',
    passos: [
      { texto: 'Cada cartão é um perfil, com um botão liga/desliga para cada permissão.' },
      { texto: 'Ligue ou desligue e toque em Salvar permissões. Vale na hora.' },
      { texto: 'Voltar ao padrão deixa o perfil como veio de fábrica.' },
      {
        texto:
          'O Administrador sempre pode tudo e não dá para mudar, para ninguém ficar trancado fora.',
      },
    ],
  },
  {
    rota: /^\/$/,
    titulo: 'Início',
    resumo: 'Um retrato do dia, para acompanhar o movimento.',
    passos: [
      {
        texto:
          'Os cartões do alto mostram o faturamento de hoje, os pedidos finalizados e quanto entrou em dinheiro e em PIX.',
        exige: ['FINANCEIRO'],
      },
      { texto: 'O botão Novo pedido abre a venda do balcão.', exige: ['PEDIDOS_REGISTRAR'] },
      { texto: 'O botão Fila de preparo abre as comandas da cozinha.', exige: ['FILA'] },
      {
        texto: 'Pedidos de hoje lista os últimos pedidos; Ver todos abre o histórico.',
        exige: ['PEDIDOS_VER'],
      },
      { texto: 'Ver resumo de vendas abre as contas completas.', exige: ['FINANCEIRO'] },
    ],
  },
];

export function ajudaDaTela(caminho: string) {
  return AJUDA_TELAS.find((a) => a.rota.test(caminho));
}
