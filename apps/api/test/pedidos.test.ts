import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

const registrar = (corpo: object, cookie = func) =>
  ctx.http().post('/api/pedidos').set('Cookie', cookie).send(corpo);

describe('CA-05 a CA-07 Registro de pedido', () => {
  it('registra o pedido do exemplo em dinheiro: R$ 33,00 e troco de R$ 17,00', async () => {
    const r = await registrar(
      pedidoExemplo(c, { formaPagamento: 'DINHEIRO', valorRecebido: '50.00' }),
    );
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      status: 'FINALIZADO',
      usuario: { nome: 'Maria' },
      formaPagamento: { codigo: 'DINHEIRO', nome: 'Dinheiro' },
      total: '33.00',
      valorRecebido: '50.00',
      troco: '17.00',
    });
    expect(r.body.itens).toEqual([
      {
        produtoId: c.carne,
        nomeProduto: 'Pastel de Carne',
        quantidade: 2,
        precoUnitario: '8.00',
        subtotal: '16.00',
      },
      {
        produtoId: c.queijo,
        nomeProduto: 'Pastel de Queijo',
        quantidade: 1,
        precoUnitario: '7.00',
        subtotal: '7.00',
      },
      {
        produtoId: c.coca,
        nomeProduto: 'Coca-Cola',
        quantidade: 2,
        precoUnitario: '5.00',
        subtotal: '10.00',
      },
    ]);
    expect(r.body.criadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
  });

  it('PIX sem valor recebido; dinheiro sem valor recebido grava sem troco', async () => {
    const pix = await registrar(pedidoExemplo(c));
    expect(pix.body).toMatchObject({ total: '33.00', valorRecebido: null, troco: null });
    const din = await registrar(pedidoExemplo(c, { formaPagamento: 'DINHEIRO' }));
    expect(din.status).toBe(201);
    expect(din.body.troco).toBeNull();
  });

  it('erros de pagamento', async () => {
    const pouco = await registrar(
      pedidoExemplo(c, { formaPagamento: 'DINHEIRO', valorRecebido: '30.00' }),
    );
    expect(pouco.status).toBe(422);
    expect(pouco.body.erro.codigo).toBe('VALOR_RECEBIDO_INSUFICIENTE');

    const naoDinheiro = await registrar(pedidoExemplo(c, { valorRecebido: '50.00' }));
    expect(naoDinheiro.status).toBe(422);
    expect(naoDinheiro.body.erro.codigo).toBe('VALOR_RECEBIDO_SO_EM_DINHEIRO');

    const forma = await registrar(pedidoExemplo(c, { formaPagamento: 'CHEQUE' }));
    expect(forma.status).toBe(422);
    expect(forma.body.erro.codigo).toBe('FORMA_PAGAMENTO_INVALIDA');

    await ctx.banco.formaPagamento.update({ where: { id: 2 }, data: { ativo: false } });
    const inativa = await registrar(pedidoExemplo(c));
    expect(inativa.body.erro.codigo).toBe('FORMA_PAGAMENTO_INVALIDA');
    expect(await ctx.banco.pedido.count()).toBe(0);
  });

  it('pedido sem itens dá 422 PEDIDO_SEM_ITENS', async () => {
    const r = await registrar({ ...pedidoExemplo(c), itens: [] });
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('PEDIDO_SEM_ITENS');
  });

  it('quantidade 0, negativa, decimal ou acima de 99 é recusada', async () => {
    for (const quantidade of [0, -1, 1.5, 100]) {
      const r = await registrar({
        ...pedidoExemplo(c),
        itens: [{ produtoId: c.carne, quantidade, precoExibido: '8.00' }],
      });
      expect(r.status).toBe(422);
      expect(r.body.erro.codigo).toBe('QUANTIDADE_INVALIDA');
    }
  });

  it('produto inexistente dá 404', async () => {
    const r = await registrar({
      ...pedidoExemplo(c),
      itens: [{ produtoId: 9999, quantidade: 1, precoExibido: '1.00' }],
    });
    expect(r.status).toBe(404);
    expect(r.body.erro.codigo).toBe('PRODUTO_NAO_ENCONTRADO');
  });

  it('preço adulterado nunca é gravado', async () => {
    const r = await registrar({
      ...pedidoExemplo(c),
      itens: [{ produtoId: c.carne, quantidade: 2, precoExibido: '1.00' }],
    });
    expect(r.status).toBe(409);
    expect(r.body.erro.codigo).toBe('PRECO_ALTERADO');
    expect(await ctx.banco.pedido.count()).toBe(0);
  });

  it('total enviado pela tela é ignorado (campo desconhecido é recusado)', async () => {
    const r = await registrar({ ...pedidoExemplo(c), total: '1.00' });
    expect(r.status).toBe(422);
    expect(await ctx.banco.pedido.count()).toBe(0);
  });

  it('produto repetido vira um item só', async () => {
    const r = await registrar({
      ...pedidoExemplo(c),
      itens: [
        { produtoId: c.carne, quantidade: 1, precoExibido: '8.00' },
        { produtoId: c.carne, quantidade: 2, precoExibido: '8.00' },
      ],
    });
    expect(r.body.itens).toHaveLength(1);
    expect(r.body.itens[0]).toMatchObject({ quantidade: 3, subtotal: '24.00' });
  });

  it('mesma chave de idempotência gera um pedido só (clique duplo)', async () => {
    const corpo = pedidoExemplo(c);
    const [a, b] = await Promise.all([registrar(corpo), registrar(corpo)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    const terceira = await registrar(corpo);
    expect(terceira.status).toBe(200);
    expect(terceira.body.id).toBe(a.body.id);
    expect(await ctx.banco.pedido.count()).toBe(1);
  });

  it('falha no meio da gravação não deixa pedido sem itens (transação)', async () => {
    const original = ctx.banco.$transaction.bind(ctx.banco);
    const espiao = vi.spyOn(ctx.banco, '$transaction').mockImplementationOnce((async (
      fn: (tx: unknown) => Promise<unknown>,
    ) =>
      original(async (tx) => {
        await fn(tx);
        throw new Error('falha simulada depois de gravar');
      })) as never);
    const r = await registrar(pedidoExemplo(c));
    expect(r.status).toBe(500);
    expect(r.body.erro.mensagem).toMatch(/Algo deu errado/);
    espiao.mockRestore();
    expect(await ctx.banco.pedido.count()).toBe(0);
    expect(await ctx.banco.itemPedido.count()).toBe(0);
  });

  it('total gravado é sempre a soma dos subtotais', async () => {
    await registrar(pedidoExemplo(c));
    await registrar({
      ...pedidoExemplo(c),
      itens: [{ produtoId: c.coca, quantidade: 7, precoExibido: '5.00' }],
    });
    const divergentes = await ctx.banco.$queryRaw<{ id: bigint }[]>`
      SELECT p.id FROM pedidos p JOIN itens_pedido i ON i.pedido_id = p.id
      GROUP BY p.id, p.total HAVING p.total <> sum(i.subtotal)`;
    expect(divergentes).toEqual([]);
  });
});

describe('CA-08 Histórico e detalhe', () => {
  it('lista os pedidos de hoje do mais recente ao mais antigo, com soma dos finalizados', async () => {
    const p1 = await registrar(pedidoExemplo(c));
    const p2 = await registrar(pedidoExemplo(c, { formaPagamento: 'DEBITO' }));
    await ctx
      .http()
      .patch(`/api/pedidos/${p1.body.id}/cancelar`)
      .set('Cookie', admin)
      .send({ motivo: 'Lançado errado' });

    const r = await ctx.http().get('/api/pedidos').set('Cookie', func);
    expect(r.status).toBe(200);
    expect(r.body.dados.map((p: { id: number }) => p.id)).toEqual([p2.body.id, p1.body.id]);
    expect(r.body).toMatchObject({ pagina: 1, tamanho: 50, total: 2, somaFinalizados: '33.00' });
    expect(r.body.dados[0]).toMatchObject({
      total: '33.00',
      formaPagamento: 'DEBITO',
      status: 'FINALIZADO',
      usuario: { nome: 'Maria' },
    });
  });

  it('filtra por pagamento, status, usuário, número e período', async () => {
    await registrar(pedidoExemplo(c));
    const debito = await registrar(pedidoExemplo(c, { formaPagamento: 'DEBITO' }), admin);

    const pix = await ctx.http().get('/api/pedidos?formaPagamento=PIX').set('Cookie', func);
    expect(pix.body.total).toBe(1);
    const porUsuario = await ctx
      .http()
      .get(`/api/pedidos?usuarioId=${debito.body.usuario.id}`)
      .set('Cookie', func);
    expect(porUsuario.body.dados[0].id).toBe(debito.body.id);
    const cancelados = await ctx.http().get('/api/pedidos?status=CANCELADO').set('Cookie', func);
    expect(cancelados.body.total).toBe(0);
    const numero = await ctx
      .http()
      .get(`/api/pedidos?numero=${debito.body.id}&de=2020-01-01&ate=2020-01-01`)
      .set('Cookie', func);
    expect(numero.body.total).toBe(1);
    const ontem = await ctx
      .http()
      .get('/api/pedidos?de=2020-01-01&ate=2020-01-02')
      .set('Cookie', func);
    expect(ontem.body.total).toBe(0);
  });

  it('data final antes da inicial dá FILTRO_INVALIDO', async () => {
    const r = await ctx.http().get('/api/pedidos?de=2026-10-08&ate=2026-10-01').set('Cookie', func);
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('FILTRO_INVALIDO');
    const invalida = await ctx.http().get('/api/pedidos?de=2026-02-31').set('Cookie', func);
    expect(invalida.status).toBe(422);
  });

  it('pagina de 1 em 1', async () => {
    await registrar(pedidoExemplo(c));
    await registrar(pedidoExemplo(c));
    const r = await ctx.http().get('/api/pedidos?pagina=2&tamanho=1').set('Cookie', func);
    expect(r.body).toMatchObject({ pagina: 2, tamanho: 1, total: 2 });
    expect(r.body.dados).toHaveLength(1);
    const grande = await ctx.http().get('/api/pedidos?tamanho=101').set('Cookie', func);
    expect(grande.status).toBe(422);
  });

  it('detalhe com itens como gravados; número inexistente dá 404', async () => {
    const p = await registrar(pedidoExemplo(c));
    const r = await ctx.http().get(`/api/pedidos/${p.body.id}`).set('Cookie', func);
    expect(r.body.itens).toHaveLength(3);
    expect(r.body.cancelamento).toBeUndefined();
    const nao = await ctx.http().get('/api/pedidos/99999').set('Cookie', func);
    expect(nao.status).toBe(404);
    expect(nao.body.erro).toMatchObject({
      codigo: 'PEDIDO_NAO_ENCONTRADO',
      mensagem: 'Pedido não encontrado',
    });
  });
});

describe('CA-09 Cancelamento', () => {
  it('admin cancela com motivo; detalhe mostra quem, quando e por quê; itens não mudam', async () => {
    const p = await registrar(pedidoExemplo(c));
    const r = await ctx
      .http()
      .patch(`/api/pedidos/${p.body.id}/cancelar`)
      .set('Cookie', admin)
      .send({ motivo: 'Cliente desistiu' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('CANCELADO');
    expect(r.body.cancelamento).toMatchObject({ por: { nome: 'Ana' }, motivo: 'Cliente desistiu' });
    expect(r.body.total).toBe('33.00');
    expect(r.body.itens).toEqual(p.body.itens);
  });

  it('sem motivo ou com motivo curto/longo dá MOTIVO_OBRIGATORIO e nada muda', async () => {
    const p = await registrar(pedidoExemplo(c));
    for (const corpo of [{}, { motivo: '' }, { motivo: 'abc' }, { motivo: 'x'.repeat(201) }]) {
      const r = await ctx
        .http()
        .patch(`/api/pedidos/${p.body.id}/cancelar`)
        .set('Cookie', admin)
        .send(corpo);
      expect(r.status).toBe(422);
      expect(r.body.erro.codigo).toBe('MOTIVO_OBRIGATORIO');
    }
    const atual = await ctx.http().get(`/api/pedidos/${p.body.id}`).set('Cookie', admin);
    expect(atual.body.status).toBe('FINALIZADO');
  });

  it('funcionário recebe 403', async () => {
    const p = await registrar(pedidoExemplo(c));
    const r = await ctx
      .http()
      .patch(`/api/pedidos/${p.body.id}/cancelar`)
      .set('Cookie', func)
      .send({ motivo: 'Cliente desistiu' });
    expect(r.status).toBe(403);
  });

  it('pedido já cancelado dá 409; inexistente dá 404', async () => {
    const p = await registrar(pedidoExemplo(c));
    const cancelar = () =>
      ctx
        .http()
        .patch(`/api/pedidos/${p.body.id}/cancelar`)
        .set('Cookie', admin)
        .send({ motivo: 'Pedido duplicado' });
    expect((await cancelar()).status).toBe(200);
    const de_novo = await cancelar();
    expect(de_novo.status).toBe(409);
    expect(de_novo.body.erro.codigo).toBe('PEDIDO_JA_CANCELADO');
    const inexistente = await ctx
      .http()
      .patch('/api/pedidos/99999/cancelar')
      .set('Cookie', admin)
      .send({ motivo: 'Pedido duplicado' });
    expect(inexistente.status).toBe(404);
  });

  it('não existe edição nem exclusão de pedido', async () => {
    const p = await registrar(pedidoExemplo(c));
    expect(
      (await ctx.http().put(`/api/pedidos/${p.body.id}`).set('Cookie', admin).send({})).status,
    ).toBe(404);
    expect(
      (await ctx.http().delete(`/api/pedidos/${p.body.id}`).set('Cookie', admin).send({})).status,
    ).toBe(404);
  });

  it('chave de idempotência inválida é recusada', async () => {
    const r = await registrar({ ...pedidoExemplo(c), chaveIdempotencia: 'nao-e-uuid' });
    expect(r.status).toBe(422);
    expect(randomUUID()).toMatch(/-/);
  });
});
