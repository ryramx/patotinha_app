import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from './banco.js';

/** Erro de regra de negócio, convertido no formato padrão { erro: { codigo, mensagem, detalhes } }. */
export class ErroApp extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes?: unknown,
  ) {
    super(mensagem);
  }
}

export const erros = {
  naoAutenticado: () =>
    new ErroApp(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre de novo para continuar'),
  semPermissao: () =>
    new ErroApp(
      403,
      'SEM_PERMISSAO',
      'Seu perfil não tem permissão para isso. Peça ao administrador para liberar',
    ),
  naoEncontrado: (codigo: string, mensagem: string) => new ErroApp(404, codigo, mensagem),
};

export function detalhesZod(erro: ZodError) {
  return erro.issues.map((issue) => ({
    campo: issue.path.join('.'),
    mensagem: issue.message,
  }));
}

export function eUnicoViolado(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

export function tratadorDeErros(
  erro: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (erro instanceof ErroApp) {
    return reply.status(erro.status).send({
      erro: { codigo: erro.codigo, mensagem: erro.message, detalhes: erro.detalhes },
    });
  }
  if (erro instanceof ZodError) {
    return reply.status(422).send({
      erro: {
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro.issues[0]?.message ?? 'Dados inválidos',
        detalhes: detalhesZod(erro),
      },
    });
  }
  const fe = erro as FastifyError;
  if (fe.statusCode === 400 || fe.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
    return reply.status(400).send({
      erro: { codigo: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido' },
    });
  }
  if (fe.statusCode === 415) {
    return reply.status(415).send({
      erro: { codigo: 'CONTENT_TYPE_INVALIDO', mensagem: 'Envie os dados como application/json' },
    });
  }
  if (fe.statusCode === 413) {
    return reply
      .status(413)
      .send({ erro: { codigo: 'CORPO_GRANDE_DEMAIS', mensagem: 'Requisição grande demais' } });
  }
  request.log.error({ err: erro }, 'erro inesperado');
  return reply.status(500).send({
    erro: {
      codigo: 'ERRO_INTERNO',
      mensagem: 'Algo deu errado do nosso lado. Tente de novo; se continuar, avise o administrador',
    },
  });
}
