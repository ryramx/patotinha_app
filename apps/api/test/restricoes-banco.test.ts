import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarCardapio, criarContexto, criarUsuario, limparBanco, type Contexto } from './ajuda.js';

/** Tarefa 3.9: o banco recusa sozinho o que viola as regras críticas (RNF-18). */

let ctx: Contexto;
beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
});

const sql = (texto: string) => ctx.banco.$executeRawUnsafe(texto);

describe('Restrições do banco', () => {
  it('existem as seis tabelas e as quatro formas de pagamento', async () => {
    const tabelas = await ctx.banco.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    expect(tabelas.map((t) => t.tablename)).toEqual([
      'categorias',
      'formas_pagamento',
      'itens_pedido',
      'pedidos',
      'produtos',
      'usuarios',
    ]);
    const formas = await ctx.banco.formaPagamento.findMany({ orderBy: { id: 'asc' } });
    expect(formas.map((f) => [f.id, f.codigo])).toEqual([
      [1, 'DINHEIRO'],
      [2, 'PIX'],
      [3, 'DEBITO'],
      [4, 'CREDITO'],
    ]);
  });

  it('recusa preço negativo', async () => {
    await sql(`INSERT INTO categorias (nome) VALUES ('Pastéis')`);
    await expect(
      sql(`INSERT INTO produtos (categoria_id, nome, preco) VALUES (1, 'X', -1)`),
    ).rejects.toThrow();
  });

  it('recusa nome repetido com maiúsculas diferentes', async () => {
    await sql(`INSERT INTO categorias (nome) VALUES ('Bebidas')`);
    await expect(sql(`INSERT INTO categorias (nome) VALUES ('BEBIDAS')`)).rejects.toThrow();
    await criarUsuario(ctx.banco, 'joao');
    await expect(criarUsuario(ctx.banco, 'JOAO')).rejects.toThrow();
  });

  it('recusa quantidade zero e subtotal incoerente', async () => {
    const c = await criarCardapio(ctx.banco);
    await criarUsuario(ctx.banco, 'maria');
    await sql(`INSERT INTO pedidos (status, usuario_id, forma_pagamento_id, total, finalizado_em)
               VALUES ('FINALIZADO', 1, 2, 8.00, now())`);
    await expect(
      sql(`INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
           VALUES (1, ${c.carne}, 'Pastel de Carne', 0, 8.00, 0)`),
    ).rejects.toThrow();
    await expect(
      sql(`INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
           VALUES (1, ${c.carne}, 'Pastel de Carne', 2, 8.00, 1.00)`),
    ).rejects.toThrow();
  });

  it('recusa pedido finalizado sem forma de pagamento e cancelado sem motivo', async () => {
    await criarUsuario(ctx.banco, 'maria');
    await expect(
      sql(
        `INSERT INTO pedidos (status, usuario_id, total, finalizado_em) VALUES ('FINALIZADO', 1, 0, now())`,
      ),
    ).rejects.toThrow();
    await expect(
      sql(`INSERT INTO pedidos (status, usuario_id, forma_pagamento_id, total, finalizado_em, cancelado_em, cancelado_por_id)
           VALUES ('CANCELADO', 1, 1, 0, now(), now(), 1)`),
    ).rejects.toThrow();
  });

  it('recusa troco incoerente com o valor recebido', async () => {
    await criarUsuario(ctx.banco, 'maria');
    await expect(
      sql(`INSERT INTO pedidos (status, usuario_id, forma_pagamento_id, total, valor_recebido, troco, finalizado_em)
           VALUES ('FINALIZADO', 1, 1, 33.00, 50.00, 10.00, now())`),
    ).rejects.toThrow();
  });

  it('não deixa apagar produto já vendido (ON DELETE RESTRICT)', async () => {
    const c = await criarCardapio(ctx.banco);
    await criarUsuario(ctx.banco, 'maria');
    await sql(`INSERT INTO pedidos (status, usuario_id, forma_pagamento_id, total, finalizado_em)
               VALUES ('FINALIZADO', 1, 2, 8.00, now())`);
    await sql(`INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
               VALUES (1, ${c.carne}, 'Pastel de Carne', 1, 8.00, 8.00)`);
    await expect(sql(`DELETE FROM produtos WHERE id = ${c.carne}`)).rejects.toThrow();
  });

  it('atualiza atualizado_em por gatilho', async () => {
    await sql(
      `INSERT INTO categorias (nome, atualizado_em) VALUES ('Doces', now() - interval '1 day')`,
    );
    await sql(`UPDATE categorias SET nome = 'Doces finos'`);
    const [cat] = await ctx.banco.categoria.findMany();
    expect(Date.now() - cat!.atualizadoEm.getTime()).toBeLessThan(60_000);
  });
});
