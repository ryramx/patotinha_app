import type { ErroApi } from '@patotinha/shared';
import { t } from '../textos';

/** Erro devolvido pela API no formato padrão, ou falta de conexão (status 0). */
export class ErroDaApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes?: unknown;

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
  get semConexao() {
    return this.status === 0;
  }
}

type Ouvinte = (erro: ErroDaApi) => void;
const ouvintesSessao = new Set<Ouvinte>();
const ouvintesConexao = new Set<(online: boolean) => void>();

/** Avisado quando a sessão expira (401) para levar ao login sem apagar o rascunho. */
export function aoExpirarSessao(fn: Ouvinte) {
  ouvintesSessao.add(fn);
  return () => void ouvintesSessao.delete(fn);
}

/** Avisado quando a conexão com o servidor cai ou volta. */
export function aoMudarConexao(fn: (online: boolean) => void) {
  ouvintesConexao.add(fn);
  return () => void ouvintesConexao.delete(fn);
}

function avisarConexao(online: boolean) {
  ouvintesConexao.forEach((fn) => fn(online));
}

export async function api<T>(
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH'; corpo?: unknown; sinal?: AbortSignal } = {},
): Promise<T> {
  const metodo = opcoes.metodo ?? 'GET';
  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: metodo === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: metodo === 'GET' ? undefined : JSON.stringify(opcoes.corpo ?? {}),
      signal: opcoes.sinal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    avisarConexao(false);
    throw new ErroDaApi(0, 'SEM_CONEXAO', t('erro.semConexaoCarregar'));
  }
  avisarConexao(resposta.status !== 502 && resposta.status !== 504);

  if (resposta.status === 204) return undefined as T;
  const corpo = await resposta.json().catch(() => null);
  if (resposta.ok) return corpo as T;

  const erro = (corpo as ErroApi | null)?.erro;
  const falha = new ErroDaApi(
    resposta.status,
    erro?.codigo ?? 'ERRO_INTERNO',
    erro?.mensagem ??
      (resposta.status >= 502 ? t('erro.semConexaoCarregar') : t('erro.inesperado')),
    erro?.detalhes,
  );
  if (resposta.status >= 502) {
    avisarConexao(false);
    throw new ErroDaApi(0, 'SEM_CONEXAO', t('erro.semConexaoCarregar'));
  }
  if (resposta.status === 401 && falha.codigo === 'NAO_AUTENTICADO') {
    ouvintesSessao.forEach((fn) => fn(falha));
  }
  return Promise.reject(falha);
}

export function query(params: Record<string, string | number | boolean | undefined | null>) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor));
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : '';
}
