import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '.env'));
} catch {
  // CI: variáveis vêm do ambiente.
}

// Banco usado pelos testes de ponta a ponta: é apagado e recriado a cada execução.
const bancoE2E = process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL_TESTE;
process.env.DATABASE_URL_E2E = bancoE2E;
const PORTA = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/preparar.ts',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'computador',
      // No PC de desenvolvimento usa o Edge já instalado; no CI, o Chromium do Playwright.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
        ...(process.env.CI ? {} : { channel: 'msedge' }),
      },
    },
    {
      name: 'tablet',
      testMatch: /tela-novo-pedido/,
      grepInvert: /CA-04/, // o teste de preço altera o cadastro; roda uma vez só
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        ...(process.env.CI ? {} : { channel: 'msedge' }),
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -w apps/api',
    url: `http://localhost:${PORTA}/api/saude`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: bancoE2E ?? '',
      JWT_SECRET: process.env.JWT_SECRET ?? 'segredo-dos-testes-de-ponta-a-ponta-32+',
      NODE_ENV: 'test',
      PORT: String(PORTA),
      PASTA_WEB: path.resolve(import.meta.dirname, 'apps/web/dist'),
      TZ: 'America/Sao_Paulo',
      LOG_LEVEL: 'warn',
    },
  },
});
