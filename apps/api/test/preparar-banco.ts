import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

/**
 * Antes dos testes: recria do zero o banco de teste (DATABASE_URL_TESTE) aplicando as
 * migrações do repositório, para os testes rodarem contra um PostgreSQL real (PRD 7.2).
 */
export default async function prepararBanco() {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, '../../../.env'));
  } catch {
    // CI: variáveis já vêm do ambiente.
  }
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) throw new Error('Defina DATABASE_URL_TESTE (banco só para testes) no .env.');
  if (url === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TESTE não pode ser o mesmo banco de DATABASE_URL.');
  }

  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const pasta = path.resolve(import.meta.dirname, '../prisma/migrations');
    const migracoes = readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const nome of migracoes) {
      await cliente.query(readFileSync(path.join(pasta, nome, 'migration.sql'), 'utf8'));
    }
  } finally {
    await cliente.end();
  }
}
