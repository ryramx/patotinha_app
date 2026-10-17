import type { FastifyInstance } from 'fastify';
import type { Categoria } from '@patotinha/shared';
import {
  esquemaCategoria,
  esquemaFiltroCategorias,
  esquemaParamId,
  esquemaStatus,
} from '@patotinha/shared';
import { ErroApp, eUnicoViolado, erros } from '../erros.js';
import { data, id } from '../serializar.js';
import type { Categoria as CategoriaBanco } from '../generated/prisma/client.js';

type CategoriaComContagem = CategoriaBanco & { _count: { produtos: number } };

const contagemAtivos = { _count: { select: { produtos: { where: { ativo: true } } } } } as const;

function paraCategoriaApi(c: CategoriaComContagem): Categoria {
  return {
    id: id(c.id),
    nome: c.nome,
    ativo: c.ativo,
    produtosAtivos: c._count.produtos,
    criadoEm: data(c.criadoEm),
    atualizadoEm: data(c.atualizadoEm),
  };
}

const nomeDuplicado = () =>
  new ErroApp(409, 'NOME_DUPLICADO', 'Já existe uma categoria com esse nome');

export async function rotasCategorias(app: FastifyInstance) {
  async function carregar(idParam: unknown) {
    const { id: idNum } = esquemaParamId.parse(idParam);
    const categoria = await app.banco.categoria.findUnique({
      where: { id: BigInt(idNum) },
      include: contagemAtivos,
    });
    if (!categoria) {
      throw erros.naoEncontrado('CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada');
    }
    return categoria;
  }

  async function nomeEmUso(nome: string, excetoId?: bigint) {
    const existente = await app.banco.categoria.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
    });
    return existente !== null && existente.id !== excetoId;
  }

  app.get('/categorias', { preHandler: app.autenticar }, async (request) => {
    const filtro = esquemaFiltroCategorias.parse(request.query);
    const lista = await app.banco.categoria.findMany({
      where: { ativo: filtro.ativo },
      include: contagemAtivos,
      orderBy: { nome: 'asc' }, // ordem alfabética (D-25)
    });
    return lista.map(paraCategoriaApi);
  });

  app.get('/categorias/:id', { preHandler: app.autenticar }, async (request) =>
    paraCategoriaApi(await carregar(request.params)),
  );

  app.post('/categorias', { preHandler: app.exigir('CARDAPIO') }, async (request, reply) => {
    const { nome } = esquemaCategoria.parse(request.body);
    if (await nomeEmUso(nome)) throw nomeDuplicado();
    try {
      const criada = await app.banco.categoria.create({ data: { nome }, include: contagemAtivos });
      return reply.status(201).send(paraCategoriaApi(criada));
    } catch (e) {
      if (eUnicoViolado(e)) throw nomeDuplicado();
      throw e;
    }
  });

  app.put('/categorias/:id', { preHandler: app.exigir('CARDAPIO') }, async (request) => {
    const atual = await carregar(request.params);
    const { nome } = esquemaCategoria.parse(request.body);
    if (await nomeEmUso(nome, atual.id)) throw nomeDuplicado();
    try {
      const salva = await app.banco.categoria.update({
        where: { id: atual.id },
        data: { nome },
        include: contagemAtivos,
      });
      return paraCategoriaApi(salva);
    } catch (e) {
      if (eUnicoViolado(e)) throw nomeDuplicado();
      throw e;
    }
  });

  app.patch('/categorias/:id/status', { preHandler: app.exigir('CARDAPIO') }, async (request) => {
    const atual = await carregar(request.params);
    const { ativo } = esquemaStatus.parse(request.body);
    const salva = await app.banco.categoria.update({
      where: { id: atual.id },
      data: { ativo },
      include: contagemAtivos,
    });
    // Produtos ativos que deixam de aparecer (ou voltam a aparecer) no Novo pedido.
    return { ...paraCategoriaApi(salva), produtosAfetados: salva._count.produtos };
  });
}
