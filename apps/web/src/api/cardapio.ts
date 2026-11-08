import { queryOptions } from '@tanstack/react-query';
import type { Categoria, ConfigPix, FormaPagamento, Produto } from '@patotinha/shared';
import { api } from './cliente';

/**
 * Consultas do cardápio que o Novo pedido usa. Ficam aqui para a tela e o pré-carregamento
 * (layout/FaixaConexao.tsx) usarem as mesmas chaves: assim a cópia no aparelho
 * (api/copiaLocal.ts) já existe antes de alguém abrir o Novo pedido sem servidor (etapa 17).
 */
export const consultaProdutosAtivos = queryOptions({
  queryKey: ['produtos', 'ativos'],
  queryFn: () => api<Produto[]>('/produtos?ativo=true'),
});

export const consultaCategoriasAtivas = queryOptions({
  queryKey: ['categorias', 'ativas'],
  queryFn: () => api<Categoria[]>('/categorias?ativo=true'),
});

export const consultaFormasPagamento = queryOptions({
  queryKey: ['formas-pagamento'],
  queryFn: () => api<FormaPagamento[]>('/formas-pagamento'),
  staleTime: Infinity,
});

export const consultaPix = queryOptions({
  queryKey: ['pix'],
  queryFn: () => api<ConfigPix>('/pix'),
  staleTime: 60_000,
});
