import type { FastifyInstance } from 'fastify';
import type { ClienteSugerido } from '@patotinha/shared';
import { chaveCliente, esquemaBuscaClientes } from '@patotinha/shared';
import { ErroApp } from '../erros.js';

const MAX_SUGESTOES = 6;

export async function rotasClientes(app: FastifyInstance) {
  // Sugestões para o campo Nome do cliente no novo pedido: todas as palavras digitadas
  // aparecem no nome (sem diferenciar acentos), primeiro quem pediu por último.
  app.get(
    '/clientes',
    { preHandler: app.exigir('PEDIDOS_REGISTRAR') },
    async (request): Promise<{ dados: ClienteSugerido[] }> => {
      const resultado = esquemaBuscaClientes.safeParse(request.query);
      if (!resultado.success) {
        throw new ErroApp(422, 'FILTRO_INVALIDO', 'Filtro inválido', resultado.error.issues);
      }
      // % e _ são curingas do LIKE: aqui valem como letras comuns.
      const palavras = chaveCliente(resultado.data.busca)
        .split(' ')
        .filter(Boolean)
        .map((p) => p.replace(/[\\%_]/g, '\\$&'));
      const clientes = await app.banco.cliente.findMany({
        where: { AND: palavras.map((p) => ({ chave: { contains: p } })) },
        include: { _count: { select: { pedidos: true } } },
        orderBy: [{ ultimoPedidoEm: 'desc' }, { id: 'desc' }],
        take: MAX_SUGESTOES,
      });
      return {
        dados: clientes.map((c) => ({
          id: Number(c.id),
          nome: c.nome,
          telefone: c.telefone,
          pedidos: c._count.pedidos,
          ultimoPedidoEm: c.ultimoPedidoEm.toISOString(),
        })),
      };
    },
  );
}
