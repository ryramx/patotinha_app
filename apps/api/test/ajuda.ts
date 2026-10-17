import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { construirApp } from '../src/app.js';
import { criarBanco, type Banco } from '../src/banco.js';
import { gerarHash } from '../src/auth/senha.js';
import { LimiteLogin } from '../src/auth/limite-login.js';
import type { Config } from '../src/config.js';

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../../../.env'));
} catch {
  // CI
}

export const SENHA = 'senha-de-teste-123';

export interface Contexto {
  app: FastifyInstance;
  banco: Banco;
  limite: LimiteLogin;
  http: () => ReturnType<typeof request>;
}

export async function criarContexto(config: Partial<Config> = {}): Promise<Contexto> {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) throw new Error('DATABASE_URL_TESTE não definida');
  const banco = criarBanco(url);
  const limite = new LimiteLogin();
  const app = await construirApp({
    config: {
      databaseUrl: url,
      jwtSecret: 'segredo-de-teste-com-pelo-menos-32-caracteres',
      ambiente: 'test',
      appOrigin: 'http://localhost',
      porta: 0,
      pastaWeb: null,
      siteUrl: null,
      ...config,
    },
    banco,
    logger: false,
    limiteLogin: limite,
  });
  await app.ready();
  return { app, banco, limite, http: () => request(app.server) };
}

export async function limparBanco(banco: Banco) {
  await banco.$executeRawUnsafe(
    'TRUNCATE itens_pedido, pedidos, produtos, categorias, usuarios RESTART IDENTITY CASCADE',
  );
  await banco.$executeRawUnsafe('UPDATE formas_pagamento SET ativo = true');
}

let hashPadrao: Promise<string> | null = null;

export async function criarUsuario(
  banco: Banco,
  login: string,
  perfil: 'ADMIN' | 'FUNCIONARIO' = 'FUNCIONARIO',
  nome = login[0]!.toUpperCase() + login.slice(1),
) {
  hashPadrao ??= gerarHash(SENHA);
  return banco.usuario.create({
    data: { nome, login, perfil, senhaHash: await hashPadrao },
  });
}

/** Faz login e devolve o cabeçalho Cookie da sessão. */
export async function entrar(ctx: Contexto, login: string, senha = SENHA): Promise<string> {
  const resposta = await ctx.http().post('/api/auth/login').send({ login, senha });
  if (resposta.status !== 200) throw new Error(`login falhou: ${resposta.status}`);
  const cookies = resposta.headers['set-cookie'] as unknown as string[];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

/** Cardápio do exemplo do PRD 3. */
export async function criarCardapio(banco: Banco) {
  const pasteis = await banco.categoria.create({ data: { nome: 'Pastéis' } });
  const bebidas = await banco.categoria.create({ data: { nome: 'Bebidas' } });
  const carne = await banco.produto.create({
    data: { nome: 'Pastel de Carne', preco: '8.00', categoriaId: pasteis.id },
  });
  const queijo = await banco.produto.create({
    data: { nome: 'Pastel de Queijo', preco: '7.00', categoriaId: pasteis.id },
  });
  const coca = await banco.produto.create({
    data: { nome: 'Coca-Cola', preco: '5.00', categoriaId: bebidas.id },
  });
  return {
    pasteis,
    bebidas,
    carne: Number(carne.id),
    queijo: Number(queijo.id),
    coca: Number(coca.id),
  };
}

export function pedidoExemplo(
  c: { carne: number; queijo: number; coca: number },
  extra: Partial<{
    formaPagamento: string;
    valorRecebido: string | null;
    chaveIdempotencia: string;
    cliente: string;
  }> = {},
) {
  return {
    chaveIdempotencia: randomUUID(),
    cliente: 'Joana',
    formaPagamento: 'PIX',
    itens: [
      { produtoId: c.carne, quantidade: 2, precoExibido: '8.00' },
      { produtoId: c.queijo, quantidade: 1, precoExibido: '7.00' },
      { produtoId: c.coca, quantidade: 2, precoExibido: '5.00' },
    ],
    ...extra,
  };
}
