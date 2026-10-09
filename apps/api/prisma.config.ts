import path from 'node:path';
import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê o .env sozinho; o arquivo fica na raiz do repositório.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
} catch {
  // Sem .env (CI ou produção): as variáveis já vêm do ambiente.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
