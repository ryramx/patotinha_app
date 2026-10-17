import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import argon2 from 'argon2';
import { ADMIN, CHEF, FUNCIONARIO, GERENTE } from './dados';

/**
 * Antes dos testes de ponta a ponta: recria o banco, aplica as migrações e cadastra
 * os usuários e o cardápio do exemplo do PRD 3.
 */
export default async function preparar() {
  const url = process.env.DATABASE_URL_E2E;
  if (!url) throw new Error('Defina DATABASE_URL_E2E ou DATABASE_URL_TESTE no .env.');
  if (url === process.env.DATABASE_URL && !process.env.CI) {
    throw new Error('O banco de ponta a ponta não pode ser o mesmo do desenvolvimento.');
  }
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const pasta = path.resolve(import.meta.dirname, '../apps/api/prisma/migrations');
    for (const nome of readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()) {
      await cliente.query(readFileSync(path.join(pasta, nome, 'migration.sql'), 'utf8'));
    }
    for (const [u, perfil] of [
      [ADMIN, 'ADMIN'],
      [FUNCIONARIO, 'FUNCIONARIO'],
      [GERENTE, 'GERENTE'],
      [CHEF, 'CHEF'],
    ] as const) {
      await cliente.query(
        'INSERT INTO usuarios (nome, login, senha_hash, perfil) VALUES ($1, $2, $3, $4)',
        [u.nome, u.login, await argon2.hash(u.senha, { type: argon2.argon2id }), perfil],
      );
    }
    await cliente.query(`
      INSERT INTO categorias (nome) VALUES ('Pastéis'), ('Bebidas'), ('Doces');
      INSERT INTO produtos (categoria_id, nome, preco) VALUES
        (1, 'Pastel de Carne', 8.00), (1, 'Pastel de Queijo', 7.00), (1, 'Pastel de Frango', 8.00),
        (2, 'Coca-Cola', 5.00), (2, 'Guaraná', 5.00),
        (3, 'Pastel de Chocolate', 9.00);`);
  } finally {
    await cliente.end();
  }
  // Aquece o servidor (conexões do banco e Argon2), para os tempos medidos serem os de uso normal.
  try {
    for (let i = 0; i < 3; i++) {
      await fetch('http://localhost:3100/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: FUNCIONARIO.login, senha: FUNCIONARIO.senha }),
      });
    }
  } catch {
    // Servidor ainda subindo: os testes esperam por ele.
  }
}
