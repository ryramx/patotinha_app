/**
 * Cadastra o cardápio oficial (cardapio-oficial.ts) no banco. Pode rodar quantas vezes quiser:
 * produto que já existe (mesmo nome, sem diferenciar maiúsculas) só tem preço, categoria e
 * ingredientes acertados e volta a ficar ativo; nada é duplicado nem apagado.
 * Os ingredientes só são gravados quando a coluna produtos.ingredientes existe.
 *
 * Uso: npm run cadastrar:cardapio (desenvolvimento) ou o workflow "Cadastrar cardápio".
 * Com DESATIVAR_OUTROS=sim, produtos fora do cardápio oficial ficam inativos (não somem
 * dos pedidos antigos e podem ser reativados na tela de Cardápio).
 */
import { esquemaCategoria, esquemaProduto } from '@patotinha/shared';
import { criarBanco } from '../banco.js';
import { CARDAPIO_OFICIAL } from './cardapio-oficial.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}
const desativarOutros = process.env.DESATIVAR_OUTROS === 'sim';

const banco = criarBanco(databaseUrl);
try {
  await banco.$transaction(
    async (tx) => {
      const colunas = await tx.$queryRaw<{ existe: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'produtos'
            AND column_name = 'ingredientes'
        ) AS existe`;
      const temIngredientes = colunas[0]?.existe === true;
      if (!temIngredientes) {
        console.log('Coluna de ingredientes ainda não existe: ingredientes ficam para depois.');
      }

      const idsOficiais: bigint[] = [];
      for (const [nomeCategoria, produtos] of Object.entries(CARDAPIO_OFICIAL)) {
        esquemaCategoria.parse({ nome: nomeCategoria });
        let categoria = await tx.categoria.findFirst({
          where: { nome: { equals: nomeCategoria, mode: 'insensitive' } },
        });
        if (!categoria) {
          categoria = await tx.categoria.create({ data: { nome: nomeCategoria } });
          console.log(`+ categoria ${nomeCategoria}`);
        } else if (!categoria.ativo) {
          await tx.categoria.update({ where: { id: categoria.id }, data: { ativo: true } });
          console.log(`~ categoria ${nomeCategoria} reativada`);
        }

        for (const p of produtos) {
          esquemaProduto.parse({ nome: p.nome, preco: p.preco, categoriaId: Number(categoria.id) });
          const existente = await tx.produto.findFirst({
            where: { nome: { equals: p.nome, mode: 'insensitive' } },
          });
          let id: bigint;
          if (!existente) {
            const criado = await tx.produto.create({
              data: { nome: p.nome, preco: p.preco, categoriaId: categoria.id },
            });
            id = criado.id;
            console.log(`+ ${nomeCategoria}: ${p.nome} R$ ${p.preco}`);
          } else {
            id = existente.id;
            const mudou =
              existente.preco.toFixed(2) !== p.preco ||
              existente.categoriaId !== categoria.id ||
              !existente.ativo;
            if (mudou) {
              await tx.produto.update({
                where: { id },
                data: { preco: p.preco, categoriaId: categoria.id, ativo: true },
              });
              console.log(
                `~ ${nomeCategoria}: ${p.nome} R$ ${existente.preco.toFixed(2)} -> R$ ${p.preco}` +
                  (existente.ativo ? '' : ' (reativado)'),
              );
            } else {
              console.log(`= ${nomeCategoria}: ${p.nome} já estava certo`);
            }
          }
          if (temIngredientes) {
            await tx.$executeRaw`
              UPDATE produtos SET ingredientes = ${p.ingredientes ?? null}
              WHERE id = ${id} AND ingredientes IS DISTINCT FROM ${p.ingredientes ?? null}`;
          }
          idsOficiais.push(id);
        }
      }

      const outros = await tx.produto.findMany({
        where: { id: { notIn: idsOficiais }, ativo: true },
        orderBy: { nome: 'asc' },
      });
      for (const o of outros) {
        if (desativarOutros) {
          await tx.produto.update({ where: { id: o.id }, data: { ativo: false } });
          console.log(`- ${o.nome} desativado (fora do cardápio oficial)`);
        } else {
          console.log(`? ${o.nome} está ativo mas não faz parte do cardápio oficial`);
        }
      }
      if (desativarOutros) {
        const vazias = await tx.categoria.findMany({
          where: { ativo: true, produtos: { none: { ativo: true } } },
        });
        for (const c of vazias) {
          await tx.categoria.update({ where: { id: c.id }, data: { ativo: false } });
          console.log(`- categoria ${c.nome} desativada (ficou sem produtos ativos)`);
        }
      }
      console.log(`Cardápio oficial conferido: ${idsOficiais.length} produtos.`);
    },
    { timeout: 60_000 },
  );
} catch (erro) {
  console.error((erro as Error).message);
  process.exitCode = 1;
} finally {
  await banco.$disconnect();
}
