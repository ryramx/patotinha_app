import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export type Banco = PrismaClient;

/**
 * Pool pequeno, de 5 a 10 conexões (PRD 7.2). A sessão do banco fica em UTC porque o adaptador
 * do Prisma lê TIMESTAMPTZ sem o deslocamento; a conversão para Brasília é feita na API.
 */
export function criarBanco(databaseUrl: string): Banco {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 10,
    options: '-c TimeZone=UTC',
  });
  return new PrismaClient({ adapter });
}

export { Prisma } from './generated/prisma/client.js';
