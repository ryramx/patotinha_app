/** Configuração somente por variáveis de ambiente (PRD 7.4). */

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida. Veja o .env.example.`);
  return valor;
}

export interface Config {
  databaseUrl: string;
  jwtSecret: string;
  ambiente: 'development' | 'production' | 'test';
  appOrigin: string;
  porta: number;
  /** Pasta com o build do frontend, servida pela própria API (PRD 7.3). */
  pastaWeb: string | null;
  /**
   * Endereço do site (Static Site do Render). Quando definido, quem abre as telas pelo endereço
   * da API é levado para lá; a API continua respondendo em /api.
   */
  siteUrl: string | null;
}

export function lerConfig(): Config {
  const ambiente = (process.env.NODE_ENV ?? 'development') as Config['ambiente'];
  const jwtSecret = obrigatoria('JWT_SECRET');
  if (ambiente === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção.');
  }
  return {
    databaseUrl: obrigatoria('DATABASE_URL'),
    jwtSecret,
    ambiente,
    appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    porta: Number(process.env.PORT ?? 3000),
    pastaWeb: process.env.PASTA_WEB ?? null,
    siteUrl: process.env.SITE_URL?.replace(/\/+$/, '') || null,
  };
}
