/**
 * Cria o primeiro administrador (tarefa 3.6). Pede nome, login e senha no terminal;
 * nunca existe senha padrão no código (PRD 10, Primeiro acesso).
 *
 * Uso: npm run seed:admin
 * Sem terminal (ex.: implantação), passe ADMIN_NOME, ADMIN_LOGIN e ADMIN_SENHA no ambiente.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { esquemaUsuarioNovo } from '@patotinha/shared';
import { criarBanco } from '../src/banco.js';
import { gerarHash } from '../src/auth/senha.js';
import { buscarPorLogin } from '../src/usuarios/repositorio.js';

async function perguntar(texto: string, oculto = false): Promise<string> {
  let mudo = false;
  const saida = new Writable({
    write(chunk, _enc, cb) {
      if (!mudo) stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: stdin, output: saida, terminal: true });
  const promessa = rl.question(texto);
  mudo = oculto;
  const resposta = await promessa;
  rl.close();
  if (oculto) stdout.write('\n');
  return resposta.trim();
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não definida. Copie o .env.example para .env e preencha.');
  process.exit(1);
}

const banco = criarBanco(databaseUrl);
try {
  const nome = process.env.ADMIN_NOME ?? (await perguntar('Nome do administrador: '));
  const login = process.env.ADMIN_LOGIN ?? (await perguntar('Login (minúsculas, ex.: ana): '));
  let senha = process.env.ADMIN_SENHA;
  if (!senha) {
    senha = await perguntar('Senha (mínimo 8 caracteres): ', true);
    const confirmacao = await perguntar('Repita a senha: ', true);
    if (senha !== confirmacao) throw new Error('As senhas não conferem.');
  }

  const dados = esquemaUsuarioNovo.safeParse({ nome, login, perfil: 'ADMIN', senha });
  if (!dados.success) {
    throw new Error(dados.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join('\n'));
  }
  if (await buscarPorLogin(banco, dados.data.login)) {
    throw new Error(`Já existe um usuário com o login "${dados.data.login}".`);
  }
  const criado = await banco.usuario.create({
    data: {
      nome: dados.data.nome,
      login: dados.data.login,
      perfil: 'ADMIN',
      senhaHash: await gerarHash(dados.data.senha),
    },
  });
  console.log(`Administrador "${criado.login}" criado.`);
} catch (erro) {
  console.error((erro as Error).message);
  process.exitCode = 1;
} finally {
  await banco.$disconnect();
}
