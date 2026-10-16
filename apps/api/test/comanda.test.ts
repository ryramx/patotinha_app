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
let func: string;
let c: Awaited<ReturnType<typeof criarCardapio>>;

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  await criarUsuario(ctx.banco, 'admin', 'ADMIN', 'Ana');
  await criarUsuario(ctx.banco, 'maria', 'FUNCIONARIO', 'Maria');
  admin = await entrar(ctx, 'admin');
  func = await entrar(ctx, 'maria');
  c = await criarCardapio(ctx.banco);
});

const registrar = (extra: Parameters<typeof pedidoExemplo>[1] = {}) =>
  ctx.http().post('/api/pedidos').set('Cookie', func).send(pedidoExemplo(c, extra));
const fila = () => ctx.http().get('/api/fila').set('Cookie', func);
const preparo = (id: number, status: string, cookie = func) =>
  ctx.http().patch(`/api/pedidos/${id}/preparo`).set('Cookie', cookie).send({ status });

describe('Comanda: nome do cliente', () => {
  it('grava o nome do cliente, sem espaços sobrando, e mostra no detalhe e no histórico', async () => {
    const r = await registrar({ cliente: '  Seu   João  ' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      cliente: 'Seu João',
      preparo: { status: 'AGUARDANDO' },
    });
    const detalhe = await ctx.http().get(`/api/pedidos/${r.body.id}`).set('Cookie', func);
    expect(detalhe.body.cliente).toBe('Seu João');
    const lista = await ctx.http().get('/api/pedidos').set('Cookie', func);
    expect(lista.body.dados[0]).toMatchObject({
      cliente: 'Seu João',
      preparo: { status: 'AGUARDANDO' },
    });
  });

  it('recusa pedido sem nome do cliente ou com nome longo demais', async () => {
    for (const cliente of [undefined, '', '   ', 'x'.repeat(41)]) {
      const corpo: Record<string, unknown> = pedidoExemplo(c);
      if (cliente === undefined) delete corpo.cliente;
      else corpo.cliente = cliente;
      const r = await ctx.http().post('/api/pedidos').set('Cookie', func).send(corpo);
      expect(r.status).toBe(422);
    }
    expect(await ctx.banco.pedido.count()).toBe(0);
  });

  it('histórico busca pelo nome do cliente, sem diferenciar maiúsculas', async () => {
    await registrar({ cliente: 'Joana' });
    const pedro = await registrar({ cliente: 'Pedro Henrique' });
    const r = await ctx.http().get('/api/pedidos?cliente=pedro').set('Cookie', func);
    expect(r.body.total).toBe(1);
    expect(r.body.dados[0].id).toBe(pedro.body.id);
  });
});

describe('Comanda: fila de preparo', () => {
  it('mostra os pedidos do dia por ordem de chegada, com nome e itens', async () => {
    const a = await registrar({ cliente: 'Ana' });
    const b = await registrar({ cliente: 'Bruno' });
    const r = await fila();
    expect(r.status).toBe(200);
    expect(r.body.dados.map((p: { id: number }) => p.id)).toEqual([a.body.id, b.body.id]);
    expect(r.body.dados[0]).toMatchObject({
      cliente: 'Ana',
      preparo: { status: 'AGUARDANDO' },
      itens: [
        { nomeProduto: 'Pastel de Carne', quantidade: 2 },
        { nomeProduto: 'Pastel de Queijo', quantidade: 1 },
        { nomeProduto: 'Coca-Cola', quantidade: 2 },
      ],
    });
    expect(r.body.dados[0]).not.toHaveProperty('total');
  });

  it('funcionário avança o preparo; entregue sai da fila e fica nos recentes', async () => {
    const a = await registrar();
    expect((await preparo(a.body.id, 'PREPARANDO')).body.preparo.status).toBe('PREPARANDO');
    expect((await preparo(a.body.id, 'PRONTO')).body.preparo.status).toBe('PRONTO');
    const entregue = await preparo(a.body.id, 'ENTREGUE');
    expect(entregue.status).toBe(200);
    expect(entregue.body).toMatchObject({ status: 'FINALIZADO', total: '33.00' });

    const r = await fila();
    expect(r.body.dados).toEqual([]);
    expect(r.body.entreguesRecentes.map((p: { id: number }) => p.id)).toEqual([a.body.id]);

    // Toque errado: volta para Pronto e reaparece na fila.
    await preparo(a.body.id, 'PRONTO');
    expect((await fila()).body.dados[0].preparo.status).toBe('PRONTO');
  });

  it('pedido cancelado sai da fila e não muda de preparo', async () => {
    const a = await registrar();
    await ctx
      .http()
      .patch(`/api/pedidos/${a.body.id}/cancelar`)
      .set('Cookie', admin)
      .send({ motivo: 'Cliente desistiu' });
    expect((await fila()).body.dados).toEqual([]);
    const r = await preparo(a.body.id, 'PRONTO');
    expect(r.status).toBe(409);
    expect(r.body.erro.codigo).toBe('PEDIDO_CANCELADO');
  });

  it('pedidos de outros dias não aparecem na fila', async () => {
    const a = await registrar();
    await ctx.banco.pedido.update({
      where: { id: BigInt(a.body.id) },
      data: { criadoEm: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
    });
    expect((await fila()).body.dados).toEqual([]);
  });

  it('status inválido, pedido inexistente e sem login', async () => {
    const a = await registrar();
    const invalido = await preparo(a.body.id, 'QUEIMADO');
    expect(invalido.status).toBe(422);
    expect(invalido.body.erro.codigo).toBe('STATUS_PREPARO_INVALIDO');
    expect((await preparo(99999, 'PRONTO')).status).toBe(404);
    expect((await ctx.http().get('/api/fila')).status).toBe(401);
  });

  it('o banco recusa status de preparo desconhecido', async () => {
    const a = await registrar();
    await expect(
      ctx.banco.$executeRawUnsafe(
        `UPDATE pedidos SET status_preparo = 'QUEIMADO' WHERE id = ${a.body.id}`,
      ),
    ).rejects.toThrow();
  });
});
