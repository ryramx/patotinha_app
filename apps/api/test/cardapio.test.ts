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

beforeAll(async () => {
  ctx = await criarContexto();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await limparBanco(ctx.banco);
  await criarUsuario(ctx.banco, 'admin', 'ADMIN');
  await criarUsuario(ctx.banco, 'maria');
  admin = await entrar(ctx, 'admin');
  func = await entrar(ctx, 'maria');
});

describe('CA-02 Categorias', () => {
  it('cria, lista em ordem alfabética e recusa nome repetido com outra caixa', async () => {
    const b = await ctx
      .http()
      .post('/api/categorias')
      .set('Cookie', admin)
      .send({ nome: 'Bebidas' });
    expect(b.status).toBe(201);
    expect(b.body).toMatchObject({ nome: 'Bebidas', ativo: true, produtosAtivos: 0 });
    await ctx.http().post('/api/categorias').set('Cookie', admin).send({ nome: 'Almoço' });

    const dup = await ctx
      .http()
      .post('/api/categorias')
      .set('Cookie', admin)
      .send({ nome: 'bebidas' });
    expect(dup.status).toBe(409);
    expect(dup.body.erro.codigo).toBe('NOME_DUPLICADO');

    const lista = await ctx.http().get('/api/categorias').set('Cookie', func);
    expect(lista.body.map((c: { nome: string }) => c.nome)).toEqual(['Almoço', 'Bebidas']);
  });

  it('nome com 1 ou mais de 40 caracteres é recusado', async () => {
    for (const nome of ['A', 'x'.repeat(41), '   ']) {
      const r = await ctx.http().post('/api/categorias').set('Cookie', admin).send({ nome });
      expect(r.status).toBe(422);
    }
  });

  it('desativar categoria tira ela e seus produtos do pedido e informa quantos', async () => {
    const c = await criarCardapio(ctx.banco);
    const r = await ctx
      .http()
      .patch(`/api/categorias/${c.pasteis.id}/status`)
      .set('Cookie', admin)
      .send({ ativo: false });
    expect(r.status).toBe(200);
    expect(r.body.produtosAfetados).toBe(2);

    const ativas = await ctx.http().get('/api/categorias?ativo=true').set('Cookie', func);
    expect(ativas.body.map((x: { nome: string }) => x.nome)).toEqual(['Bebidas']);
    const produtos = await ctx.http().get('/api/produtos?ativo=true').set('Cookie', func);
    expect(produtos.body.map((x: { nome: string }) => x.nome)).toEqual(['Coca-Cola']);
  });

  it('não cadastra produto em categoria inativa', async () => {
    const c = await criarCardapio(ctx.banco);
    await ctx.banco.categoria.update({ where: { id: c.pasteis.id }, data: { ativo: false } });
    const r = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({ nome: 'Pastel de Palmito', categoriaId: Number(c.pasteis.id), preco: '9.00' });
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('CATEGORIA_INATIVA');
  });

  it('edita o nome e devolve 404 para categoria inexistente', async () => {
    const c = await criarCardapio(ctx.banco);
    const r = await ctx
      .http()
      .put(`/api/categorias/${c.bebidas.id}`)
      .set('Cookie', admin)
      .send({ nome: 'Bebidas geladas' });
    expect(r.body.nome).toBe('Bebidas geladas');
    expect((await ctx.http().get('/api/categorias/999').set('Cookie', func)).status).toBe(404);
  });
});

describe('CA-03 Produtos', () => {
  it('cria produto ativo que aparece no pedido', async () => {
    const cat = await ctx.banco.categoria.create({ data: { nome: 'Pastéis' } });
    const r = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({ nome: 'Pastel de Carne', categoriaId: Number(cat.id), preco: '8,00' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      nome: 'Pastel de Carne',
      preco: '8.00',
      ativo: true,
      categoria: { nome: 'Pastéis' },
    });
    const lista = await ctx.http().get('/api/produtos?ativo=true').set('Cookie', func);
    expect(lista.body).toHaveLength(1);
  });

  it('ingredientes: opcionais, mantidos no PUT sem o campo, apagados com texto vazio', async () => {
    const cat = await ctx.banco.categoria.create({ data: { nome: 'Pastéis' } });
    const r = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({
        nome: 'Pastel de Frango',
        categoriaId: Number(cat.id),
        preco: '8.00',
        ingredientes: '  Frango desfiado, catupiry e milho  ',
      });
    expect(r.status).toBe(201);
    expect(r.body.ingredientes).toBe('Frango desfiado, catupiry e milho');

    const semCampo = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({ nome: 'Refrigerante', categoriaId: Number(cat.id), preco: '6.00' });
    expect(semCampo.body.ingredientes).toBeNull();

    const url = `/api/produtos/${r.body.id}`;
    const base = { nome: 'Pastel de Frango', categoriaId: Number(cat.id), preco: '8.50' };
    const mantido = await ctx.http().put(url).set('Cookie', admin).send(base);
    expect(mantido.body.ingredientes).toBe('Frango desfiado, catupiry e milho');

    const lista = await ctx.http().get('/api/produtos?ativo=true').set('Cookie', func);
    expect(lista.body.find((p: { id: number }) => p.id === r.body.id).ingredientes).toBe(
      'Frango desfiado, catupiry e milho',
    );

    const longo = await ctx
      .http()
      .put(url)
      .set('Cookie', admin)
      .send({ ...base, ingredientes: 'x'.repeat(301) });
    expect(longo.status).toBe(422);

    const apagado = await ctx
      .http()
      .put(url)
      .set('Cookie', admin)
      .send({ ...base, ingredientes: '   ' });
    expect(apagado.body.ingredientes).toBeNull();
  });

  it('preço negativo, vazio ou acima de R$ 9.999,99 é recusado', async () => {
    const cat = await ctx.banco.categoria.create({ data: { nome: 'Pastéis' } });
    for (const preco of ['-1.00', '', '10000.00', 'abc']) {
      const r = await ctx
        .http()
        .post('/api/produtos')
        .set('Cookie', admin)
        .send({ nome: 'Pastel', categoriaId: Number(cat.id), preco });
      expect(r.status).toBe(422);
      expect(r.body.erro.codigo).toBe('PRECO_INVALIDO');
    }
    expect(await ctx.banco.produto.count()).toBe(0);
  });

  it('preço zero é aceito (D-23)', async () => {
    const cat = await ctx.banco.categoria.create({ data: { nome: 'Pastéis' } });
    const r = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({ nome: 'Cortesia', categoriaId: Number(cat.id), preco: '0' });
    expect(r.status).toBe(201);
    expect(r.body.preco).toBe('0.00');
  });

  it('nome duplicado e categoria inexistente', async () => {
    const c = await criarCardapio(ctx.banco);
    const dup = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({ nome: 'pastel de carne', categoriaId: Number(c.pasteis.id), preco: '1.00' });
    expect(dup.status).toBe(409);
    const semCat = await ctx
      .http()
      .post('/api/produtos')
      .set('Cookie', admin)
      .send({ nome: 'Novo', categoriaId: 999, preco: '1.00' });
    expect(semCat.status).toBe(404);
    expect(semCat.body.erro.codigo).toBe('CATEGORIA_NAO_ENCONTRADA');
  });

  it('desativar produto vendido: some do pedido, pedidos antigos continuam e POST dá 409', async () => {
    const c = await criarCardapio(ctx.banco);
    const pedido = await ctx.http().post('/api/pedidos').set('Cookie', func).send(pedidoExemplo(c));
    expect(pedido.status).toBe(201);

    const r = await ctx
      .http()
      .patch(`/api/produtos/${c.carne}/status`)
      .set('Cookie', admin)
      .send({ ativo: false });
    expect(r.body.ativo).toBe(false);

    const ativos = await ctx.http().get('/api/produtos?ativo=true').set('Cookie', func);
    expect(ativos.body.map((p: { nome: string }) => p.nome)).not.toContain('Pastel de Carne');

    const antigo = await ctx.http().get(`/api/pedidos/${pedido.body.id}`).set('Cookie', func);
    expect(antigo.body.itens[0].nomeProduto).toBe('Pastel de Carne');

    const novo = await ctx.http().post('/api/pedidos').set('Cookie', func).send(pedidoExemplo(c));
    expect(novo.status).toBe(409);
    expect(novo.body.erro.codigo).toBe('PRODUTO_INATIVO');
    expect(await ctx.banco.pedido.count()).toBe(1);
  });

  it('não existe exclusão de produto', async () => {
    const c = await criarCardapio(ctx.banco);
    const r = await ctx.http().delete(`/api/produtos/${c.carne}`).set('Cookie', admin).send({});
    expect(r.status).toBe(404);
  });

  it('busca e filtro por categoria', async () => {
    const c = await criarCardapio(ctx.banco);
    const busca = await ctx.http().get('/api/produtos?busca=QUEIJO').set('Cookie', func);
    expect(busca.body.map((p: { nome: string }) => p.nome)).toEqual(['Pastel de Queijo']);
    const cat = await ctx
      .http()
      .get(`/api/produtos?categoriaId=${c.bebidas.id}`)
      .set('Cookie', func);
    expect(cat.body).toHaveLength(1);
  });

  it('não reativa produto de categoria inativa', async () => {
    const c = await criarCardapio(ctx.banco);
    await ctx.banco.produto.update({ where: { id: BigInt(c.coca) }, data: { ativo: false } });
    await ctx.banco.categoria.update({ where: { id: c.bebidas.id }, data: { ativo: false } });
    const r = await ctx
      .http()
      .patch(`/api/produtos/${c.coca}/status`)
      .set('Cookie', admin)
      .send({ ativo: true });
    expect(r.status).toBe(422);
    expect(r.body.erro.codigo).toBe('CATEGORIA_INATIVA');
  });

  it('formas de pagamento ativas', async () => {
    const r = await ctx.http().get('/api/formas-pagamento').set('Cookie', func);
    expect(r.body.map((f: { codigo: string }) => f.codigo)).toEqual([
      'DINHEIRO',
      'PIX',
      'DEBITO',
      'CREDITO',
    ]);
  });
});

describe('CA-04 Alteração de preço', () => {
  it('pedido antigo não muda; pedido novo usa o preço novo; pedido montado com preço velho é recusado', async () => {
    const c = await criarCardapio(ctx.banco);
    const antes = await ctx
      .http()
      .post('/api/pedidos')
      .set('Cookie', func)
      .send({
        ...pedidoExemplo(c),
        itens: [{ produtoId: c.carne, quantidade: 2, precoExibido: '8.00' }],
      });
    expect(antes.body.total).toBe('16.00');

    const edit = await ctx
      .http()
      .put(`/api/produtos/${c.carne}`)
      .set('Cookie', admin)
      .send({ nome: 'Pastel de Carne', categoriaId: Number(c.pasteis.id), preco: '9.00' });
    expect(edit.body.preco).toBe('9.00');

    const velho = await ctx.http().get(`/api/pedidos/${antes.body.id}`).set('Cookie', func);
    expect(velho.body.itens[0].precoUnitario).toBe('8.00');
    expect(velho.body.total).toBe('16.00');

    const recusado = await ctx
      .http()
      .post('/api/pedidos')
      .set('Cookie', func)
      .send({
        ...pedidoExemplo(c),
        itens: [{ produtoId: c.carne, quantidade: 1, precoExibido: '8.00' }],
      });
    expect(recusado.status).toBe(409);
    expect(recusado.body.erro.codigo).toBe('PRECO_ALTERADO');
    expect(recusado.body.erro.detalhes[0]).toMatchObject({
      precoExibido: '8.00',
      precoAtual: '9.00',
    });

    const novo = await ctx
      .http()
      .post('/api/pedidos')
      .set('Cookie', func)
      .send({
        ...pedidoExemplo(c),
        itens: [{ produtoId: c.carne, quantidade: 1, precoExibido: '9.00' }],
      });
    expect(novo.status).toBe(201);
    expect(novo.body.itens[0].precoUnitario).toBe('9.00');
  });
});
