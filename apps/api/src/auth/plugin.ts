import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { PERMISSOES, type Perfil, type Permissao } from '@patotinha/shared';
import { erros } from '../erros.js';

export const NOME_COOKIE = 'sessao';
export const DURACAO_SESSAO_S = 12 * 60 * 60; // 12 h (D-21)

export interface UsuarioAutenticado {
  id: bigint;
  nome: string;
  login: string;
  perfil: Perfil;
  /** Lidas do banco a cada requisição: mudar na tela de perfis vale na hora. */
  permissoes: Permissao[];
}

interface TokenSessao {
  sub: string;
  perfil: Perfil;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenSessao;
    user: TokenSessao;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
  interface FastifyInstance {
    /** Qualquer usuário logado e ativo, de qualquer perfil. */
    autenticar: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Somente o perfil Administrador (ex.: tela de perfis e permissões). */
    exigirAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Usuário logado cujo perfil tem a permissão; o administrador sempre passa. */
    exigir: (
      permissao: Permissao,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** O administrador pode tudo, mesmo o que não estiver gravado no perfil. */
export function permissoesDoPerfil(perfil: string, gravadas: string[]): Permissao[] {
  if (perfil === 'ADMIN') return [...PERMISSOES];
  return PERMISSOES.filter((p) => gravadas.includes(p));
}

export function pode(usuario: UsuarioAutenticado | undefined, permissao: Permissao) {
  return !!usuario && (usuario.perfil === 'ADMIN' || usuario.permissoes.includes(permissao));
}

/** O usuário da requisição; só chamar em rotas protegidas por `autenticar`. */
export function usuarioDa(request: FastifyRequest): UsuarioAutenticado {
  if (!request.usuario) throw erros.naoAutenticado();
  return request.usuario;
}

async function pluginAutenticacao(app: FastifyInstance, opcoes: { segredo: string }) {
  await app.register(fastifyJwt, {
    secret: opcoes.segredo,
    sign: { algorithm: 'HS256', expiresIn: DURACAO_SESSAO_S },
    verify: { algorithms: ['HS256'] },
    cookie: { cookieName: NOME_COOKIE, signed: false },
  });

  app.decorate('autenticar', async (request: FastifyRequest) => {
    let token: TokenSessao;
    try {
      token = await request.jwtVerify<TokenSessao>({ onlyCookie: true });
    } catch {
      throw erros.naoAutenticado();
    }
    // A cada requisição, confere no banco se o usuário continua ativo e com o mesmo perfil (RN-18).
    const usuario = await app.banco.usuario.findUnique({
      where: { id: BigInt(token.sub) },
      include: { dadosPerfil: true },
    });
    if (!usuario || !usuario.ativo || usuario.perfil !== token.perfil) {
      throw erros.naoAutenticado();
    }
    request.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      perfil: usuario.perfil as Perfil,
      permissoes: permissoesDoPerfil(usuario.perfil, usuario.dadosPerfil.permissoes),
    };
  });

  app.decorate('exigirAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await app.autenticar(request, reply);
    if (request.usuario?.perfil !== 'ADMIN') throw erros.semPermissao();
  });

  app.decorate('exigir', (permissao: Permissao) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await app.autenticar(request, reply);
      if (!pode(request.usuario, permissao)) throw erros.semPermissao();
    };
  });
}

export default fp(pluginAutenticacao, { name: 'autenticacao', dependencies: ['banco'] });
