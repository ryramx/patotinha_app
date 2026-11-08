import { DURACAO_SESSAO_S, type UsuarioSessao } from '@patotinha/shared';

/**
 * Entrar sem esperar o servidor (etapa 16, docs/abrir-sem-esperar.md).
 *
 * 1. Sessão lembrada: depois de um login no servidor, o aparelho lembra quem entrou e até
 *    quando o cookie vale (12 h, D-21). Ao abrir o sistema dentro desse prazo, a tela abre na
 *    hora e o servidor confere a sessão em segundo plano.
 * 2. Acesso do aparelho: depois de um login no servidor, o aparelho guarda um resumo da senha
 *    (PBKDF2-SHA-256 com sal, nunca a senha) e os dados de quem entrou. Se a pessoa entrar de
 *    novo com a API dormindo, o aparelho confere a senha com esse resumo e abre na hora; o
 *    login de verdade acontece sozinho assim que a API acordar. Se o servidor recusar (senha
 *    trocada, usuário desativado), o sistema sai.
 *
 * Uma senha que o aparelho não conhece (outra pessoa, senha nova) sempre espera o servidor.
 */

const CHAVE_SESSAO = 'patotinha.sessao';
const CHAVE_ACESSOS = 'patotinha.acessos';
const ITERACOES = 210_000;
const MAX_ACESSOS = 10;

interface SessaoLembrada {
  usuario: UsuarioSessao;
  /** Até quando o cookie de sessão vale (ms). */
  expiraEm: number;
}

interface AcessoDoAparelho {
  sal: string;
  resumo: string;
  usuario: UsuarioSessao;
  salvoEm: number;
}

const normalizar = (login: string) => login.trim().toLowerCase();

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJson(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento: o sistema só não abre antes de o servidor responder.
  }
}

// ----- Sessão lembrada -----

export function lerSessaoLembrada(agora = Date.now()): UsuarioSessao | null {
  const s = lerJson<SessaoLembrada | null>(CHAVE_SESSAO, null);
  if (!s?.usuario || typeof s.expiraEm !== 'number' || s.expiraEm <= agora) return null;
  return s.usuario;
}

/** Login no servidor: começa uma sessão nova de 12 h. */
export function lembrarSessaoNova(usuario: UsuarioSessao) {
  gravarJson(CHAVE_SESSAO, { usuario, expiraEm: Date.now() + DURACAO_SESSAO_S * 1000 });
}

/** O servidor confirmou a sessão (/auth/me): atualiza os dados sem mudar o prazo. */
export function atualizarSessaoLembrada(usuario: UsuarioSessao) {
  const s = lerJson<SessaoLembrada | null>(CHAVE_SESSAO, null);
  const expiraEm =
    s && s.usuario?.id === usuario.id ? s.expiraEm : Date.now() + DURACAO_SESSAO_S * 1000;
  gravarJson(CHAVE_SESSAO, { usuario, expiraEm });
}

export function esquecerSessao() {
  try {
    localStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // ignora
  }
}

// ----- Acesso do aparelho (senha conferida sem o servidor) -----

function paraBase64(bytes: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function deBase64(texto: string) {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

/** crypto.subtle só existe em HTTPS e no localhost; fora disso, sempre espera o servidor. */
const temCripto = () => typeof crypto !== 'undefined' && !!crypto.subtle;

async function resumir(login: string, senha: string, sal: Uint8Array) {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${normalizar(login)}\u0000${senha}`),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: ITERACOES },
    chave,
    256,
  );
  return paraBase64(bits);
}

/** Depois de um login aceito pelo servidor: guarda o resumo da senha neste aparelho. */
export async function guardarAcesso(login: string, senha: string, usuario: UsuarioSessao) {
  if (!temCripto()) return;
  try {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const resumo = await resumir(login, senha, sal);
    const acessos = lerJson<Record<string, AcessoDoAparelho>>(CHAVE_ACESSOS, {});
    acessos[normalizar(login)] = { sal: paraBase64(sal), resumo, usuario, salvoEm: Date.now() };
    // Guarda só os mais recentes: o aparelho do balcão não precisa lembrar todo mundo.
    const ordenados = Object.entries(acessos)
      .sort((a, b) => b[1].salvoEm - a[1].salvoEm)
      .slice(0, MAX_ACESSOS);
    gravarJson(CHAVE_ACESSOS, Object.fromEntries(ordenados));
  } catch {
    // Sem cripto ou armazenamento: só não entra antes de o servidor responder.
  }
}

/** Confere a senha com o resumo do aparelho. Devolve quem entrou, ou null se não der. */
export async function conferirAcesso(login: string, senha: string) {
  if (!temCripto()) return null;
  const acesso = lerJson<Record<string, AcessoDoAparelho>>(CHAVE_ACESSOS, {})[normalizar(login)];
  if (!acesso) return null;
  try {
    const resumo = await resumir(login, senha, deBase64(acesso.sal));
    return resumo === acesso.resumo ? acesso.usuario : null;
  } catch {
    return null;
  }
}

/** O servidor recusou a senha: o resumo antigo não vale mais. */
export function esquecerAcesso(login: string) {
  const acessos = lerJson<Record<string, AcessoDoAparelho>>(CHAVE_ACESSOS, {});
  delete acessos[normalizar(login)];
  gravarJson(CHAVE_ACESSOS, acessos);
}

/** Os dados de quem entrou mudaram (tutorial visto, permissões): atualiza o que o aparelho lembra. */
export function atualizarUsuarioNoAparelho(usuario: UsuarioSessao) {
  const s = lerJson<SessaoLembrada | null>(CHAVE_SESSAO, null);
  if (s?.usuario?.id === usuario.id) gravarJson(CHAVE_SESSAO, { ...s, usuario });
  const acessos = lerJson<Record<string, AcessoDoAparelho>>(CHAVE_ACESSOS, {});
  let mudou = false;
  for (const acesso of Object.values(acessos)) {
    if (acesso.usuario?.id !== usuario.id) continue;
    acesso.usuario = usuario;
    mudou = true;
  }
  if (mudou) gravarJson(CHAVE_ACESSOS, acessos);
}
