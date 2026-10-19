import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarCardapio,
  criarContexto,
  criarUsuario,
  entrar,
  limparBanco,
  liberarFuncionario,
  pedidoExemplo,
  type Contexto,
} from './ajuda.js';

let ctx: Contexto;
let func: string;
let chef: string;
let gerente: string;
let admin: string;
let c: Awaited<ReturnType<typeof criarCardapio>>;

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  await criarUsuario(ctx.banco, 'maria', 'FUNCIONARIO');
  await criarUsuario(ctx.banco, 'rui', 'CHEF');
  await criarUsuario(ctx.banco, 'gil', 'GERENTE');
  await criarUsuario(ctx.banco, 'ana', 'ADMIN');
  await liberarFuncionario(ctx.banco);
  [func, chef, gerente, admin] = await Promise.all([
    entrar(ctx, 'maria'),
    entrar(ctx, 'rui'),
    entrar(ctx, 'gil'),
    entrar(ctx, 'ana'),
  ]);
  c = await criarCardapio(ctx.banco);
});

const pedirParaDepois = (extra: Record<string, unknown> = {}) =>
  ctx
    .http()
    .post('/api/pedidos')
    .set('Cookie', func)
    .send({ ...pedidoExemplo(c), formaPagamento: undefined, pagarDepois: true, ...extra });
const receber = (id: number, corpo: Record<string, unknown>, cookie = func) =>
  ctx.http().patch(`/api/pedidos/${id}/pagamento`).set('Cookie', cookie).send(corpo);
const aReceber = (cookie = func) => ctx.http().get('/api/pedidos/a-receber').set('Cookie', cookie);

describe('Pagar depois', () => {
  it('o pedido fica ABERTO, sem pagamento, e já vai para a fila marcado como a pagar', async () => {
    const r = await pedirParaDepois();
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      status: 'ABERTO',
      formaPagamento: null,
      finalizadoEm: null,
      total: '33.00',
      preparo: { status: 'AGUARDANDO' },
    });
    const fila = await ctx.http().get('/api/fila').set('Cookie', chef);
    expect(fila.body.dados).toEqual([expect.objectContaining({ id: r.body.id, aPagar: true })]);
    const lista = await aReceber();
    expect(lista.body.dados).toEqual([
      expect.objectContaining({ id: r.body.id, cliente: 'Joana', total: '33.00', aPagar: true }),
    ]);
  });

  it('não entra no faturamento até receber', async () => {
    await pedirParaDepois();
    const resumo = await ctx.http().get('/api/relatorios/vendas').set('Cookie', gerente);
    expect(resumo.body.pedidosFinalizados).toBe(0);
    expect(resumo.body.faturamento).toBe('0.00');
  });

  it('receber em dinheiro calcula o troco, finaliza e tira da lista A receber', async () => {
    const { body: pedido } = await pedirParaDepois();
    const r = await receber(pedido.id, { formaPagamento: 'DINHEIRO', valorRecebido: '50,00' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      status: 'FINALIZADO',
      formaPagamento: { codigo: 'DINHEIRO' },
      valorRecebido: '50.00',
      troco: '17.00',
    });
    expect(r.body.finalizadoEm).not.toBeNull();
    expect((await aReceber()).body.dados).toEqual([]);
    const resumo = await ctx.http().get('/api/relatorios/vendas').set('Cookie', gerente);
    expect(resumo.body.faturamento).toBe('33.00');
    // A fila continua com o pedido, agora pago.
    const fila = await ctx.http().get('/api/fila').set('Cookie', chef);
    expect(fila.body.dados[0]).toMatchObject({ id: pedido.id, aPagar: false });
  });

  it('não recebe duas vezes, nem pedido cancelado, nem com valor menor que o total', async () => {
    const { body: pedido } = await pedirParaDepois();
    const pouco = await receber(pedido.id, { formaPagamento: 'DINHEIRO', valorRecebido: '20' });
    expect(pouco.body.erro.codigo).toBe('VALOR_RECEBIDO_INSUFICIENTE');
    expect((await receber(pedido.id, { formaPagamento: 'PIX' })).status).toBe(200);
    const deNovo = await receber(pedido.id, { formaPagamento: 'PIX' });
    expect(deNovo.status).toBe(409);
    expect(deNovo.body.erro.codigo).toBe('PEDIDO_JA_PAGO');

    const { body: outro } = await pedirParaDepois();
    const cancelar = await ctx
      .http()
      .patch(`/api/pedidos/${outro.id}/cancelar`)
      .set('Cookie', admin)
      .send({ motivo: 'Cliente desistiu' });
    expect(cancelar.status).toBe(200);
    const cancelado = await receber(outro.id, { formaPagamento: 'PIX' });
    expect(cancelado.status).toBe(409);
    expect(cancelado.body.erro.codigo).toBe('PEDIDO_CANCELADO');
    expect((await aReceber()).body.dados).toEqual([]);
  });

  it('pedido sem forma de pagamento e sem pagar depois é recusado; pagar depois não leva forma', async () => {
    const sem = await ctx
      .http()
      .post('/api/pedidos')
      .set('Cookie', func)
      .send({ ...pedidoExemplo(c), formaPagamento: undefined });
    expect(sem.body.erro.codigo).toBe('FORMA_PAGAMENTO_INVALIDA');
    const comForma = await pedirParaDepois({ formaPagamento: 'PIX' });
    expect(comForma.body.erro.codigo).toBe('PAGAR_DEPOIS_SEM_PAGAMENTO');
  });

  it('só quem registra pedidos vê A receber e recebe', async () => {
    const { body: pedido } = await pedirParaDepois();
    expect((await aReceber(chef)).status).toBe(403);
    expect((await receber(pedido.id, { formaPagamento: 'PIX' }, chef)).status).toBe(403);
  });
});
