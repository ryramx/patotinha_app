import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ConfigPix, TipoChavePix } from '@patotinha/shared';
import { esquemaConfigPix } from '@patotinha/shared';
import { detalhesZod, erros, ErroApp } from '../erros.js';
import { pode, usuarioDa } from '../auth/plugin.js';
import type { ConfigPix as ConfigPixBanco } from '../generated/prisma/client.js';
import { data } from '../serializar.js';

function paraConfigApi(c: ConfigPixBanco | null): ConfigPix {
  return {
    configurado: c !== null,
    tipoChave: (c?.tipoChave as TipoChavePix | undefined) ?? null,
    chave: c?.chave ?? null,
    nome: c?.nomeRecebedor ?? null,
    cidade: c?.cidade ?? null,
    atualizadoEm: c ? data(c.atualizadoEm) : null,
  };
}

/** Pix da loja (etapa 13, docs/pix.md): quem registra ou vê pedidos lê; só o administrador muda. */
export async function rotasPix(app: FastifyInstance) {
  const lerConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    await app.autenticar(request, reply);
    if (!pode(request.usuario, 'PEDIDOS_REGISTRAR') && !pode(request.usuario, 'PEDIDOS_VER')) {
      throw erros.semPermissao();
    }
  };

  app.get('/pix', { preHandler: lerConfig }, async () =>
    paraConfigApi(await app.banco.configPix.findUnique({ where: { id: 1 } })),
  );

  app.put('/pix', { preHandler: app.exigirAdmin }, async (request) => {
    const resultado = esquemaConfigPix.safeParse(request.body);
    if (!resultado.success) {
      const issue = resultado.error.issues[0];
      throw new ErroApp(
        422,
        'PIX_INVALIDO',
        issue?.message ?? 'Confira os dados do Pix',
        detalhesZod(resultado.error),
      );
    }
    const { tipoChave, chave, nome, cidade } = resultado.data;
    const usuario = usuarioDa(request);
    const dados = {
      tipoChave,
      chave,
      nomeRecebedor: nome,
      cidade,
      atualizadoPorId: usuario.id,
    };
    const salvo = await app.banco.configPix.upsert({
      where: { id: 1 },
      create: { id: 1, ...dados },
      update: dados,
    });
    // A chave não vai para o registro: só o tipo e quem mudou.
    request.log.info(
      { evento: 'pix_configurado', tipoChave, por: Number(usuario.id) },
      'Pix da loja configurado',
    );
    return paraConfigApi(salvo);
  });
}
