import { z } from 'zod';

/**
 * Esquemas Zod usados ao mesmo tempo nos formulários e na API (PRD 7.1).
 * Limites de campo seguem a tabela final do plano de desenvolvimento.
 */

export const LIMITES = {
  quantidadeMax: 99,
  produtoNome: { min: 2, max: 80 },
  ingredientes: 300,
  categoriaNome: { min: 2, max: 40 },
  usuarioNome: { min: 1, max: 80 },
  login: { min: 3, max: 30 },
  senha: { min: 8, max: 128 },
  motivo: { min: 5, max: 200 },
  clienteNome: { min: 1, max: 40 },
  precoMaxCentavos: 999_999,
  tamanhoPaginaMax: 100,
} as const;

export const PERFIS = ['ADMIN', 'FUNCIONARIO'] as const;
export type Perfil = (typeof PERFIS)[number];

export const STATUS_PEDIDO = ['ABERTO', 'FINALIZADO', 'CANCELADO'] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

/** Fila de preparo da comanda: a ordem é sempre esta. */
export const STATUS_PREPARO = ['AGUARDANDO', 'PREPARANDO', 'PRONTO', 'ENTREGUE'] as const;
export type StatusPreparo = (typeof STATUS_PREPARO)[number];

export const CODIGOS_PAGAMENTO = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'] as const;
export type CodigoPagamento = (typeof CODIGOS_PAGAMENTO)[number];

const texto = (min: number, max: number, nomeCampo: string) =>
  z
    .string({ error: `Informe ${nomeCampo}` })
    .trim()
    .min(min, min <= 1 ? `Informe ${nomeCampo}` : `Use pelo menos ${min} caracteres`)
    .max(max, `Use no máximo ${max} caracteres`);

/** Valor em reais como string decimal ("8.00", "8", "8,5"). */
const dinheiro = (maxDigitosInteiros: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,${maxDigitosInteiros}}([.,]\\d{1,2})?$`), 'Valor inválido');

export const esquemaPreco = dinheiro(4).refine(
  (v) => Number(v.replace(',', '.')) * 100 <= LIMITES.precoMaxCentavos,
  'O preço pode ser no máximo R$ 9.999,99',
);

export const esquemaId = z.coerce.number().int().positive();

export const esquemaParamId = z.strictObject({ id: esquemaId });

export const esquemaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

export const esquemaBooleanoQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/* ---------- Auth ---------- */

export const esquemaLogin = z.strictObject({
  login: z.string().trim().min(1, 'Informe o usuário').max(50).toLowerCase(),
  senha: z.string().min(1, 'Informe a senha').max(LIMITES.senha.max),
});

export const esquemaSenhaNova = z
  .string()
  .min(LIMITES.senha.min, 'A senha precisa ter pelo menos 8 caracteres')
  .max(LIMITES.senha.max);

export const esquemaTrocarSenha = z.strictObject({
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
  novaSenha: esquemaSenhaNova,
});

/* ---------- Categorias ---------- */

export const esquemaCategoria = z.strictObject({
  nome: texto(LIMITES.categoriaNome.min, LIMITES.categoriaNome.max, 'o nome da categoria'),
});

export const esquemaStatus = z.strictObject({ ativo: z.boolean() });

export const esquemaFiltroCategorias = z.strictObject({
  ativo: esquemaBooleanoQuery.optional(),
});

/* ---------- Produtos ---------- */

export const esquemaProduto = z.strictObject({
  nome: texto(LIMITES.produtoNome.min, LIMITES.produtoNome.max, 'o nome do produto'),
  categoriaId: z.number({ error: 'Escolha uma categoria' }).int().positive('Escolha uma categoria'),
  preco: esquemaPreco,
  /** Opcional (o que o produto leva, ex.: recheio do pastel). Vazio vira null; ausente no PUT mantém. */
  ingredientes: z
    .string()
    .trim()
    .max(LIMITES.ingredientes, `Use no máximo ${LIMITES.ingredientes} caracteres`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
});

export const esquemaFiltroProdutos = z.strictObject({
  ativo: esquemaBooleanoQuery.optional(),
  categoriaId: esquemaId.optional(),
  busca: z.string().trim().max(80).optional(),
});

/* ---------- Usuários ---------- */

export const esquemaLoginNovo = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]{3,30}$/, 'Use só letras minúsculas, números, ponto e traço (3 a 30)');

export const esquemaUsuarioNovo = z.strictObject({
  nome: texto(LIMITES.usuarioNome.min, LIMITES.usuarioNome.max, 'o nome'),
  login: esquemaLoginNovo,
  perfil: z.enum(PERFIS),
  senha: esquemaSenhaNova,
});

export const esquemaUsuarioEdicao = z.strictObject({
  nome: texto(LIMITES.usuarioNome.min, LIMITES.usuarioNome.max, 'o nome'),
  login: esquemaLoginNovo,
  perfil: z.enum(PERFIS),
});

export const esquemaRedefinirSenha = z.strictObject({ novaSenha: esquemaSenhaNova });

export const esquemaFiltroUsuarios = z.strictObject({
  ativo: esquemaBooleanoQuery.optional(),
  perfil: z.enum(PERFIS).optional(),
});

/* ---------- Pedidos ---------- */

export const esquemaItemPedido = z.strictObject({
  produtoId: z.number().int().positive(),
  quantidade: z
    .number()
    .int('Use um número inteiro')
    .min(1, `Use um número de 1 a ${LIMITES.quantidadeMax}`)
    .max(LIMITES.quantidadeMax, `Use um número de 1 a ${LIMITES.quantidadeMax}`),
  precoExibido: esquemaPreco,
});

export const esquemaClienteNome = texto(
  LIMITES.clienteNome.min,
  LIMITES.clienteNome.max,
  'o nome do cliente',
).transform((v) => v.replace(/\s+/g, ' '));

export const esquemaNovoPedido = z.strictObject({
  chaveIdempotencia: z.uuid(),
  cliente: esquemaClienteNome,
  formaPagamento: z.string().trim().min(1).max(20),
  valorRecebido: dinheiro(8).nullish(),
  itens: z.array(esquemaItemPedido).max(200),
});

export const esquemaFiltroPedidos = z.strictObject({
  de: esquemaDia.optional(),
  ate: esquemaDia.optional(),
  status: z.enum(STATUS_PEDIDO).optional(),
  formaPagamento: z.enum(CODIGOS_PAGAMENTO).optional(),
  usuarioId: esquemaId.optional(),
  numero: esquemaId.optional(),
  cliente: z.string().trim().max(LIMITES.clienteNome.max).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(LIMITES.tamanhoPaginaMax).default(50),
});

export const esquemaCancelamento = z.strictObject({
  motivo: z
    .string({ error: 'Informe o motivo' })
    .trim()
    .min(LIMITES.motivo.min, 'Escreva o motivo (pelo menos 5 letras)')
    .max(LIMITES.motivo.max, `Use no máximo ${LIMITES.motivo.max} caracteres`),
});

export const esquemaPreparo = z.strictObject({
  status: z.enum(STATUS_PREPARO, { error: 'Status de preparo inválido' }),
});

/* ---------- Relatórios ---------- */

export const esquemaFiltroRelatorio = z.strictObject({
  de: esquemaDia.optional(),
  ate: esquemaDia.optional(),
  limiteProdutos: z.coerce.number().int().min(1).max(50).default(10),
});

export type DadosLogin = z.infer<typeof esquemaLogin>;
export type DadosCategoria = z.infer<typeof esquemaCategoria>;
export type DadosProduto = z.infer<typeof esquemaProduto>;
export type DadosUsuarioNovo = z.infer<typeof esquemaUsuarioNovo>;
export type DadosUsuarioEdicao = z.infer<typeof esquemaUsuarioEdicao>;
export type DadosNovoPedido = z.infer<typeof esquemaNovoPedido>;
export type FiltroPedidos = z.infer<typeof esquemaFiltroPedidos>;
