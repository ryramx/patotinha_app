import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarContexto, criarUsuario, entrar, limparBanco, type Contexto } from './ajuda.js';

let ctx: Contexto;
let admin: string;
let func: string;
let chef: string;

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  await criarUsuario(ctx.banco, 'ryan', 'ADMIN');
  await criarUsuario(ctx.banco, 'maria', 'FUNCIONARIO');
  await criarUsuario(ctx.banco, 'rui', 'CHEF');
  [admin, func, chef] = await Promise.all([
    entrar(ctx, 'ryan'),
    entrar(ctx, 'maria'),
    entrar(ctx, 'rui'),
  ]);
});

const config = {
  tipoChave: 'TELEFONE',
  chave: '(11) 98765-4321',
  nome: 'Patotinha da Vovó',
  cidade: 'São Paulo',
};

describe('Pix da loja', () => {
  it('sem cadastro, quem registra pedidos vê que o Pix não está configurado', async () => {
    const r = await ctx.http().get('/api/pix').set('Cookie', func);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      configurado: false,
      tipoChave: null,
      chave: null,
      nome: null,
      cidade: null,
      atualizadoEm: null,
    });
  });

  it('o administrador salva e muda; a chave e os textos ficam no formato do Pix', async () => {
    const r = await ctx.http().put('/api/pix').set('Cookie', admin).send(config);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      configurado: true,
      tipoChave: 'TELEFONE',
      chave: '+5511987654321',
      nome: 'Patotinha da Vovo',
      cidade: 'Sao Paulo',
    });
    const outra = await ctx
      .http()
      .put('/api/pix')
      .set('Cookie', admin)
      .send({ ...config, tipoChave: 'EMAIL', chave: 'Vovo@Patotinha.com' });
    expect(outra.body.chave).toBe('vovo@patotinha.com');
    expect(await ctx.banco.configPix.count()).toBe(1);
    const lida = await ctx.http().get('/api/pix').set('Cookie', func);
    expect(lida.body.chave).toBe('vovo@patotinha.com');
  });

  it('chave que não confere com o tipo é recusada, apontando o campo', async () => {
    const r = await ctx
      .http()
      .put('/api/pix')
      .set('Cookie', admin)
      .send({ ...config, tipoChave: 'CPF', chave: '111.111.111-11' });
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('PIX_INVALIDO');
    expect(r.body.erro.detalhes[0].campo).toBe('chave');
  });

  it('só o administrador muda; quem não vê nem registra pedidos não lê', async () => {
    expect((await ctx.http().put('/api/pix').set('Cookie', func).send(config)).status).toBe(403);
    expect((await ctx.http().get('/api/pix').set('Cookie', chef)).status).toBe(403);
    expect((await ctx.http().get('/api/pix')).status).toBe(401);
  });
});
