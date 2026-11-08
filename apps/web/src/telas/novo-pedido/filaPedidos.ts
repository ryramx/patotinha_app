import { useSyncExternalStore } from 'react';
import type { DadosNovoPedido, Pedido } from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import type { Rascunho } from './rascunho';

/**
 * Pedidos guardados no aparelho (etapa 16, docs/abrir-sem-esperar.md).
 *
 * Com a API dormindo (ou a internet caída), finalizar não perde o pedido nem segura o caixa:
 * ele entra nesta fila, salva no navegador, e sobe sozinho, em ordem, assim que o servidor
 * responder. Cada pedido leva a chave de idempotência do rascunho, então reenviar depois de uma
 * queda não grava duas vezes (RN-26).
 *
 * Se o servidor recusar um pedido (preço mudou, produto desativado), ele fica marcado aqui com o
 * motivo, e a pessoa abre de novo no Novo pedido para corrigir. Nada some sem aviso.
 * Cada pedido é de quem o registrou: só sobe com a sessão dessa pessoa.
 */

export interface PedidoGuardado {
  chave: string;
  usuarioId: number;
  corpo: DadosNovoPedido;
  /** O rascunho como estava, para abrir de novo se o servidor recusar. */
  rascunho: Rascunho;
  totalCentavos: number;
  guardadoEm: string;
  recusa?: { codigo: string; mensagem: string };
}

const CHAVE = 'patotinha.pedidosGuardados';

function ler(): PedidoGuardado[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as PedidoGuardado[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

let pedidos: PedidoGuardado[] = ler();
const ouvintes = new Set<() => void>();
let envio: Promise<void> | null = null;

function gravar(nova: PedidoGuardado[]) {
  pedidos = nova;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(pedidos));
  } catch {
    // Sem armazenamento a fila vale só até recarregar a página.
  }
  ouvintes.forEach((fn) => fn());
}

// Outra aba do mesmo aparelho mexeu na fila.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CHAVE) return;
    pedidos = ler();
    ouvintes.forEach((fn) => fn());
  });
}

export function guardarPedido(p: Omit<PedidoGuardado, 'guardadoEm'>) {
  if (pedidos.some((x) => x.chave === p.chave)) return;
  gravar([...pedidos, { ...p, guardadoEm: new Date().toISOString() }]);
}

export function tirarPedido(chave: string) {
  gravar(pedidos.filter((p) => p.chave !== chave));
}

export function pedidosGuardados() {
  return pedidos;
}

interface Retorno {
  aoEnviar: (pedido: Pedido) => void;
  aoRecusar: (guardado: PedidoGuardado) => void;
}

/**
 * Envia, em ordem, os pedidos de quem está na sessão que ainda não foram recusados. Para na
 * primeira falta de conexão (tenta de novo quando o servidor voltar). Seguro chamar várias vezes.
 */
export function enviarPedidosGuardados(usuarioId: number, retorno: Retorno): Promise<void> {
  envio ??= (async () => {
    try {
      for (;;) {
        const proximo = pedidos.find((p) => p.usuarioId === usuarioId && !p.recusa);
        if (!proximo) return;
        try {
          const pedido = await api<Pedido>('/pedidos', { metodo: 'POST', corpo: proximo.corpo });
          tirarPedido(proximo.chave);
          retorno.aoEnviar(pedido);
        } catch (e) {
          const erro = e as ErroDaApi;
          // Sem conexão, sessão vencida ou erro do servidor: tenta de novo depois.
          if (erro.semConexao || erro.status === 401 || erro.status >= 500) return;
          const recusado = {
            ...proximo,
            recusa: { codigo: erro.codigo, mensagem: erro.message },
          };
          gravar(pedidos.map((p) => (p.chave === proximo.chave ? recusado : p)));
          retorno.aoRecusar(recusado);
        }
      }
    } finally {
      envio = null;
    }
  })();
  return envio;
}

function assinar(fn: () => void) {
  ouvintes.add(fn);
  return () => void ouvintes.delete(fn);
}

export function usePedidosGuardados(): PedidoGuardado[] {
  return useSyncExternalStore(assinar, pedidosGuardados, pedidosGuardados);
}
