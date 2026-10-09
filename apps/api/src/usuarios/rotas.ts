import type { FastifyInstance } from 'fastify';
import {
  esquemaFiltroUsuarios,
  esquemaParamId,
  esquemaRedefinirSenha,
  esquemaStatus,
  esquemaUsuarioEdicao,
  esquemaUsuarioNovo,
} from '@patotinha/shared';
import { ErroApp, eUnicoViolado, erros } from '../erros.js';
import { gerarHash } from '../auth/senha.js';
import { usuarioDa } from '../auth/plugin.js';
import { buscarPorLogin, contarAdminsAtivos, paraUsuarioApi } from './repositorio.js';

const loginDuplicado = () => new ErroApp(409, 'LOGIN_DUPLICADO', 'Esse login já está em uso');
const naoEncontrado = () => erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado');
const ultimoAdmin = () =>
  new ErroApp(422, 'ULTIMO_ADMIN', 'É preciso ter pelo menos um administrador ativo');

/** Senha curta vira SENHA_FRACA, como pede o PRD 14.9. */
function validarSenha<T>(parse: () => T): T {
  try {
    return parse();
  } catch (e) {
    const issues = (e as { issues?: { path: PropertyKey[] }[] }).issues;
    if (issues?.some((i) => i.path[0] === 'senha' || i.path[0] === 'novaSenha')) {
      throw new ErroApp(422, 'SENHA_FRACA', 'A senha precisa ter pelo menos 8 caracteres');
    }
    throw e;
  }
}

export async function rotasUsuarios(app: FastifyInstance) {
  app.addHook('preHandler', app.exigirAdmin);

  async function carregar(idParam: unknown) {
    const { id } = esquemaParamId.parse(idParam);
    const usuario = await app.banco.usuario.findUnique({ where: { id: BigInt(id) } });
    if (!usuario) throw naoEncontrado();
    return usuario;
  }

  app.get('/usuarios', async (request) => {
    const filtro = esquemaFiltroUsuarios.parse(request.query);
    const lista = await app.banco.usuario.findMany({
      where: { ativo: filtro.ativo, perfil: filtro.perfil },
      orderBy: { nome: 'asc' },
    });
    return lista.map(paraUsuarioApi);
  });

  app.get('/usuarios/:id', async (request) => paraUsuarioApi(await carregar(request.params)));

  app.post('/usuarios', async (request, reply) => {
    const dados = validarSenha(() => esquemaUsuarioNovo.parse(request.body));
    if (await buscarPorLogin(app.banco, dados.login)) throw loginDuplicado();
    try {
      const criado = await app.banco.usuario.create({
        data: {
          nome: dados.nome,
          login: dados.login,
          perfil: dados.perfil,
          senhaHash: await gerarHash(dados.senha),
        },
      });
      request.log.info(
        {
          evento: 'usuario_criado',
          usuarioId: Number(criado.id),
          por: Number(usuarioDa(request).id),
        },
        'usuário criado',
      );
      return reply.status(201).send(paraUsuarioApi(criado));
    } catch (e) {
      if (eUnicoViolado(e)) throw loginDuplicado();
      throw e;
    }
  });

  app.put('/usuarios/:id', async (request) => {
    const atual = await carregar(request.params);
    const dados = esquemaUsuarioEdicao.parse(request.body);
    const outro = await buscarPorLogin(app.banco, dados.login);
    if (outro && outro.id !== atual.id) throw loginDuplicado();
    // Rebaixar o último administrador ativo deixaria o sistema sem admin (RN-19).
    if (atual.perfil === 'ADMIN' && atual.ativo && dados.perfil !== 'ADMIN') {
      if ((await contarAdminsAtivos(app.banco, atual.id)) === 0) throw ultimoAdmin();
    }
    try {
      const salvo = await app.banco.usuario.update({ where: { id: atual.id }, data: dados });
      return paraUsuarioApi(salvo);
    } catch (e) {
      if (eUnicoViolado(e)) throw loginDuplicado();
      throw e;
    }
  });

  app.patch('/usuarios/:id/status', async (request) => {
    const atual = await carregar(request.params);
    const { ativo } = esquemaStatus.parse(request.body);
    if (!ativo) {
      if (atual.id === usuarioDa(request).id) {
        throw new ErroApp(
          422,
          'NAO_PODE_DESATIVAR_A_SI_MESMO',
          'Você não pode desativar o seu próprio usuário',
        );
      }
      if (atual.perfil === 'ADMIN' && (await contarAdminsAtivos(app.banco, atual.id)) === 0) {
        throw ultimoAdmin();
      }
    }
    const salvo = await app.banco.usuario.update({ where: { id: atual.id }, data: { ativo } });
    request.log.info(
      {
        evento: ativo ? 'usuario_ativado' : 'usuario_desativado',
        usuarioId: Number(salvo.id),
        por: Number(usuarioDa(request).id),
      },
      ativo ? 'usuário ativado' : 'usuário desativado',
    );
    return paraUsuarioApi(salvo);
  });

  app.put('/usuarios/:id/senha', async (request, reply) => {
    const atual = await carregar(request.params);
    const { novaSenha } = validarSenha(() => esquemaRedefinirSenha.parse(request.body));
    await app.banco.usuario.update({
      where: { id: atual.id },
      data: { senhaHash: await gerarHash(novaSenha) },
    });
    request.log.info(
      {
        evento: 'senha_redefinida',
        usuarioId: Number(atual.id),
        por: Number(usuarioDa(request).id),
      },
      'senha redefinida',
    );
    return reply.status(204).send();
  });
}
