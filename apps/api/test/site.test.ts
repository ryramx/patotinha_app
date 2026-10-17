import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarContexto, type Contexto } from './ajuda.js';

/** Site separado da API (Plano, etapa 9): o endereço antigo leva para o Static Site. */
let ctx: Contexto;
beforeAll(async () => {
  ctx = await criarContexto({ siteUrl: 'https://patotinha-da-vovo.onrender.com' });
});
afterAll(async () => {
  await ctx.app.close();
});

describe('Endereço antigo das telas', () => {
  it('leva para o site novo mantendo o caminho', async () => {
    const r = await ctx.http().get('/pedidos/novo?aba=2');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('https://patotinha-da-vovo.onrender.com/pedidos/novo?aba=2');
  });

  it('a raiz também vai para o site', async () => {
    const r = await ctx.http().get('/');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('https://patotinha-da-vovo.onrender.com/');
  });

  it('a API continua respondendo no endereço antigo', async () => {
    const vivo = await ctx.http().get('/api/vivo');
    expect(vivo.status).toBe(200);
    expect(vivo.body).toEqual({ status: 'ok' });

    const inexistente = await ctx.http().get('/api/nao-existe');
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });
});

describe('Respostas da API', () => {
  it('não podem ser guardadas pela CDN', async () => {
    const r = await ctx.http().get('/api/vivo');
    expect(r.headers['cache-control']).toBe('no-store');
  });
});
