import type { FastifyInstance } from 'fastify';
import type { PerfilAcesso } from '@patotinha/shared';
import { esquemaParamPerfil, esquemaPermissoesPerfil, type Perfil } from '@patotinha/shared';
import { ErroApp } from '../erros.js';
import { permissoesDoPerfil, usuarioDa } from '../auth/plugin.js';
import type { Perfil as PerfilBanco } from '../generated/prisma/client.js';
import { data } from '../serializar.js';

function paraPerfilApi(p: PerfilBanco, usuariosAtivos: number): PerfilAcesso {
  return {
    codigo: p.codigo as Perfil,
    nome: p.nome,
    permissoes: permissoesDoPerfil(p.codigo, p.permissoes),
    editavel: p.codigo !== 'ADMIN',
    usuariosAtivos,
    atualizadoEm: data(p.atualizadoEm),
  };
}

const ORDEM: Perfil[] = ['ADMIN', 'GERENTE', 'CHEF', 'FUNCIONARIO'];

/** Perfis e permissões (etapa 10): só o administrador vê e muda. */
export async function rotasPerfis(app: FastifyInstance) {
  app.addHook('preHandler', app.exigirAdmin);

  async function contarAtivos() {
    const grupos = await app.banco.usuario.groupBy({
      by: ['perfil'],
      where: { ativo: true },
      _count: { _all: true },
    });
    return (codigo: string) => grupos.find((g) => g.perfil === codigo)?._count._all ?? 0;
  }

  app.get('/perfis', async () => {
    const [perfis, ativos] = await Promise.all([app.banco.perfil.findMany(), contarAtivos()]);
    return perfis
      .sort((a, b) => ORDEM.indexOf(a.codigo as Perfil) - ORDEM.indexOf(b.codigo as Perfil))
      .map((p) => paraPerfilApi(p, ativos(p.codigo)));
  });

  app.put('/perfis/:codigo/permissoes', async (request) => {
    const { codigo } = esquemaParamPerfil.parse(request.params);
    // O administrador sempre pode tudo: assim ninguém tranca o sistema por engano.
    if (codigo === 'ADMIN') {
      throw new ErroApp(
        422,
        'PERFIL_FIXO',
        'O perfil Administrador sempre tem todas as permissões',
      );
    }
    const { permissoes } = esquemaPermissoesPerfil.parse(request.body);
    const salvo = await app.banco.perfil.update({ where: { codigo }, data: { permissoes } });
    request.log.info(
      {
        evento: 'permissoes_alteradas',
        perfil: codigo,
        permissoes,
        por: Number(usuarioDa(request).id),
      },
      'permissões do perfil alteradas',
    );
    return paraPerfilApi(salvo, (await contarAtivos())(codigo));
  });
}
