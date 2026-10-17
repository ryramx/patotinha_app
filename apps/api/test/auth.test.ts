import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarContexto, criarUsuario, entrar, limparBanco, SENHA, type Contexto } from './ajuda.js';

let ctx: Contexto;
beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  ctx.limite.limpar();
  await criarUsuario(ctx.banco, 'admin', 'ADMIN', 'Ana');
  await criarUsuario(ctx.banco, 'maria');
});

describe('CA-01 Login', () => {
  it('usuário ativo entra, recebe cookie seguro e não vê o hash', async () => {
    const r = await ctx.http().post('/api/auth/login').send({ login: 'Maria', senha: SENHA });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      usuario: {
        id: expect.any(Number),
        nome: 'Maria',
        login: 'maria',
        perfil: 'FUNCIONARIO',
        permissoes: ['PEDIDOS_REGISTRAR'],
        tutorialVisto: false,
      },
    });
    const cookie = (r.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^sessao=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Max-Age=43200/);
  });

  it('senha errada recebe a mensagem única', async () => {
    const r = await ctx.http().post('/api/auth/login').send({ login: 'maria', senha: 'errada123' });
    expect(r.status).toBe(401);
    expect(r.body.erro).toMatchObject({
      codigo: 'CREDENCIAIS_INVALIDAS',
      mensagem: 'Usuário ou senha inválidos',
    });
  });

  it('login inexistente recebe a mesma mensagem', async () => {
    const r = await ctx.http().post('/api/auth/login').send({ login: 'ninguem', senha: SENHA });
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('usuário desativado não entra, mesmo com a senha certa', async () => {
    await ctx.banco.usuario.updateMany({ where: { login: 'maria' }, data: { ativo: false } });
    const r = await ctx.http().post('/api/auth/login').send({ login: 'maria', senha: SENHA });
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('usuário desativado com sessão aberta perde o acesso na próxima requisição', async () => {
    const cookie = await entrar(ctx, 'maria');
    expect((await ctx.http().get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    await ctx.banco.usuario.updateMany({ where: { login: 'maria' }, data: { ativo: false } });
    const r = await ctx.http().get('/api/auth/me').set('Cookie', cookie);
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('mudança de perfil derruba a sessão antiga', async () => {
    const cookie = await entrar(ctx, 'maria');
    await ctx.banco.usuario.updateMany({ where: { login: 'maria' }, data: { perfil: 'ADMIN' } });
    expect((await ctx.http().get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('5 tentativas erradas em 1 minuto bloqueiam a sexta', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await ctx
        .http()
        .post('/api/auth/login')
        .send({ login: 'maria', senha: 'errada' + i });
      expect(r.status).toBe(401);
    }
    const r = await ctx.http().post('/api/auth/login').send({ login: 'maria', senha: SENHA });
    expect(r.status).toBe(429);
    expect(r.body.erro).toMatchObject({
      codigo: 'MUITAS_TENTATIVAS',
      mensagem: 'Muitas tentativas. Aguarde 1 minuto e tente de novo',
    });
  });

  it('funcionário não acessa rotas de administrador (403)', async () => {
    const cookie = await entrar(ctx, 'maria');
    const r = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', cookie)
      .send({ nome: 'X', categoriaId: 1, preco: '1.00' });
    expect(r.status).toBe(403);
    expect(r.body.erro.codigo).toBe('SEM_PERMISSAO');
    for (const rota of ['/api/usuarios', '/api/relatorios/vendas']) {
      expect((await ctx.http().get(rota).set('Cookie', cookie)).status).toBe(403);
    }
  });

  it('sem sessão recebe 401', async () => {
    const r = await ctx.http().get('/api/produtos');
    expect(r.status).toBe(401);
  });

  it('dados de login vazios dão 422', async () => {
    const r = await ctx.http().post('/api/auth/login').send({ login: '', senha: '' });
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('DADOS_INVALIDOS');
  });
});

describe('Logout, sessão e troca de senha', () => {
  it('logout apaga o cookie', async () => {
    const cookie = await entrar(ctx, 'maria');
    const r = await ctx.http().post('/api/auth/logout').set('Cookie', cookie).send({});
    expect(r.status).toBe(204);
    expect((r.headers['set-cookie'] as unknown as string[])[0]).toMatch(/sessao=;/);
  });

  it('GET /auth/me devolve o usuário da sessão', async () => {
    const cookie = await entrar(ctx, 'admin');
    const r = await ctx.http().get('/api/auth/me').set('Cookie', cookie);
    expect(r.body.usuario).toMatchObject({ login: 'admin', perfil: 'ADMIN', nome: 'Ana' });
  });

  it('troca a própria senha exigindo a atual', async () => {
    const cookie = await entrar(ctx, 'maria');
    const errada = await ctx
      .http()
      .put('/api/auth/senha')
      .set('Cookie', cookie)
      .send({ senhaAtual: 'xxxxxxxx', novaSenha: 'nova-senha-123' });
    expect(errada.status).toBe(401);
    expect(errada.body.erro.codigo).toBe('SENHA_ATUAL_INCORRETA');

    const fraca = await ctx
      .http()
      .put('/api/auth/senha')
      .set('Cookie', cookie)
      .send({ senhaAtual: SENHA, novaSenha: '123' });
    expect(fraca.status).toBe(422);
    expect(fraca.body.erro.codigo).toBe('SENHA_FRACA');

    const ok = await ctx
      .http()
      .put('/api/auth/senha')
      .set('Cookie', cookie)
      .send({ senhaAtual: SENHA, novaSenha: 'nova-senha-123' });
    expect(ok.status).toBe(204);
    await expect(entrar(ctx, 'maria', 'nova-senha-123')).resolves.toMatch(/sessao=/);
  });
});

describe('Proteções gerais', () => {
  it('escrita sem application/json é recusada (CSRF)', async () => {
    const r = await ctx
      .http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('login=maria&senha=x');
    expect(r.status).toBe(415);
    expect(r.body.erro.codigo).toBe('CONTENT_TYPE_INVALIDO');
  });

  it('JSON malformado dá 400', async () => {
    const r = await ctx
      .http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{login');
    expect(r.status).toBe(400);
    expect(r.body.erro.codigo).toBe('JSON_INVALIDO');
  });

  it('campos desconhecidos são rejeitados', async () => {
    const r = await ctx
      .http()
      .post('/api/auth/login')
      .send({ login: 'maria', senha: SENHA, perfil: 'ADMIN' });
    expect(r.status).toBe(422);
  });

  it('saúde responde com app e banco ok', async () => {
    const r = await ctx.http().get('/api/saude');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok', banco: 'ok' });
  });

  it('vivo responde sem consultar o banco', async () => {
    const r = await ctx.http().get('/api/vivo');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok' });
  });

  it('cabeçalhos de segurança do Helmet', async () => {
    const r = await ctx.http().get('/api/saude');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toBeDefined();
  });
});

describe('Tutorial de primeiro acesso', () => {
  it('começa não visto e, marcado, fica visto no login e no /auth/me', async () => {
    const login = await ctx.http().post('/api/auth/login').send({ login: 'maria', senha: SENHA });
    expect(login.body.usuario.tutorialVisto).toBe(false);
    const cookie = await entrar(ctx, 'maria');

    expect((await ctx.http().put('/api/auth/tutorial').set('Cookie', cookie).send({})).status).toBe(
      204,
    );
    const me = await ctx.http().get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.usuario.tutorialVisto).toBe(true);
    // Marcar de novo não muda a data da primeira vez.
    const antes = await ctx.banco.usuario.findFirstOrThrow({ where: { login: 'maria' } });
    expect((await ctx.http().put('/api/auth/tutorial').set('Cookie', cookie).send({})).status).toBe(
      204,
    );
    const depois = await ctx.banco.usuario.findFirstOrThrow({ where: { login: 'maria' } });
    expect(depois.tutorialVistoEm).toEqual(antes.tutorialVistoEm);

    const outra = await ctx.http().post('/api/auth/login').send({ login: 'admin', senha: SENHA });
    expect(outra.body.usuario.tutorialVisto).toBe(false);
  });

  it('exige login', async () => {
    expect((await ctx.http().put('/api/auth/tutorial').send({})).status).toBe(401);
  });
});
