import { useSyncExternalStore } from 'react';

/**
 * Conexão com o servidor (etapa 17, docs/abrir-sem-esperar.md).
 *
 * O site fica num Static Site do Render, que nunca dorme; a API fica num serviço grátis que
 * desliga depois de 15 minutos parado e leva até 1 minuto para voltar. Em vez de segurar a
 * tela até ela acordar, o sistema abre na hora e este módulo fica perguntando a /api/vivo
 * (não toca no banco) em segundo plano. Enquanto ele diz "conectando":
 * - as consultas do React Query ficam em pausa e mostram a cópia guardada no aparelho;
 * - pedidos novos vão para a fila do aparelho (pedidos/filaPedidos.ts);
 * - o cabeçalho mostra "Conectando ao servidor".
 *
 * Antes de dizer "conectado", roda os preparos registrados (por exemplo, o login de verdade de
 * quem entrou sem esperar o servidor). Só depois as consultas voltam e a fila é enviada.
 */

export type EstadoConexao = 'conectando' | 'conectado';

const TEMPO_POR_TENTATIVA_MS = 15_000;
const INTERVALO_MIN_MS = 2_000;
const INTERVALO_MAX_MS = 15_000;

let estado: EstadoConexao = 'conectando';
/** Quando entrou no estado atual (para o aviso só aparecer se demorar). */
let desde = Date.now();
let rodando = false;
const ouvintes = new Set<() => void>();
const preparos = new Set<() => Promise<void>>();
let esperando: { promessa: Promise<void>; resolver: () => void } | null = null;

function mudar(novo: EstadoConexao) {
  if (novo === estado) return;
  estado = novo;
  desde = Date.now();
  if (novo === 'conectado' && esperando) {
    esperando.resolver();
    esperando = null;
  }
  ouvintes.forEach((fn) => fn());
}

/** Pergunta uma vez se a API está acordada. */
export async function servidorAcordado(): Promise<boolean> {
  try {
    const resposta = await fetch('/api/vivo', {
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_POR_TENTATIVA_MS),
    });
    if (!resposta.ok) return false;
    // Enquanto acorda, o Render pode devolver uma página HTML própria em vez do JSON.
    const corpo = (await resposta.json().catch(() => null)) as { status?: string } | null;
    return corpo?.status === 'ok';
  } catch {
    return false;
  }
}

async function rodarPreparos() {
  for (const preparo of [...preparos]) await preparo();
}

async function laco() {
  if (rodando) return;
  rodando = true;
  let intervalo = INTERVALO_MIN_MS;
  try {
    while (estado === 'conectando') {
      if (await servidorAcordado()) {
        try {
          await rodarPreparos();
          mudar('conectado');
          return;
        } catch {
          // Um preparo caiu por falta de conexão: tenta tudo de novo na próxima volta.
        }
      }
      await new Promise((r) => setTimeout(r, intervalo));
      intervalo = Math.min(INTERVALO_MAX_MS, Math.round(intervalo * 1.5));
    }
  } finally {
    rodando = false;
  }
}

/** Começa a acordar a API e a perguntar por ela. Seguro chamar várias vezes. */
export function iniciarConexao() {
  void laco();
}

/** Uma chamada falhou por falta de conexão: volta a "conectando" e pergunta de novo. */
export function marcarSemConexao() {
  mudar('conectando');
  void laco();
}

export function estadoConexao() {
  return estado;
}

export function conectadoDesde() {
  return desde;
}

/** Resolve quando o servidor estiver conectado (na hora, se já estiver). */
export function esperarConexao(): Promise<void> {
  if (estado === 'conectado') return Promise.resolve();
  if (!esperando) {
    let resolver = () => {};
    const promessa = new Promise<void>((r) => (resolver = r));
    esperando = { promessa, resolver };
  }
  void laco();
  return esperando.promessa;
}

/**
 * Registra algo que precisa rodar com o servidor acordado antes de tudo mais (o login de
 * verdade, por exemplo). Se lançar erro, a conexão continua "conectando" e tenta de novo.
 */
export function antesDeConectar(preparo: () => Promise<void>) {
  preparos.add(preparo);
  return () => void preparos.delete(preparo);
}

export function aoMudarEstadoConexao(fn: () => void) {
  ouvintes.add(fn);
  return () => void ouvintes.delete(fn);
}

export function useEstadoConexao(): EstadoConexao {
  return useSyncExternalStore(aoMudarEstadoConexao, estadoConexao, estadoConexao);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => marcarSemConexao());
  window.addEventListener('offline', () => mudar('conectando'));
}
