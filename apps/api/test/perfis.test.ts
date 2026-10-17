import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarCardapio,
  criarContexto,
  criarUsuario,
  entrar,
  limparBanco,
  pedidoExemplo,
  type Contexto,
} from './ajuda.js';

let ctx: Contexto;
let admin: string;
let gerente: string;
let chef: string;
let func: string;
let cardapio: Awaited<ReturnType<typeof criarCardapio>>;

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  await criarUsuario(ctx.banco, 'admin', 'ADMIN', 'Ana');
  await criarUsuario(ctx.banco, 'gerente', 'GERENTE', 'Gil');
  await criarUsuario(ctx.banco, 'chef', 'CHEF', 'Vô Zé');
  await criarUsuario(ctx.banco, 'maria', 'FUNCIONARIO', 'Maria');
  admin = await entrar(ctx, 'admin');
  gerente = await entrar(ctx, 'gerente');
  chef = await entrar(ctx, 'chef');
  func = await entrar(ctx, 'maria');
  cardapio = await criarCardapio(ctx.banco);
});

const get = (url: string, cookie: string) => ctx.http().get(url).set('Cookie', cookie);
const registrar = (cookie: string) =>
  ctx.http().post('/api/pedidos').set('Cookie', cookie).send(pedidoExemplo(cardapio));

describe('Perfis de acesso: permissões de fábrica', () => {
  it('funcionário só registra pedidos', async () => {
    expect((await registrar(func)).status).toBe(201);
    expect((await get('/api/produtos?ativo=true', func)).status).toBe(200);
    expect((await get('/api/formas-pagamento', func)).status).toBe(200);
    for (const url of ['/api/pedidos', '/api/pedidos/1', '/api/fila', '/api/relatorios/vendas']) {
      const r = await get(url, func);
      expect(r.status, url).toBe(403);
      expect(r.body.erro.codigo).toBe('SEM_PERMISSAO');
    }
    expect((await get('/api/usuarios', func)).status).toBe(403);
    expect((await get('/api/perfis', func)).status).toBe(403);
  });

  it('chef vê e avança a fila, mas não registra nem vê o financeiro', async () => {
    const pedido = await registrar(admin);
    const fila = await get('/api/fila', chef);
    expect(fila.status).toBe(200);
    expect(fila.body.dados).toHaveLength(1);
    const avanco = await ctx
      .http()
      .patch(`/api/pedidos/${pedido.body.id}/preparo`)
      .set('Cookie', chef)
      .send({ status: 'PREPARANDO' });
    expect(avanco.status).toBe(200);
    expect((await registrar(chef)).status).toBe(403);
    expect((await get('/api/relatorios/vendas', chef)).status).toBe(403);
    expect((await get('/api/pedidos', chef)).status).toBe(403);
  });

  it('gerente registra, vê pedidos com a soma e o resumo de vendas, mas não cancela nem cadastra', async () => {
    const pedido = await registrar(gerente);
    expect(pedido.status).toBe(201);
    const lista = await get('/api/pedidos', gerente);
    expect(lista.status).toBe(200);
    expect(lista.body.somaFinalizados).toBe('33.00');
    expect((await get('/api/relatorios/vendas', gerente)).status).toBe(200);
    const cancelar = await ctx
      .http()
      .patch(`/api/pedidos/${pedido.body.id}/cancelar`)
      .set('Cookie', gerente)
      .send({ motivo: 'Teste de permissão' });
    expect(cancelar.status).toBe(403);
    const produto = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', gerente)
      .send({ nome: 'Pastel novo', categoriaId: Number(cardapio.pasteis.id), preco: '9.00' });
    expect(produto.status).toBe(403);
    expect((await get('/api/fila', gerente)).status).toBe(403);
  });

  it('login e /auth/me devolvem as permissões do perfil; o administrador tem todas', async () => {
    const me = await get('/api/auth/me', chef);
    expect(me.body.usuario).toMatchObject({ perfil: 'CHEF', permissoes: ['FILA'] });
    const meAdmin = await get('/api/auth/me', admin);
    expect(meAdmin.body.usuario.permissoes).toHaveLength(7);
  });
});

describe('Tela Perfis e permissões', () => {
  it('lista os quatro perfis em ordem, com permissões e usuários ativos', async () => {
    const r = await get('/api/perfis', admin);
    expect(r.status).toBe(200);
    expect(r.body.map((p: { codigo: string }) => p.codigo)).toEqual([
      'ADMIN',
      'GERENTE',
      'CHEF',
      'FUNCIONARIO',
    ]);
    expect(r.body[0]).toMatchObject({ nome: 'Administrador', editavel: false, usuariosAtivos: 1 });
    expect(r.body[2]).toMatchObject({ nome: 'Chef', permissoes: ['FILA'], editavel: true });
  });

  it('só o administrador vê e muda as permissões', async () => {
    expect((await get('/api/perfis', gerente)).status).toBe(403);
    const r = await ctx
      .http()
      .put('/api/perfis/CHEF/permissoes')
      .set('Cookie', gerente)
      .send({ permissoes: ['FILA', 'FINANCEIRO'] });
    expect(r.status).toBe(403);
  });

  it('mudar as permissões vale na hora, sem sair e entrar de novo', async () => {
    expect((await get('/api/pedidos', chef)).status).toBe(403);
    const r = await ctx
      .http()
      .put('/api/perfis/CHEF/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: ['PEDIDOS_VER', 'FILA', 'FILA'] });
    expect(r.status).toBe(200);
    // Sem repetição e na ordem da tela.
    expect(r.body.permissoes).toEqual(['PEDIDOS_VER', 'FILA']);
    expect((await get('/api/pedidos', chef)).status).toBe(200);

    const tirar = await ctx
      .http()
      .put('/api/perfis/CHEF/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: [] });
    expect(tirar.status).toBe(200);
    expect((await get('/api/fila', chef)).status).toBe(403);
  });

  it('o perfil Administrador é fixo; perfil ou permissão desconhecida é recusada', async () => {
    const fixo = await ctx
      .http()
      .put('/api/perfis/ADMIN/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: [] });
    expect(fixo.status).toBe(422);
    expect(fixo.body.erro.codigo).toBe('PERFIL_FIXO');

    const desconhecida = await ctx
      .http()
      .put('/api/perfis/CHEF/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: ['APAGAR_TUDO'] });
    expect(desconhecida.status).toBe(422);

    const perfil = await ctx
      .http()
      .put('/api/perfis/DONO/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: [] });
    expect(perfil.status).toBe(422);
  });
});

describe('Usuários com os perfis novos', () => {
  it('administrador cria usuário Chef e Gerente', async () => {
    for (const perfil of ['CHEF', 'GERENTE']) {
      const r = await ctx
        .http()
        .post('/api/usuarios')
        .set('Cookie', admin)
        .send({ nome: perfil, login: perfil.toLowerCase() + '2', perfil, senha: 'senha-1234' });
      expect(r.status).toBe(201);
      expect(r.body.perfil).toBe(perfil);
    }
  });

  it('gerente com a permissão Usuários cadastra funcionário, mas não cria nem mexe em administrador', async () => {
    await ctx
      .http()
      .put('/api/perfis/GERENTE/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: ['USUARIOS'] });

    const novo = await ctx
      .http()
      .post('/api/usuarios')
      .set('Cookie', gerente)
      .send({ nome: 'Lia', login: 'lia', perfil: 'FUNCIONARIO', senha: 'senha-1234' });
    expect(novo.status).toBe(201);

    const virarAdmin = await ctx
      .http()
      .put(`/api/usuarios/${novo.body.id}`)
      .set('Cookie', gerente)
      .send({ nome: 'Lia', login: 'lia', perfil: 'ADMIN' });
    expect(virarAdmin.status).toBe(403);
    expect(virarAdmin.body.erro.codigo).toBe('SO_ADMIN');

    const criarAdmin = await ctx
      .http()
      .post('/api/usuarios')
      .set('Cookie', gerente)
      .send({ nome: 'Rui', login: 'rui', perfil: 'ADMIN', senha: 'senha-1234' });
    expect(criarAdmin.status).toBe(403);

    const lista = await get('/api/usuarios', gerente);
    const ana = lista.body.find((u: { login: string }) => u.login === 'admin');
    const senha = await ctx
      .http()
      .put(`/api/usuarios/${ana.id}/senha`)
      .set('Cookie', gerente)
      .send({ novaSenha: 'outra-senha-1' });
    expect(senha.status).toBe(403);
    const desativar = await ctx
      .http()
      .patch(`/api/usuarios/${ana.id}/status`)
      .set('Cookie', gerente)
      .send({ ativo: false });
    expect(desativar.status).toBe(403);
  });
});
