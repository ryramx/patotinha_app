/**
 * Dados só para desenvolvimento (tarefa 3.7): categorias, os produtos do exemplo do PRD 3
 * e um funcionário de teste. Pode rodar mais de uma vez; não duplica nada.
 *
 * Uso: npm run seed:dev
 * A senha do funcionário de teste vem de SEED_SENHA_FUNCIONARIO ou é gerada e mostrada aqui.
 */
import { randomBytes } from 'node:crypto';
import { criarBanco } from '../src/banco.js';
import { gerarHash } from '../src/auth/senha.js';
import { buscarPorLogin } from '../src/usuarios/repositorio.js';

if (process.env.NODE_ENV === 'production') {
  console.error('O seed de desenvolvimento não roda em produção.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}

const cardapio: Record<string, [string, string][]> = {
  Pastéis: [
    ['Pastel de Carne', '8.00'],
    ['Pastel de Queijo', '7.00'],
    ['Pastel de Frango', '8.00'],
    ['Pastel de Pizza', '8.50'],
    ['Pastel de Palmito', '9.00'],
    ['Pastel de Carne com Queijo', '9.50'],
  ],
  Coxinhas: [
    ['Coxinha de Frango', '6.00'],
    ['Coxinha com Catupiry', '7.00'],
  ],
  Bebidas: [
    ['Coca-Cola', '5.00'],
    ['Guaraná', '5.00'],
    ['Suco de Laranja', '7.00'],
    ['Água', '3.00'],
    ['Caldo de Cana', '6.00'],
  ],
  Doces: [
    ['Pastel de Banana com Canela', '8.00'],
    ['Pastel de Chocolate', '9.00'],
  ],
};

const banco = criarBanco(databaseUrl);
try {
  for (const [nomeCategoria, produtos] of Object.entries(cardapio)) {
    const categoria =
      (await banco.categoria.findFirst({
        where: { nome: { equals: nomeCategoria, mode: 'insensitive' } },
      })) ?? (await banco.categoria.create({ data: { nome: nomeCategoria } }));
    for (const [nome, preco] of produtos) {
      const existe = await banco.produto.findFirst({
        where: { nome: { equals: nome, mode: 'insensitive' } },
      });
      if (!existe) await banco.produto.create({ data: { nome, preco, categoriaId: categoria.id } });
    }
  }
  console.log('Cardápio de exemplo cadastrado.');

  if (!(await buscarPorLogin(banco, 'maria'))) {
    const senha = process.env.SEED_SENHA_FUNCIONARIO ?? randomBytes(9).toString('base64url');
    await banco.usuario.create({
      data: {
        nome: 'Maria',
        login: 'maria',
        perfil: 'FUNCIONARIO',
        senhaHash: await gerarHash(senha),
      },
    });
    console.log(`Funcionária de teste criada: login "maria", senha "${senha}".`);
  } else {
    console.log('Funcionária de teste "maria" já existe.');
  }
} finally {
  await banco.$disconnect();
}
