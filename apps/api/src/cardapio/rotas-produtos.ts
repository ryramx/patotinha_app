import type { FastifyInstance } from 'fastify';
import type { Produto } from '@patotinha/shared';
import {
  deCentavos,
  esquemaFiltroProdutos,
  esquemaParamId,
  esquemaProduto,
  esquemaStatus,
  paraCentavos,
} from '@patotinha/shared';
import { ErroApp, eUnicoViolado, erros } from '../erros.js';
import { usuarioDa } from '../auth/plugin.js';
import { data, dinheiro, id } from '../serializar.js';
import type { Categoria, Produto as ProdutoBanco } from '../generated/prisma/client.js';

type ProdutoComCategoria = ProdutoBanco & { categoria: Categoria };

function paraProdutoApi(p: ProdutoComCategoria): Produto {
  return {
    id: id(p.id),
    nome: p.nome,
    preco: dinheiro(p.preco),
    ativo: p.ativo,
    categoria: { id: id(p.categoria.id), nome: p.categoria.nome, ativo: p.categoria.ativo },
    criadoEm: data(p.criadoEm),
    atualizadoEm: data(p.atualizadoEm),
  };
}

const nomeDuplicado = () =>
  new ErroApp(409, 'NOME_DUPLICADO', 'Já existe um produto com esse nome');
const categoriaInativa = () => new ErroApp(422, 'CATEGORIA_INATIVA', 'Escolha uma categoria ativa');

export async function rotasProdutos(app: FastifyInstance) {
  async function carregar(idParam: unknown) {
    const { id: idNum } = esquemaParamId.parse(idParam);
    const produto = await app.banco.produto.findUnique({
      where: { id: BigInt(idNum) },
      include: { categoria: true },
    });
    if (!produto) throw erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado');
    return produto;
  }

  /** Valida o corpo: preço vira PRECO_INVALIDO; categoria precisa existir e estar ativa (RN-21). */
  async function validar(corpo: unknown, excetoId?: bigint) {
    const resultado = esquemaProduto.safeParse(corpo);
    if (!resultado.success) {
      const issue = resultado.error.issues[0];
      if (issue?.path[0] === 'preco') {
        throw new ErroApp(
          422,
          'PRECO_INVALIDO',
          issue.message === 'Valor inválido'
            ? 'Informe um preço válido, maior ou igual a zero'
            : issue.message,
        );
      }
      throw resultado.error;
    }
    const dados = resultado.data;
    const categoria = await app.banco.categoria.findUnique({
      where: { id: BigInt(dados.categoriaId) },
    });
    if (!categoria) {
      throw erros.naoEncontrado('CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada');
    }
    const existente = await app.banco.produto.findFirst({
      where: { nome: { equals: dados.nome, mode: 'insensitive' } },
    });
    if (existente && existente.id !== excetoId) throw nomeDuplicado();
    return { dados, categoria, precoNormalizado: deCentavos(paraCentavos(dados.preco)) };
  }

  app.get('/produtos', { preHandler: app.autenticar }, async (request) => {
    const filtro = esquemaFiltroProdutos.parse(request.query);
    const lista = await app.banco.produto.findMany({
      where: {
        ativo: filtro.ativo,
        // Com ativo=true, só produtos ativos de categorias ativas (RN-02).
        categoria: filtro.ativo === true ? { ativo: true } : undefined,
        categoriaId: filtro.categoriaId ? BigInt(filtro.categoriaId) : undefined,
        nome: filtro.busca ? { contains: filtro.busca, mode: 'insensitive' } : undefined,
      },
      include: { categoria: true },
      orderBy: { nome: 'asc' },
    });
    return lista.map(paraProdutoApi);
  });

  app.get('/produtos/:id', { preHandler: app.autenticar }, async (request) =>
    paraProdutoApi(await carregar(request.params)),
  );

  app.post('/produtos', { preHandler: app.exigirAdmin }, async (request, reply) => {
    const { dados, categoria, precoNormalizado } = await validar(request.body);
    if (!categoria.ativo) throw categoriaInativa();
    try {
      const criado = await app.banco.produto.create({
        data: { nome: dados.nome, categoriaId: categoria.id, preco: precoNormalizado },
        include: { categoria: true },
      });
      return reply.status(201).send(paraProdutoApi(criado));
    } catch (e) {
      if (eUnicoViolado(e)) throw nomeDuplicado();
      throw e;
    }
  });

  app.put('/produtos/:id', { preHandler: app.exigirAdmin }, async (request) => {
    const atual = await carregar(request.params);
    const { dados, categoria, precoNormalizado } = await validar(request.body, atual.id);
    // Mover para categoria inativa não é permitido; manter a categoria atual é.
    if (!categoria.ativo && categoria.id !== atual.categoriaId) throw categoriaInativa();
    try {
      const salvo = await app.banco.produto.update({
        where: { id: atual.id },
        data: { nome: dados.nome, categoriaId: categoria.id, preco: precoNormalizado },
        include: { categoria: true },
      });
      if (dinheiro(atual.preco) !== dinheiro(salvo.preco)) {
        // Pedidos já gravados não mudam (RN-07); o log guarda o preço anterior e o novo.
        request.log.info(
          {
            evento: 'preco_alterado',
            produtoId: Number(salvo.id),
            precoAnterior: dinheiro(atual.preco),
            precoNovo: dinheiro(salvo.preco),
            por: Number(usuarioDa(request).id),
          },
          'preço alterado',
        );
      }
      return paraProdutoApi(salvo);
    } catch (e) {
      if (eUnicoViolado(e)) throw nomeDuplicado();
      throw e;
    }
  });

  app.patch('/produtos/:id/status', { preHandler: app.exigirAdmin }, async (request) => {
    const atual = await carregar(request.params);
    const { ativo } = esquemaStatus.parse(request.body);
    if (ativo && !atual.categoria.ativo) throw categoriaInativa();
    const salvo = await app.banco.produto.update({
      where: { id: atual.id },
      data: { ativo },
      include: { categoria: true },
    });
    return paraProdutoApi(salvo);
  });

  app.get('/formas-pagamento', { preHandler: app.autenticar }, async () => {
    const formas = await app.banco.formaPagamento.findMany({
      where: { ativo: true },
      orderBy: { id: 'asc' },
    });
    return formas.map((f) => ({ id: f.id, codigo: f.codigo, nome: f.nome }));
  });
}
