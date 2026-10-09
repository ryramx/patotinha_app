import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { diaEmSaoPaulo } from '@patotinha/shared';
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
  admin = await entrar(ctx, 'admin');
  c = await criarCardapio(ctx.banco);
});

const registrar = (corpo: object) =>
  ctx.http().post('/api/pedidos').set('Cookie', admin).send(corpo);

describe('CA-10 Resumo de vendas', () => {
  it('soma por forma de pagamento, cartão e cancelados à parte', async () => {
    // R$ 33,00 dinheiro; R$ 20,00 PIX; R$ 15,00 débito; 1 cancelado
    await registrar(pedidoExemplo(c, { formaPagamento: 'DINHEIRO' }));
    await registrar({
      ...pedidoExemplo(c),
      itens: [{ produtoId: c.coca, quantidade: 4, precoExibido: '5.00' }],
    });
    await registrar({
      ...pedidoExemplo(c, { formaPagamento: 'DEBITO' }),
      itens: [
        { produtoId: c.carne, quantidade: 1, precoExibido: '8.00' },
        { produtoId: c.queijo, quantidade: 1, precoExibido: '7.00' },
      ],
    });
    const cancelado = await registrar(pedidoExemplo(c));
    await ctx
      .http()
      .patch(`/api/pedidos/${cancelado.body.id}/cancelar`)
      .set('Cookie', admin)
      .send({ motivo: 'Lançado errado' });

    const r = await ctx.http().get('/api/relatorios/vendas').set('Cookie', admin);
    expect(r.status).toBe(200);
    const hoje = diaEmSaoPaulo();
    expect(r.body).toMatchObject({
      periodo: { de: hoje, ate: hoje },
      pedidosFinalizados: 3,
      pedidosCancelados: 1,
      valorCancelados: '33.00',
      faturamento: '68.00',
      cartaoTotal: '15.00',
    });
    const porForma = Object.fromEntries(
      r.body.porFormaPagamento.map((f: { codigo: string; total: string }) => [f.codigo, f.total]),
    );
    expect(porForma).toEqual({ DINHEIRO: '33.00', PIX: '20.00', DEBITO: '15.00', CREDITO: '0.00' });

    // Mais vendidos por quantidade, só de pedidos finalizados.
    expect(r.body.produtosMaisVendidos).toEqual([
      { produtoId: c.coca, nome: 'Coca-Cola', quantidade: 6, valor: '30.00' },
      { produtoId: c.carne, nome: 'Pastel de Carne', quantidade: 3, valor: '24.00' },
      { produtoId: c.queijo, nome: 'Pastel de Queijo', quantidade: 2, valor: '14.00' },
    ]);
  });

  it('período sem vendas devolve zeros', async () => {
    const r = await ctx
      .http()
      .get('/api/relatorios/vendas?de=2020-01-01&ate=2020-01-31')
      .set('Cookie', admin);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      pedidosFinalizados: 0,
      pedidosCancelados: 0,
      faturamento: '0.00',
      cartaoTotal: '0.00',
      produtosMaisVendidos: [],
    });
  });

  it('pedido às 23h50 em Brasília entra no dia certo', async () => {
    const p = await registrar(pedidoExemplo(c));
    // 08/10/2026 23:50 em Brasília = 09/10/2026 02:50 UTC
    await ctx.banco.pedido.update({
      where: { id: BigInt(p.body.id) },
      data: { criadoEm: new Date('2026-10-09T02:50:00Z') },
    });
    const dia8 = await ctx
      .http()
      .get('/api/relatorios/vendas?de=2026-10-08&ate=2026-10-08')
      .set('Cookie', admin);
    expect(dia8.body.pedidosFinalizados).toBe(1);
    const dia9 = await ctx
      .http()
      .get('/api/relatorios/vendas?de=2026-10-09&ate=2026-10-09')
      .set('Cookie', admin);
    expect(dia9.body.pedidosFinalizados).toBe(0);
  });

  it('data final antes da inicial dá PERIODO_INVALIDO', async () => {
    const r = await ctx
      .http()
      .get('/api/relatorios/vendas?de=2026-10-08&ate=2026-10-01')
      .set('Cookie', admin);
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('PERIODO_INVALIDO');
  });

  it('um mês com volume realista responde em até 2 s (RNF-03)', async () => {
    // ~300 pedidos por dia durante 30 dias, inseridos direto no banco.
    await ctx.banco.$executeRawUnsafe(`
      WITH novos AS (
        INSERT INTO pedidos (status, usuario_id, forma_pagamento_id, total, criado_em, finalizado_em)
        SELECT 'FINALIZADO', 1, 1 + (g % 4), 16.00,
               timestamptz '2026-09-01 12:00-03' + (g % 30) * interval '1 day' + (g % 600) * interval '1 minute',
               now()
          FROM generate_series(1, 9000) g
        RETURNING id
      )
      INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
      SELECT id, ${c.carne}, 'Pastel de Carne', 2, 8.00, 16.00 FROM novos`);
    const inicio = performance.now();
    const rel = await ctx
      .http()
      .get('/api/relatorios/vendas?de=2026-09-01&ate=2026-09-30')
      .set('Cookie', admin);
    const hist = await ctx
      .http()
      .get('/api/pedidos?de=2026-09-01&ate=2026-09-30')
      .set('Cookie', admin);
    const ms = performance.now() - inicio;
    expect(rel.body.pedidosFinalizados).toBe(9000);
    expect(rel.body.faturamento).toBe('144000.00');
    expect(hist.body.total).toBe(9000);
    expect(ms).toBeLessThan(2000);
  });
});
