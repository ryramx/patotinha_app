import argon2 from 'argon2';

/** Senhas sempre com Argon2id (PRD 10). Nunca registrar a senha nem o hash em log. */
export function gerarHash(senha: string): Promise<string> {
  return argon2.hash(senha, { type: argon2.argon2id });
}

export async function conferirSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    return false;
  }
}

/** Hash fixo usado quando o login não existe, para o tempo de resposta não revelar isso. */
let hashFalso: Promise<string> | null = null;
export function hashParaComparacaoFalsa(): Promise<string> {
  hashFalso ??= gerarHash('senha-inexistente-para-comparacao');
  return hashFalso;
}
