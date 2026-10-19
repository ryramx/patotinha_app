import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import {
  combinaBusca,
  esquemaTelefone,
  formatarReais,
  formatarTelefone,
  LIMITES,
  paraCentavos,
  type Categoria,
  type CodigoPagamento,
  type FormaPagamento,
  type Pedido,
  type Produto,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import { useSessao } from '../../auth/sessao';
import { useAvisos } from '../../componentes/Avisos';
import { Botao } from '../../componentes/Botao';
import { Confirmacao } from '../../componentes/Janela';
import { Esqueleto, Vazio } from '../../componentes/Diversos';
import { t } from '../../textos';
import {
  apagarRascunho,
  lerRascunho,
  marcarRascunhoRetomado,
  novaChave,
  rascunhoJaRetomado,
  rascunhoVazio,
  salvarRascunho,
  type ItemRascunho,
  type Rascunho,
} from './rascunho';
import { PainelPedido, type Problema } from './PainelPedido';

const pedidoParaDepois = (p: Pedido) => p.status === 'ABERTO';

export function NovoPedido() {
  const { pode } = useSessao();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const queryClient = useQueryClient();

  const produtos = useQuery({
    queryKey: ['produtos', 'ativos'],
    queryFn: () => api<Produto[]>('/produtos?ativo=true'),
  });
  const categorias = useQuery({
    queryKey: ['categorias', 'ativas'],
    queryFn: () => api<Categoria[]>('/categorias?ativo=true'),
  });
  const formas = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: () => api<FormaPagamento[]>('/formas-pagamento'),
    staleTime: Infinity,
  });

  // Rascunho: restaura sozinho se já foi retomado nesta aba; senão pergunta (UC-02).
  const [rascunho, setRascunho] = useState<Rascunho>(() => {
    const salvo = lerRascunho();
    return salvo && rascunhoJaRetomado() ? salvo : rascunhoVazio();
  });
  const [ofertaRascunho, setOfertaRascunho] = useState<Rascunho | null>(() => {
    const salvo = lerRascunho();
    return salvo && salvo.itens.length > 0 && !rascunhoJaRetomado() ? salvo : null;
  });
  useEffect(() => {
    if (ofertaRascunho) return;
    salvarRascunho(rascunho);
    marcarRascunhoRetomado(true);
  }, [rascunho, ofertaRascunho]);

  const [categoriaSel, setCategoriaSel] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [piscando, setPiscando] = useState<{
    produtoId: number;
    novo: boolean;
    vez: number;
  } | null>(null);
  const [problemas, setProblemas] = useState<Map<number, Problema>>(new Map());
  const [enviando, setEnviando] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false); // celular
  const desfazer = useRef<{
    item: ItemRascunho;
    indice: number;
    ate: number;
    aviso: number;
  } | null>(null);
  const refBusca = useRef<HTMLInputElement>(null);
  const refCliente = useRef<HTMLInputElement>(null);
  const toqueCartao = useRef<number | null>(null);

  const listaCategorias = useMemo(() => categorias.data ?? [], [categorias.data]);
  const categoriaAtual = categoriaSel ?? listaCategorias[0]?.id ?? null;
  const listaProdutos = useMemo(() => produtos.data ?? [], [produtos.data]);
  const visiveis = useMemo(() => {
    if (busca.trim()) return listaProdutos.filter((p) => combinaBusca(p.nome, busca));
    return listaProdutos.filter((p) => p.categoria.id === categoriaAtual);
  }, [listaProdutos, busca, categoriaAtual]);

  const atualizar = useCallback((fn: (r: Rascunho) => Rascunho) => {
    setRascunho((r) => fn(r));
    setSemConexao(false);
  }, []);

  const adicionar = useCallback(
    (produto: Produto) => {
      const preco = paraCentavos(produto.preco);
      let novo = false;
      let estourou = false;
      atualizar((r) => {
        const existente = r.itens.find((i) => i.produtoId === produto.id);
        if (existente) {
          if (existente.quantidade >= LIMITES.quantidadeMax) {
            estourou = true;
            return r;
          }
          return {
            ...r,
            itens: r.itens.map((i) =>
              i.produtoId === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i,
            ),
          };
        }
        novo = true;
        return {
          ...r,
          itens: [
            ...r.itens,
            { produtoId: produto.id, nome: produto.nome, precoCentavos: preco, quantidade: 1 },
          ],
        };
      });
      if (estourou) {
        avisos.aviso(t('pedido.quantidadeInvalida', { max: LIMITES.quantidadeMax }));
        return;
      }
      setPiscando({ produtoId: produto.id, novo, vez: Date.now() });
      toqueCartao.current = produto.id;
    },
    [atualizar, avisos],
  );

  const remover = useCallback(
    (produtoId: number) => {
      const indice = rascunho.itens.findIndex((i) => i.produtoId === produtoId);
      const item = rascunho.itens[indice];
      if (!item) return;
      atualizar((r) => ({ ...r, itens: r.itens.filter((i) => i.produtoId !== produtoId) }));
      setProblemas((p) => {
        const n = new Map(p);
        n.delete(produtoId);
        return n;
      });
      if (desfazer.current) avisos.fechar(desfazer.current.aviso);
      const restaurar = () => {
        const d = desfazer.current;
        if (!d || Date.now() > d.ate) return;
        desfazer.current = null;
        atualizar((r) => {
          if (r.itens.some((i) => i.produtoId === d.item.produtoId)) return r;
          const itens = [...r.itens];
          itens.splice(Math.min(d.indice, itens.length), 0, d.item);
          return { ...r, itens };
        });
      };
      const aviso = avisos.sucesso(t('sucesso.itemRemovido', { nome: item.nome }), {
        duracaoMs: 5000,
        acao: { rotulo: t('pedido.desfazer'), executar: restaurar },
      });
      desfazer.current = { item, indice, ate: Date.now() + 5000, aviso };
    },
    [rascunho.itens, atualizar, avisos],
  );

  const mudarQuantidade = useCallback(
    (produtoId: number, quantidade: number) => {
      if (quantidade <= 0) return remover(produtoId);
      if (quantidade > LIMITES.quantidadeMax || !Number.isInteger(quantidade)) {
        avisos.aviso(t('pedido.quantidadeInvalida', { max: LIMITES.quantidadeMax }));
        return;
      }
      atualizar((r) => ({
        ...r,
        itens: r.itens.map((i) => (i.produtoId === produtoId ? { ...i, quantidade } : i)),
      }));
      setPiscando({ produtoId, novo: false, vez: Date.now() });
    },
    [atualizar, remover, avisos],
  );

  const escolherForma = useCallback(
    (forma: CodigoPagamento) =>
      // Trocar de Dinheiro para outra forma apaga o valor recebido.
      atualizar((r) => ({
        ...r,
        forma,
        recebidoCentavos: forma === 'DINHEIRO' ? r.recebidoCentavos : null,
      })),
    [atualizar],
  );

  const totalCentavos = rascunho.itens.reduce((s, i) => s + i.quantidade * i.precoCentavos, 0);
  const faltaRecebido =
    rascunho.forma === 'DINHEIRO' &&
    rascunho.recebidoCentavos !== null &&
    rascunho.recebidoCentavos < totalCentavos;
  const temIndisponivel = [...problemas.values()].some((p) => p.tipo === 'indisponivel');
  const erroTelefone =
    rascunho.telefone && !esquemaTelefone.safeParse(rascunho.telefone).success
      ? t('pedido.telefoneInvalido')
      : null;
  // O que falta para mandar o pedido, pagando agora ou depois.
  const dicaBase =
    rascunho.itens.length === 0
      ? t('dica.semItens')
      : !rascunho.cliente.trim()
        ? t('dica.semCliente')
        : erroTelefone
          ? erroTelefone
          : temIndisponivel
            ? t('pedido.indisponivelLinha')
            : null;
  const dicaFinalizar =
    dicaBase ??
    (!rascunho.forma
      ? t('dica.semPagamento')
      : faltaRecebido
        ? t('pedido.faltam', {
            valor: formatarReais(totalCentavos - rascunho.recebidoCentavos!),
          })
        : null);

  // Pagar depois (etapa 15): o pedido vai para a cozinha e o cliente paga no fim.
  const finalizar = useCallback(
    async (pagarDepois = false) => {
      if (enviando) return;
      if (rascunho.itens.length > 0 && !rascunho.cliente.trim()) {
        // Sem nome não há como chamar o cliente: leva o cursor até o campo.
        refCliente.current?.focus();
        avisos.aviso(t('dica.semCliente'));
        return;
      }
      if (pagarDepois ? dicaBase : dicaFinalizar) return;
      setEnviando(true);
      try {
        const pedido = await api<Pedido>('/pedidos', {
          metodo: 'POST',
          corpo: {
            chaveIdempotencia: rascunho.chaveIdempotencia,
            cliente: rascunho.cliente.trim(),
            telefone: rascunho.telefone || undefined,
            ...(pagarDepois
              ? { pagarDepois: true }
              : {
                  formaPagamento: rascunho.forma,
                  valorRecebido:
                    rascunho.forma === 'DINHEIRO' && rascunho.recebidoCentavos !== null
                      ? (rascunho.recebidoCentavos / 100).toFixed(2)
                      : null,
                }),
            itens: rascunho.itens.map((i) => ({
              produtoId: i.produtoId,
              quantidade: i.quantidade,
              precoExibido: (i.precoCentavos / 100).toFixed(2),
            })),
          },
        });
        avisos.sucesso(
          t(pedidoParaDepois(pedido) ? 'sucesso.pedidoPagarDepois' : 'sucesso.pedidoGravado', {
            numero: pedido.id,
            cliente: pedido.cliente ?? '',
            total: formatarReais(pedido.total),
          }),
        );
        setRascunho(rascunhoVazio());
        apagarRascunho();
        setProblemas(new Map());
        setSemConexao(false);
        setPainelAberto(false);
        void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
        void queryClient.invalidateQueries({ queryKey: ['inicio'] });
        void queryClient.invalidateQueries({ queryKey: ['fila'] });
        void queryClient.invalidateQueries({ queryKey: ['a-receber'] });
      } catch (e) {
        const erro = e as ErroDaApi;
        if (erro.semConexao) {
          // O rascunho e a mesma chave continuam: tentar de novo não duplica o pedido.
          setSemConexao(true);
          avisos.erro(t('erro.semConexaoFinalizar'));
        } else if (erro.codigo === 'PRECO_ALTERADO') {
          const lista = erro.detalhes as {
            produtoId: number;
            nome: string;
            precoExibido: string;
            precoAtual: string;
          }[];
          setProblemas((p) => {
            const n = new Map(p);
            for (const d of lista) {
              n.set(d.produtoId, {
                tipo: 'preco',
                de: paraCentavos(d.precoExibido),
                para: paraCentavos(d.precoAtual),
              });
            }
            return n;
          });
          atualizar((r) => ({
            ...r,
            itens: r.itens.map((i) => {
              const d = lista.find((x) => x.produtoId === i.produtoId);
              return d ? { ...i, precoCentavos: paraCentavos(d.precoAtual) } : i;
            }),
          }));
          const primeiro = lista[0]!;
          avisos.aviso(
            t('erro.precoMudou', {
              nome: primeiro.nome,
              de: formatarReais(primeiro.precoExibido),
              para: formatarReais(primeiro.precoAtual),
            }),
          );
          void queryClient.invalidateQueries({ queryKey: ['produtos'] });
        } else if (erro.codigo === 'PRODUTO_INATIVO' || erro.codigo === 'PRODUTO_NAO_ENCONTRADO') {
          const lista = (erro.detalhes as { produtoId: number; nome?: string }[]) ?? [];
          setProblemas((p) => {
            const n = new Map(p);
            for (const d of lista) n.set(d.produtoId, { tipo: 'indisponivel' });
            return n;
          });
          const nome =
            lista[0]?.nome ??
            rascunho.itens.find((i) => i.produtoId === lista[0]?.produtoId)?.nome ??
            '';
          avisos.erro(t('erro.produtoIndisponivel', { nome }));
          void queryClient.invalidateQueries({ queryKey: ['produtos'] });
        } else if (erro.status !== 401) {
          avisos.erro(erro.message);
        }
      } finally {
        setEnviando(false);
      }
    },
    [dicaBase, dicaFinalizar, enviando, rascunho, avisos, queryClient, atualizar],
  );

  // Preço confirmado de novo: ao mexer no item com aviso de preço, o aviso some.
  const confirmarPreco = useCallback((produtoId: number) => {
    setProblemas((p) => {
      if (p.get(produtoId)?.tipo !== 'preco') return p;
      const n = new Map(p);
      n.delete(produtoId);
      return n;
    });
  }, []);

  // Atalhos da tela: "/" busca, F2 a F5 pagamento, Ctrl+Enter finaliza, Ctrl+Z desfaz.
  useEffect(() => {
    const tratar = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const alvo = e.target as HTMLElement;
      const digitando = alvo.closest('input, textarea, select');
      if (e.key === '/' && !digitando) {
        e.preventDefault();
        refBusca.current?.focus();
      }
      const mapa: Record<string, CodigoPagamento> = {
        F2: 'DINHEIRO',
        F3: 'PIX',
        F4: 'DEBITO',
        F5: 'CREDITO',
      };
      if (mapa[e.key] && rascunho.itens.length) {
        e.preventDefault();
        escolherForma(mapa[e.key]!);
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        void finalizar();
      }
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && !digitando && desfazer.current) {
        e.preventDefault();
        const d = desfazer.current;
        if (Date.now() <= d.ate) {
          avisos.fechar(d.aviso);
          desfazer.current = null;
          atualizar((r) => {
            const itens = [...r.itens];
            itens.splice(Math.min(d.indice, itens.length), 0, d.item);
            return { ...r, itens };
          });
        }
      }
    };
    window.addEventListener('keydown', tratar);
    return () => window.removeEventListener('keydown', tratar);
  }, [rascunho.itens.length, escolherForma, finalizar, avisos, atualizar]);

  const carregando = produtos.isPending || categorias.isPending;
  const erroCarga = produtos.isError || categorias.isError;
  const quantidades = new Map(rascunho.itens.map((i) => [i.produtoId, i.quantidade]));

  const painel = (
    <PainelPedido
      rascunho={rascunho}
      formas={formas.data ?? []}
      totalCentavos={totalCentavos}
      problemas={problemas}
      piscando={piscando}
      enviando={enviando}
      semConexao={semConexao}
      dicaFinalizar={dicaFinalizar}
      podePagarDepois={!dicaBase}
      refCliente={refCliente}
      erroTelefone={erroTelefone}
      aoMudarCliente={(cliente) =>
        // Trocou o nome depois de escolher uma sugestão: o telefone dela não vale mais.
        atualizar((r) => ({
          ...r,
          cliente,
          telefone: r.telefoneDoCadastro ? '' : r.telefone,
          telefoneDoCadastro: false,
        }))
      }
      aoMudarTelefone={(telefone) =>
        atualizar((r) => ({ ...r, telefone, telefoneDoCadastro: false }))
      }
      aoEscolherCliente={(c) =>
        atualizar((r) => ({
          ...r,
          cliente: c.nome,
          telefone: c.telefone
            ? formatarTelefone(c.telefone)
            : r.telefoneDoCadastro
              ? ''
              : r.telefone,
          telefoneDoCadastro: c.telefone !== null,
        }))
      }
      aoMudarQuantidade={(id, q) => {
        confirmarPreco(id);
        mudarQuantidade(id, q);
      }}
      aoRemover={remover}
      aoEscolherForma={escolherForma}
      aoMudarRecebido={(c) => atualizar((r) => ({ ...r, recebidoCentavos: c }))}
      aoFinalizar={() => void finalizar()}
      aoPagarDepois={() => void finalizar(true)}
      aoLimpar={() => setConfirmarLimpar(true)}
      aoFecharCelular={() => setPainelAberto(false)}
    />
  );

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:flex-row md:p-6">
      {/* Produtos (cerca de 62%) */}
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col md:basis-[62%]"
        aria-label="Produtos"
      >
        <div className="relative">
          <Search
            size={20}
            className="pointer-events-none absolute left-4 top-3.5 text-texto-suave"
            aria-hidden
          />
          <input
            ref={refBusca}
            type="search"
            value={busca}
            placeholder={`${t('pedido.buscar')}  ( / )`}
            aria-label={t('pedido.buscar')}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setBusca('');
              }
              if (e.key === 'Enter' && busca.trim() && visiveis[0]) {
                e.preventDefault();
                adicionar(visiveis[0]);
                setBusca('');
              }
            }}
            className="h-12 w-full rounded-padrao border border-borda bg-superficie pl-11 pr-10 outline-none hover:border-texto-suave focus:border-2 focus:border-moldura"
          />
          {busca && (
            <button
              type="button"
              aria-label={t('pedido.limparBusca')}
              onClick={() => setBusca('')}
              className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-texto-suave hover:text-texto"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Categorias"
          className={`mt-4 flex shrink-0 gap-1 self-start overflow-x-auto rounded-[14px] bg-creme-escuro p-1 transition-opacity max-md:self-stretch ${busca.trim() ? 'opacity-40' : ''}`}
        >
          {carregando
            ? [1, 2, 3, 4].map((i) => <Esqueleto key={i} className="h-11 w-28 shrink-0" />)
            : listaCategorias.map((c, indice) => {
                const sel = c.id === categoriaAtual;
                return (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={sel}
                    tabIndex={sel ? 0 : -1}
                    onClick={() => {
                      setCategoriaSel(c.id);
                      setBusca('');
                    }}
                    onKeyDown={(e) => {
                      const alvo =
                        e.key === 'ArrowRight'
                          ? indice + 1
                          : e.key === 'ArrowLeft'
                            ? indice - 1
                            : null;
                      if (alvo === null) return;
                      e.preventDefault();
                      const proxima =
                        listaCategorias[(alvo + listaCategorias.length) % listaCategorias.length]!;
                      setCategoriaSel(proxima.id);
                      (
                        e.currentTarget.parentElement?.children[
                          (alvo + listaCategorias.length) % listaCategorias.length
                        ] as HTMLElement | undefined
                      )?.focus();
                    }}
                    className={`h-11 shrink-0 rounded-[10px] px-5 text-[15px] font-bold transition-colors max-md:flex-1 ${
                      sel
                        ? 'bg-aba-sel text-texto-aba-sel shadow-padrao'
                        : 'text-texto-suave hover:text-texto'
                    }`}
                  >
                    {c.nome}
                  </button>
                );
              })}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-24 md:pb-1" role="tabpanel">
          {carregando ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Esqueleto key={i} className="h-32" />
              ))}
            </div>
          ) : erroCarga ? (
            <div
              className="flex flex-col items-start gap-3 rounded-padrao bg-erro-fundo p-4 text-erro"
              role="alert"
            >
              <p className="font-semibold">{t('erro.semConexaoCarregar')}</p>
              <Botao
                onClick={() => {
                  void produtos.refetch();
                  void categorias.refetch();
                }}
              >
                {t('pedido.tentarDeNovo')}
              </Botao>
            </div>
          ) : listaProdutos.length === 0 ? (
            <Vazio texto={t('dica.semProdutos')}>
              {pode('CARDAPIO') && (
                <Botao variante="principal" onClick={() => navegar('/produtos')}>
                  {t('pedido.cadastrarProdutos')}
                </Botao>
              )}
            </Vazio>
          ) : visiveis.length === 0 && busca.trim() ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-texto-suave">{t('dica.buscaVazia', { busca: busca.trim() })}</p>
              <Botao onClick={() => setBusca('')}>{t('pedido.limparBusca')}</Botao>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {visiveis.map((p) => {
                const qtd = quantidades.get(p.id);
                return (
                  <button
                    key={
                      p.id === toqueCartao.current && piscando ? `${p.id}-${piscando.vez}` : p.id
                    }
                    type="button"
                    title={p.ingredientes ? `${p.nome}: ${p.ingredientes}` : p.nome}
                    onClick={() => adicionar(p)}
                    className={`botao-produto relative flex min-h-28 flex-col items-stretch justify-between gap-2 rounded-grande bg-superficie p-4 text-left transition-colors ${
                      qtd
                        ? 'border-2 border-moldura shadow-padrao'
                        : 'border border-borda hover:border-moldura'
                    } ${p.id === toqueCartao.current && piscando ? 'anim-toque' : ''}`}
                  >
                    <span className="flex flex-col gap-1 pr-7">
                      <span className="line-clamp-2 text-[15px] font-bold leading-5">{p.nome}</span>
                      {p.ingredientes && (
                        <span className="line-clamp-2 text-[12.5px] leading-[17px] text-texto-suave">
                          {p.ingredientes}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between">
                      <span className="preco text-[18px] font-extrabold">
                        {formatarReais(p.preco)}
                      </span>
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-moldura/12 text-moldura"
                        aria-hidden
                      >
                        <Plus size={18} strokeWidth={2.5} />
                      </span>
                    </span>
                    {qtd ? (
                      <span
                        className="absolute right-3 top-3 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-moldura px-1.5 text-[13px] font-extrabold text-sobre-moldura"
                        aria-label={`${qtd} no pedido`}
                      >
                        {qtd}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Painel do pedido: sempre visível no computador e tablet; barra fixa no celular. */}
      <section
        aria-label={t('pedido.titulo')}
        className={`${
          painelAberto ? 'fixed inset-0 top-16 z-20 flex bg-fundo p-3' : 'hidden'
        } min-h-0 flex-col md:static md:flex md:w-[38%] md:min-w-[360px] md:max-w-[440px] md:p-0`}
      >
        {painel}
      </section>
      {!painelAberto && (
        <div className="fixed inset-x-3 bottom-[calc(var(--altura-abas-celular)+12px)] z-10 md:hidden">
          <button
            type="button"
            onClick={() => setPainelAberto(true)}
            className="flex h-15 w-full items-center gap-3 rounded-grande bg-acao px-4 text-texto-acao shadow-elevada active:translate-y-px"
          >
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-texto-acao px-2 text-[14px] font-extrabold text-acao">
              {rascunho.itens.length}
            </span>
            <span className="flex-1 text-left text-[16px] font-bold">{t('pedido.verPedido')}</span>
            <span className="font-titulo text-[24px] font-semibold tabular-nums">
              {formatarReais(totalCentavos)}
            </span>
          </button>
        </div>
      )}

      {ofertaRascunho && (
        <Confirmacao
          titulo={t('pedido.rascunhoTitulo')}
          texto={t('pedido.rascunhoTexto', { quantidade: ofertaRascunho.itens.length })}
          confirmar={t('pedido.continuar')}
          voltar={t('pedido.comecarNovo')}
          perigo={false}
          aoConfirmar={() => {
            setRascunho(ofertaRascunho);
            setOfertaRascunho(null);
            marcarRascunhoRetomado(true);
          }}
          aoFechar={() => {
            setRascunho({ ...rascunhoVazio(), chaveIdempotencia: novaChave() });
            apagarRascunho();
            setOfertaRascunho(null);
            marcarRascunhoRetomado(true);
          }}
        />
      )}
      {confirmarLimpar && (
        <Confirmacao
          titulo={t('confirmacao.limparTitulo')}
          texto={t('confirmacao.limparTexto', { quantidade: rascunho.itens.length })}
          confirmar={t('confirmacao.limparBotao')}
          aoFechar={() => setConfirmarLimpar(false)}
          aoConfirmar={() => {
            setConfirmarLimpar(false);
            setRascunho(rascunhoVazio());
            apagarRascunho();
            setProblemas(new Map());
            setSemConexao(false);
          }}
        />
      )}
    </div>
  );
}
