import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CloudUpload, RefreshCw, TriangleAlert } from 'lucide-react';
import { formatarReais } from '@patotinha/shared';
import { conectadoDesde, useEstadoConexao } from '../api/conexao';
import {
  consultaCategoriasAtivas,
  consultaFormasPagamento,
  consultaPix,
  consultaProdutosAtivos,
} from '../api/cardapio';
import { useSessao } from '../auth/sessao';
import { useAvisos } from '../componentes/Avisos';
import { Botao } from '../componentes/Botao';
import { t } from '../textos';
import {
  enviarPedidosGuardados,
  tirarPedido,
  usePedidosGuardados,
  type PedidoGuardado,
} from '../telas/novo-pedido/filaPedidos';
import { abrirRascunho, temRascunho } from '../telas/novo-pedido/rascunho';

/**
 * Conexão com o servidor no cabeçalho e na faixa logo abaixo dele (etapa 17,
 * docs/abrir-sem-esperar.md). Também envia os pedidos guardados no aparelho quando o servidor
 * responde.
 */

/** Respostas rápidas não mostram nada: só depois disso a faixa "Conectando" aparece. */
const AVISAR_DEPOIS_MS = 2_500;
/** Passou disso: o texto muda para "o servidor não respondeu", mas continua tentando. */
const DEMORANDO_DEPOIS_MS = 150_000;
/** Pedido que o servidor não aceitou por erro dele (5xx): tenta de novo a cada tanto. */
const REENVIAR_A_CADA_MS = 20_000;

export type SituacaoConexao = 'conectado' | 'conferindo' | 'conectando' | 'demorando';

/** Estado da conexão para a tela: espera um pouco antes de avisar. */
export function useSituacaoConexao(): SituacaoConexao {
  const estado = useEstadoConexao();
  const [, setTique] = useState(0);
  useEffect(() => {
    if (estado === 'conectado') return;
    const ids = [AVISAR_DEPOIS_MS, DEMORANDO_DEPOIS_MS].map((ms) =>
      setTimeout(() => setTique((n) => n + 1), Math.max(0, conectadoDesde() + ms - Date.now())),
    );
    return () => ids.forEach(clearTimeout);
  }, [estado]);
  if (estado === 'conectado') return 'conectado';
  const passou = Date.now() - conectadoDesde();
  if (passou >= DEMORANDO_DEPOIS_MS) return 'demorando';
  return passou >= AVISAR_DEPOIS_MS ? 'conectando' : 'conferindo';
}

/** Ponto verde (online) ou amarelo (conectando) no cabeçalho. */
export function PontoConexao() {
  const situacao = useSituacaoConexao();
  const online = situacao === 'conectado' || situacao === 'conferindo';
  const rotulo = online ? t('menu.conectado') : t('menu.conectando');
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold ${online ? 'text-sucesso' : 'text-aviso'}`}
      title={rotulo}
      role="status"
      aria-label={rotulo}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? 'bg-sucesso' : 'animate-pulse bg-aviso'}`}
      />
      <span className="hidden xl:inline">{online ? 'Online' : t('conexao.curto')}</span>
    </span>
  );
}

function useEnvioDosGuardados(meus: PedidoGuardado[]) {
  const { usuario } = useSessao();
  const estado = useEstadoConexao();
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const pendentes = meus.filter((p) => !p.recusa).length;

  useEffect(() => {
    if (estado !== 'conectado' || !usuario || pendentes === 0) return;
    const enviar = () =>
      void enviarPedidosGuardados(usuario.id, {
        aoEnviar: (pedido) => {
          avisos.sucesso(
            t('sucesso.pedidoGuardadoEnviado', {
              numero: pedido.id,
              cliente: pedido.cliente ?? '',
            }),
          );
          void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
          void queryClient.invalidateQueries({ queryKey: ['inicio'] });
          void queryClient.invalidateQueries({ queryKey: ['fila'] });
          void queryClient.invalidateQueries({ queryKey: ['a-receber'] });
        },
        aoRecusar: (g) =>
          avisos.erro(t('erro.pedidoGuardadoRecusado', { cliente: g.corpo.cliente })),
      });
    enviar();
    const id = setInterval(enviar, REENVIAR_A_CADA_MS);
    return () => clearInterval(id);
  }, [estado, usuario, pendentes, avisos, queryClient]);
}

/**
 * Com o servidor conectado, quem registra pedidos já leva o cardápio para o aparelho, em qualquer
 * tela: sem isso, a cópia só existiria depois de abrir o Novo pedido uma vez com o servidor
 * acordado, e a primeira abertura sem servidor ficaria sem produtos.
 */
function useGuardarCardapio() {
  const { usuario, pode } = useSessao();
  const estado = useEstadoConexao();
  const queryClient = useQueryClient();
  const registra = !!usuario && pode('PEDIDOS_REGISTRAR');
  useEffect(() => {
    if (estado !== 'conectado' || !registra) return;
    for (const consulta of [
      consultaProdutosAtivos,
      consultaCategoriasAtivas,
      consultaFormasPagamento,
      consultaPix,
    ]) {
      void queryClient.prefetchQuery(consulta as Parameters<typeof queryClient.prefetchQuery>[0]);
    }
  }, [estado, registra, queryClient]);
}

/** Faixa abaixo do cabeçalho: conectando, pedidos guardados e pedidos recusados. */
export function FaixaConexao() {
  const { usuario, pode } = useSessao();
  const situacao = useSituacaoConexao();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const todos = usePedidosGuardados();
  const meus = todos.filter((p) => p.usuarioId === usuario?.id);
  useEnvioDosGuardados(meus);
  useGuardarCardapio();

  const guardados = meus.filter((p) => !p.recusa);
  const recusados = meus.filter((p) => p.recusa);
  const conectando = situacao === 'conectando' || situacao === 'demorando';
  if (!conectando && guardados.length === 0 && recusados.length === 0) return null;

  const abrir = (g: PedidoGuardado) => {
    if (temRascunho()) {
      avisos.aviso(t('conexao.termineOPedido'));
      navegar('/pedidos/novo');
      return;
    }
    tirarPedido(g.chave);
    abrirRascunho(g.rascunho);
    navegar('/pedidos/novo');
  };

  const quantos = (n: number) => (n === 1 ? t('conexao.umPedido') : t('conexao.pedidos', { n }));

  return (
    <div className="nao-imprimir shrink-0 border-b border-borda bg-aviso-fundo text-[14px] text-aviso">
      {(conectando || guardados.length > 0) && (
        <p
          role="status"
          className="flex items-start gap-2 px-3 py-2 font-semibold md:px-4 lg:px-6"
          data-testid="faixa-conexao"
        >
          {conectando ? (
            <RefreshCw
              size={16}
              className="mt-0.5 shrink-0 animate-spin [animation-duration:2s]"
              aria-hidden
            />
          ) : (
            <CloudUpload size={16} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span>
            {situacao === 'demorando'
              ? t('conexao.demorando')
              : conectando
                ? t('conexao.conectando')
                : t('conexao.enviando', { quantos: quantos(guardados.length) })}{' '}
            {conectando &&
              (guardados.length > 0
                ? t('conexao.guardados', { quantos: quantos(guardados.length) })
                : pode('PEDIDOS_REGISTRAR')
                  ? t('conexao.podeRegistrar')
                  : t('conexao.atualizaSozinho'))}
          </span>
        </p>
      )}
      {recusados.map((g) => (
        <div
          key={g.chave}
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-borda bg-erro-fundo px-3 py-2 text-erro md:px-4 lg:px-6"
        >
          <TriangleAlert size={16} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 font-semibold">
            {t('conexao.recusado', {
              cliente: g.corpo.cliente,
              total: formatarReais(g.totalCentavos),
              motivo: g.recusa!.mensagem,
            })}
          </span>
          <Botao variante="secundario" onClick={() => abrir(g)}>
            {t('conexao.abrirNoPedido')}
          </Botao>
        </div>
      ))}
    </div>
  );
}
