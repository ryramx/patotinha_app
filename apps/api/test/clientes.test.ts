import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chaveCliente } from '@patotinha/shared';
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
  await criarUsuario(ctx.banco, 'maria', 'FUNCIONARIO', 'Maria');
  func = await entrar(ctx, 'maria');
  c = await criarCardapio(ctx.banco);
});

const registrar = (extra: Record<string, unknown> = {}) =>
  ctx
    .http()
    .post('/api/pedidos')
    .set('Cookie', func)
    .send({ ...pedidoExemplo(c), ...extra });
const sugestoes = (busca: string) =>
  ctx.http().get('/api/clientes').query({ busca }).set('Cookie', func);

describe('Clientes: cadastro leve pelo pedido', () => {
  it('o primeiro pedido cadastra o cliente e os seguintes reaproveitam o mesmo', async () => {
    const a = await registrar({ cliente: 'Seu João' });
    const b = await registrar({ cliente: '  seu   joao ' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const clientes = await ctx.banco.cliente.findMany();
    expect(clientes).toHaveLength(1);
    // A grafia mais recente vale para o cadastro; cada pedido guarda a sua.
    expect(clientes[0]!.nome).toBe('seu joao');
    expect(b.body.cliente).toBe('seu joao');
    const pedidos = await ctx.banco.pedido.findMany();
    expect(pedidos.every((p) => p.clienteId === clientes[0]!.id)).toBe(true);
  });

  it('guarda o telefone só com números e não apaga quando o próximo pedido vem sem', async () => {
    expect((await registrar({ cliente: 'Joana', telefone: '(11) 98765-4321' })).status).toBe(201);
    expect((await registrar({ cliente: 'Joana' })).status).toBe(201);
    expect((await registrar({ cliente: 'Joana', telefone: '' })).status).toBe(201);
    const joana = await ctx.banco.cliente.findFirstOrThrow();
    expect(joana.telefone).toBe('11987654321');
    expect((await registrar({ cliente: 'Joana', telefone: '1133334444' })).status).toBe(201);
    expect((await ctx.banco.cliente.findFirstOrThrow()).telefone).toBe('1133334444');
  });

  it('recusa telefone sem DDD ou com números demais, sem gravar nada', async () => {
    for (const telefone of ['98765-4321', '119876543210', 'abc']) {
      expect((await registrar({ cliente: 'Joana', telefone })).status).toBe(422);
    }
    expect(await ctx.banco.pedido.count()).toBe(0);
    expect(await ctx.banco.cliente.count()).toBe(0);
  });

  it('dois pedidos ao mesmo tempo com um nome novo criam um cliente só', async () => {
    const r = await Promise.all([1, 2, 3].map(() => registrar({ cliente: 'Pedro' })));
    expect(r.map((x) => x.status)).toEqual([201, 201, 201]);
    expect(await ctx.banco.cliente.count()).toBe(1);
  });
});

describe('Clientes: sugestões no campo do nome', () => {
  it('acha por qualquer parte do nome, sem acentos, com o mais recente primeiro', async () => {
    await registrar({ cliente: 'José da Silva', telefone: '11987654321' });
    await registrar({ cliente: 'Josefa' });
    await registrar({ cliente: 'Ana' });
    await registrar({ cliente: 'Josefa' });

    const r = await sugestoes('jos');
    expect(r.status).toBe(200);
    expect(r.body.dados.map((x: { nome: string }) => x.nome)).toEqual(['Josefa', 'José da Silva']);
    expect(r.body.dados[0]).toMatchObject({ pedidos: 2, telefone: null });
    expect(r.body.dados[1]).toMatchObject({ pedidos: 1, telefone: '11987654321' });

    const silva = await sugestoes('silva JOSE');
    expect(silva.body.dados.map((x: { nome: string }) => x.nome)).toEqual(['José da Silva']);
    expect((await sugestoes('%')).body.dados).toEqual([]);
  });

  it('mostra no máximo seis sugestões', async () => {
    for (let i = 1; i <= 8; i++) await registrar({ cliente: `Cliente ${i}` });
    expect((await sugestoes('cliente')).body.dados).toHaveLength(6);
  });

  it('pede login, permissão de registrar pedidos e uma busca', async () => {
    expect((await ctx.http().get('/api/clientes?busca=a')).status).toBe(401);
    await criarUsuario(ctx.banco, 'chef', 'CHEF');
    const chef = await entrar(ctx, 'chef');
    const r = await ctx.http().get('/api/clientes?busca=a').set('Cookie', chef);
    expect(r.status).toBe(403);
    expect((await sugestoes('')).status).toBe(422);
  });
});

describe('Clientes: migração', () => {
  it('a chave do banco é a mesma calculada no app', async () => {
    const nomes = ['  José  da Silva ', 'ÂNGELA', 'Conceição', 'Müller Ñandú', 'Ýara'];
    for (const nome of nomes) {
      const [linha] = await ctx.banco.$queryRaw<{ chave: string }[]>`
        SELECT chave_cliente(${nome}) AS chave`;
      expect(linha!.chave).toBe(chaveCliente(nome));
    }
  });

  it('cria um cliente para cada nome dos pedidos antigos e liga os pedidos a ele', async () => {
    // Pedidos de antes da migração: só com o nome, sem cliente.
    for (const cliente of ['Joana', 'joana ', 'Pedro', 'Pedro']) await registrar({ cliente });
    const antigo = await registrar({ cliente: 'Ana' });
    await ctx.banco.$executeRawUnsafe(
      `UPDATE pedidos SET cliente_nome = NULL WHERE id = ${antigo.body.id}`,
    );
    await ctx.banco.$executeRawUnsafe('UPDATE pedidos SET cliente_id = NULL');
    await ctx.banco.$executeRawUnsafe('DELETE FROM clientes');
    const antes = await ctx.banco.pedido.findMany({ orderBy: { id: 'asc' } });

    // Roda de novo só a parte da migração que aproveita os nomes.
    const sql = readFileSync(
      path.resolve(
        import.meta.dirname,
        '../prisma/migrations/20261017010000_clientes/migration.sql',
      ),
      'utf8',
    );
    await ctx.banco.$executeRawUnsafe(
      sql.slice(sql.indexOf('INSERT INTO clientes')).split(';')[0]!,
    );
    for (const comando of sql.slice(sql.indexOf('ALTER TABLE pedidos DISABLE')).split(';')) {
      if (comando.trim()) await ctx.banco.$executeRawUnsafe(comando);
    }

    const clientes = await ctx.banco.cliente.findMany({
      include: { _count: { select: { pedidos: true } } },
      orderBy: { chave: 'asc' },
    });
    expect(clientes.map((x) => [x.nome, x._count.pedidos])).toEqual([
      ['joana', 2],
      ['Pedro', 2],
    ]);
    const depois = await ctx.banco.pedido.findMany({ orderBy: { id: 'asc' } });
    expect(depois.at(-1)!.clienteId).toBeNull();
    // Ligar o cliente não conta como alteração do pedido.
    expect(depois.map((p) => p.atualizadoEm)).toEqual(antes.map((p) => p.atualizadoEm));
  });
});
