import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Cópia do cardápio no aparelho (etapa 17, docs/abrir-sem-esperar.md).
 *
 * Guarda a última resposta das consultas que o Novo pedido precisa para abrir: produtos e
 * categorias ativos, formas de pagamento e o Pix da loja. Ao abrir o sistema, a tela usa a cópia
 * na hora, mesmo com a API ainda acordando; quando ela responde, a leitura nova substitui.
 * Pedidos, fila e relatórios nunca entram aqui: mudam o tempo todo.
 *
 * O preço da cópia é só o que aparece na tela. Quem confere é o servidor ao gravar o pedido
 * (PRECO_ALTERADO), como antes (PRD 7 e D-18).
 */

const CHAVE = 'patotinha.copia';

export const CONSULTAS_COPIADAS: QueryKey[] = [
  ['produtos', 'ativos'],
  ['categorias', 'ativas'],
  ['formas-pagamento'],
  ['pix'],
];

interface Copia {
  [chave: string]: { dados: unknown; salvaEm: number };
}

const textoDa = (chave: QueryKey) => JSON.stringify(chave);
const copiada = (chave: QueryKey) => CONSULTAS_COPIADAS.some((c) => textoDa(c) === textoDa(chave));

function ler(): Copia {
  try {
    return (JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Copia) ?? {};
  } catch {
    return {};
  }
}

/** Põe a cópia no React Query antes da primeira tela; e passa a guardar cada leitura nova. */
export function ligarCopiaLocal(queryClient: QueryClient) {
  const copia = ler();
  for (const chave of CONSULTAS_COPIADAS) {
    const salva = copia[textoDa(chave)];
    // updatedAt 0: a cópia é sempre "velha" e a tela relê assim que o servidor responder.
    if (salva) queryClient.setQueryData(chave, salva.dados, { updatedAt: 0 });
  }

  return queryClient.getQueryCache().subscribe((evento) => {
    if (evento.type !== 'updated' || evento.action.type !== 'success') return;
    const { queryKey, state } = evento.query;
    if (!copiada(queryKey) || state.data === undefined) return;
    const atual = ler();
    atual[textoDa(queryKey)] = { dados: state.data, salvaEm: state.dataUpdatedAt };
    try {
      localStorage.setItem(CHAVE, JSON.stringify(atual));
    } catch {
      // Sem armazenamento: só não abre com o cardápio antes de o servidor responder.
    }
  });
}
