import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarContexto, criarUsuario, entrar, limparBanco, type Contexto } from './ajuda.js';

let ctx: Contexto;
let admin: string;
let adminId: number;

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  adminId = Number((await criarUsuario(ctx.banco, 'admin', 'ADMIN', 'Ana')).id);
  admin = await entrar(ctx, 'admin');
});

describe('CA-11 Usuários', () => {
  it('cria funcionário que entra e não vê telas de admin; respostas sem senha nem hash', async () => {
    const r = await ctx
      .http()
      .post('/api/usuarios')
      .set('Cookie', admin)
      .send({ nome: 'João', login: 'joao', perfil: 'FUNCIONARIO', senha: 'senha-joao-1' });
    expect(r.status).toBe(201);
    expect(JSON.stringify(r.body)).not.toMatch(/senha|hash/i);

    const joao = await entrar(ctx, 'joao', 'senha-joao-1');
    expect((await ctx.http().get('/api/usuarios').set('Cookie', joao)).status).toBe(403);

    const lista = await ctx.http().get('/api/usuarios').set('Cookie', admin);
    expect(JSON.stringify(lista.body)).not.toMatch(/senha|hash|argon/i);
    const um = await ctx.http().get(`/api/usuarios/${r.body.id}`).set('Cookie', admin);
    expect(JSON.stringify(um.body)).not.toMatch(/senha|hash|argon/i);
  });

  it('login repetido com outra caixa é recusado', async () => {
    await criarUsuario(ctx.banco, 'joao');
    const r = await ctx
      .http()
      .post('/api/usuarios')
      .set('Cookie', admin)
      .send({ nome: 'Outro', login: 'joao', perfil: 'FUNCIONARIO', senha: 'senha-1234' });
    expect(r.status).toBe(409);
    expect(r.body.erro).toMatchObject({
      codigo: 'LOGIN_DUPLICADO',
      mensagem: 'Esse login já está em uso',
    });
  });

  it('login fora do padrão (maiúsculas) e senha curta são recusados', async () => {
    const maiusc = await ctx
      .http()
      .post('/api/usuarios')
      .set('Cookie', admin)
      .send({ nome: 'X', login: 'Joao', perfil: 'FUNCIONARIO', senha: 'senha-1234' });
    expect(maiusc.status).toBe(422);
    const curta = await ctx
      .http()
      .post('/api/usuarios')
      .set('Cookie', admin)
      .send({ nome: 'X', login: 'xis', perfil: 'FUNCIONARIO', senha: '123' });
    expect(curta.status).toBe(422);
    expect(curta.body.erro.codigo).toBe('SENHA_FRACA');
  });

  it('o único admin não pode se desativar nem se rebaixar', async () => {
    const desativar = await ctx
      .http()
      .patch(`/api/usuarios/${adminId}/status`)
      .set('Cookie', admin)
      .send({ ativo: false });
    expect(desativar.status).toBe(422);
    expect(desativar.body.erro.codigo).toBe('NAO_PODE_DESATIVAR_A_SI_MESMO');

    const rebaixar = await ctx
      .http()
      .put(`/api/usuarios/${adminId}`)
      .set('Cookie', admin)
      .send({ nome: 'Ana', login: 'admin', perfil: 'FUNCIONARIO' });
    expect(rebaixar.status).toBe(422);
    expect(rebaixar.body.erro.codigo).toBe('ULTIMO_ADMIN');
  });

  it('desativa outro usuário, que perde a sessão; reativa depois', async () => {
    const maria = await criarUsuario(ctx.banco, 'maria');
    const sessao = await entrar(ctx, 'maria');
    const r = await ctx
      .http()
      .patch(`/api/usuarios/${maria.id}/status`)
      .set('Cookie', admin)
      .send({ ativo: false });
    expect(r.status).toBe(200);
    expect(r.body.ativo).toBe(false);
    expect((await ctx.http().get('/api/auth/me').set('Cookie', sessao)).status).toBe(401);

    const volta = await ctx
      .http()
      .patch(`/api/usuarios/${maria.id}/status`)
      .set('Cookie', admin)
      .send({ ativo: true });
    expect(volta.body.ativo).toBe(true);
  });

  it('com dois admins, um pode rebaixar o outro', async () => {
    const outro = await criarUsuario(ctx.banco, 'beto', 'ADMIN');
    const r = await ctx
      .http()
      .put(`/api/usuarios/${outro.id}`)
      .set('Cookie', admin)
      .send({ nome: 'Beto', login: 'beto', perfil: 'FUNCIONARIO' });
    expect(r.status).toBe(200);
    expect(r.body.perfil).toBe('FUNCIONARIO');
  });

  it('redefine a senha de outro usuário', async () => {
    const maria = await criarUsuario(ctx.banco, 'maria');
    const r = await ctx
      .http()
      .put(`/api/usuarios/${maria.id}/senha`)
      .set('Cookie', admin)
      .send({ novaSenha: 'senha-nova-99' });
    expect(r.status).toBe(204);
    await expect(entrar(ctx, 'maria', 'senha-nova-99')).resolves.toMatch(/sessao=/);
  });

  it('usuário inexistente dá 404', async () => {
    const r = await ctx.http().get('/api/usuarios/9999').set('Cookie', admin);
    expect(r.status).toBe(404);
  });
});
