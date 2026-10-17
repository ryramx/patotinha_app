import type { Usuario } from '@patotinha/shared';
import type { Banco } from '../banco.js';
import type { Usuario as UsuarioBanco } from '../generated/prisma/client.js';
import { data, id } from '../serializar.js';

/** Nunca devolve senha_hash (CA-11). */
export function paraUsuarioApi(u: UsuarioBanco): Usuario {
  return {
    id: id(u.id),
    nome: u.nome,
    login: u.login,
    perfil: u.perfil as Usuario['perfil'],
    ativo: u.ativo,
    criadoEm: data(u.criadoEm),
    atualizadoEm: data(u.atualizadoEm),
  };
}

export function buscarPorLogin(banco: Banco, login: string) {
  return banco.usuario.findFirst({
    where: { login: { equals: login, mode: 'insensitive' } },
    include: { dadosPerfil: true },
  });
}

export function contarAdminsAtivos(banco: Banco, excetoId?: bigint) {
  return banco.usuario.count({
    where: { perfil: 'ADMIN', ativo: true, ...(excetoId ? { id: { not: excetoId } } : {}) },
  });
}
