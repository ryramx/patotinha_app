import type { FastifyInstance } from 'fastify';
import { esquemaLogin, esquemaTrocarSenha } from '@patotinha/shared';
import { ErroApp } from '../erros.js';
import { buscarPorLogin } from '../usuarios/repositorio.js';
import { conferirSenha, gerarHash, hashParaComparacaoFalsa } from './senha.js';
import { LimiteLogin } from './limite-login.js';
import { DURACAO_SESSAO_S, NOME_COOKIE, usuarioDa } from './plugin.js';

export async function rotasAuth(app: FastifyInstance, opcoes: { limite: LimiteLogin }) {
  const { limite } = opcoes;
  const cookieSeguro = {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
  };

  app.post('/auth/login', async (request, reply) => {
    const { login, senha } = esquemaLogin.parse(request.body);
    const ip = request.ip;

    if (limite.bloqueado(ip, login)) {
      request.log.warn(
        { evento: 'login_bloqueado', login },
        'login bloqueado por excesso de tentativas',
      );
      throw new ErroApp(
        429,
        'MUITAS_TENTATIVAS',
        'Muitas tentativas. Aguarde 1 minuto e tente de novo',
      );
    }

    const usuario = await buscarPorLogin(app.banco, login);
    const senhaOk = usuario
      ? await conferirSenha(usuario.senhaHash, senha)
      : await conferirSenha(await hashParaComparacaoFalsa(), senha);

    if (!usuario || !senhaOk || !usuario.ativo) {
      limite.registrarFalha(ip, login);
      request.log.info({ evento: 'login_falha', login }, 'login com falha');
      throw new ErroApp(401, 'CREDENCIAIS_INVALIDAS', 'Usuário ou senha inválidos');
    }

    const token = await reply.jwtSign({
      sub: String(usuario.id),
      perfil: usuario.perfil as 'ADMIN',
    });
    request.log.info(
      { evento: 'login_sucesso', usuarioId: Number(usuario.id) },
      'login com sucesso',
    );
    return reply.setCookie(NOME_COOKIE, token, { ...cookieSeguro, maxAge: DURACAO_SESSAO_S }).send({
      usuario: {
        id: Number(usuario.id),
        nome: usuario.nome,
        login: usuario.login,
        perfil: usuario.perfil,
      },
    });
  });

  app.post('/auth/logout', { preHandler: app.autenticar }, async (_request, reply) => {
    return reply.clearCookie(NOME_COOKIE, cookieSeguro).status(204).send();
  });

  app.get('/auth/me', { preHandler: app.autenticar }, async (request) => {
    const u = usuarioDa(request);
    return { usuario: { id: Number(u.id), nome: u.nome, login: u.login, perfil: u.perfil } };
  });

  app.put('/auth/senha', { preHandler: app.autenticar }, async (request, reply) => {
    const dados = esquemaTrocarSenha.safeParse(request.body);
    if (!dados.success) {
      const senhaFraca = dados.error.issues.some((i) => i.path[0] === 'novaSenha');
      if (senhaFraca) {
        throw new ErroApp(422, 'SENHA_FRACA', 'A senha precisa ter pelo menos 8 caracteres');
      }
      throw dados.error;
    }
    const u = usuarioDa(request);
    const atual = await app.banco.usuario.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await conferirSenha(atual.senhaHash, dados.data.senhaAtual))) {
      throw new ErroApp(401, 'SENHA_ATUAL_INCORRETA', 'A senha atual está incorreta');
    }
    await app.banco.usuario.update({
      where: { id: u.id },
      data: { senhaHash: await gerarHash(dados.data.novaSenha) },
    });
    request.log.info({ evento: 'senha_trocada', usuarioId: Number(u.id) }, 'senha trocada');
    return reply.status(204).send();
  });
}
