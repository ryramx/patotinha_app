import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import {
  combinaBusca,
  esquemaProduto,
  formatarDataHora,
  formatarReais,
  LIMITES,
  paraCentavos,
  type Categoria,
  type Produto,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import { useAvisos } from '../../componentes/Avisos';
import { Botao } from '../../componentes/Botao';
import { CampoDinheiro, CampoTexto, MensagemErro } from '../../componentes/Campos';
import { EtiquetaAtivo, LinhasEsqueleto, Vazio } from '../../componentes/Diversos';
import { Confirmacao } from '../../componentes/Janela';
import { t } from '../../textos';
import {
  BarraCadastro,
  classeCabecalho,
  classeLinha,
  classeTabela,
  focarPrimeiroErro,
  PainelFormulario,
  passaStatus,
  type FiltroStatus,
} from './Molde';

export function Produtos() {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('ativos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);
  const [confirmar, setConfirmar] = useState<Produto | null>(null);
  const [destaque, setDestaque] = useState<number | null>(null);

  const produtos = useQuery({
    queryKey: ['produtos', 'todos'],
    queryFn: () => api<Produto[]>('/produtos'),
  });
  const categorias = useQuery({
    queryKey: ['categorias', 'todas'],
    queryFn: () => api<Categoria[]>('/categorias'),
  });

  const alternar = useMutation({
    mutationFn: (p: Produto) =>
      api<Produto>(`/produtos/${p.id}/status`, { metodo: 'PATCH', corpo: { ativo: !p.ativo } }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
      void queryClient.invalidateQueries({ queryKey: ['categorias'] });
      avisos.sucesso(
        p.ativo
          ? t('sucesso.ativado', { nome: p.nome })
          : t('sucesso.desativado', { nome: p.nome }),
      );
      setConfirmar(null);
    },
    onError: (e: ErroDaApi) => {
      avisos.erro(e.message);
      setConfirmar(null);
    },
  });

  const lista = (produtos.data ?? []).filter(
    (p) =>
      passaStatus(p.ativo, status) &&
      (!categoriaFiltro || String(p.categoria.id) === categoriaFiltro) &&
      (!busca.trim() || combinaBusca(p.nome, busca)),
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BarraCadastro
        busca={busca}
        aoBuscar={setBusca}
        status={status}
        aoMudarStatus={setStatus}
        rotuloNovo={t('cadastro.novoProduto')}
        aoNovo={() => setEditando('novo')}
        filtrosExtras={
          <label className="flex flex-col">
            <span className="rotulo">Categoria</span>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="h-12 rounded-padrao border border-borda bg-superficie px-2"
            >
              <option value="">{t('cadastro.todos')}</option>
              {categorias.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="cartao overflow-x-auto">
        {produtos.isPending ? (
          <div className="p-4">
            <LinhasEsqueleto />
          </div>
        ) : lista.length === 0 ? (
          <Vazio
            texto={
              produtos.data?.length ? 'Nenhum produto com esses filtros' : t('dica.semProdutos')
            }
          />
        ) : (
          <table className={classeTabela}>
            <thead className={classeCabecalho}>
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="py-3 font-semibold">Categoria</th>
                <th className="py-3 pr-6 text-right font-semibold">Preço</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 font-semibold">Atualizado em</th>
                <th className="py-3 pr-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr
                  key={p.id}
                  className={`${classeLinha} ${destaque === p.id ? 'anim-item-novo' : ''}`}
                >
                  <td className="px-4">
                    <button
                      type="button"
                      className="text-left font-bold hover:underline"
                      onClick={() => setEditando(p)}
                    >
                      {p.nome}
                    </button>
                  </td>
                  <td>
                    {p.categoria.nome}{' '}
                    {!p.categoria.ativo && <span className="legenda">{t('cadastro.inativa')}</span>}
                  </td>
                  <td className="pr-6 text-right tabular-nums">{formatarReais(p.preco)}</td>
                  <td>
                    <EtiquetaAtivo ativo={p.ativo} />
                  </td>
                  <td className="tabular-nums">{formatarDataHora(p.atualizadoEm)}</td>
                  <td className="pr-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Botao className="!min-h-10" onClick={() => setEditando(p)}>
                        {t('cadastro.editar')}
                      </Botao>
                      {p.ativo ? (
                        <Botao
                          variante="perigo"
                          className="!min-h-10"
                          onClick={() => setConfirmar(p)}
                        >
                          {t('cadastro.desativar')}
                        </Botao>
                      ) : (
                        <Botao
                          className="!min-h-10"
                          carregando={alternar.isPending && alternar.variables?.id === p.id}
                          onClick={() => alternar.mutate(p)}
                        >
                          {t('cadastro.ativar')}
                        </Botao>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <FormularioProduto
          produto={editando === 'novo' ? null : editando}
          categorias={(categorias.data ?? []).filter(
            (c) => c.ativo || (editando !== 'novo' && c.id === editando.categoria.id),
          )}
          aoFechar={() => setEditando(null)}
          aoSalvar={(p) => {
            setEditando(null);
            setDestaque(p.id);
            setTimeout(() => setDestaque(null), 2000);
          }}
        />
      )}
      {confirmar && (
        <Confirmacao
          titulo={t('confirmacao.desativarProdutoTitulo', { nome: confirmar.nome })}
          texto={t('confirmacao.desativarProdutoTexto')}
          confirmar={t('confirmacao.desativar')}
          carregando={alternar.isPending}
          aoFechar={() => setConfirmar(null)}
          aoConfirmar={() => alternar.mutate(confirmar)}
        />
      )}
    </div>
  );
}

function FormularioProduto({
  produto,
  categorias,
  aoFechar,
  aoSalvar,
}: {
  produto: Produto | null;
  categorias: Categoria[];
  aoFechar: () => void;
  aoSalvar: (p: Produto) => void;
}) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const precoInicial = produto ? paraCentavos(produto.preco) : null;
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [categoriaId, setCategoriaId] = useState(produto ? String(produto.categoria.id) : '');
  const [preco, setPreco] = useState<number | null>(precoInicial);
  const [ingredientes, setIngredientes] = useState(produto?.ingredientes ?? '');
  const [erros, setErros] = useState<Record<string, string>>({});

  const alterado =
    nome !== (produto?.nome ?? '') ||
    categoriaId !== (produto ? String(produto.categoria.id) : '') ||
    preco !== precoInicial ||
    ingredientes !== (produto?.ingredientes ?? '');

  const validar = (campo?: string) => {
    const resultado = esquemaProduto.safeParse({
      nome,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      preco: preco === null ? '' : (preco / 100).toFixed(2),
      ingredientes,
    });
    const novos: Record<string, string> = {};
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        const chave = String(issue.path[0]);
        novos[chave] ??=
          chave === 'preco'
            ? preco === null
              ? 'Informe o preço'
              : issue.message
            : chave === 'categoriaId'
              ? 'Escolha uma categoria'
              : issue.message;
      }
    }
    if (!nome.trim()) novos.nome = 'Informe o nome do produto';
    setErros((atual) => (campo ? { ...atual, [campo]: novos[campo] ?? '' } : novos));
    return Object.values(novos).filter(Boolean).length === 0;
  };

  const salvar = useMutation({
    mutationFn: () =>
      api<Produto>(produto ? `/produtos/${produto.id}` : '/produtos', {
        metodo: produto ? 'PUT' : 'POST',
        corpo: {
          nome: nome.trim(),
          categoriaId: Number(categoriaId),
          preco: ((preco ?? 0) / 100).toFixed(2),
          ingredientes: ingredientes.trim() || null,
        },
      }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
      void queryClient.invalidateQueries({ queryKey: ['categorias'] });
      avisos.sucesso(t('sucesso.produtoSalvo'));
      aoSalvar(p);
    },
    onError: (e: ErroDaApi) => {
      if (e.codigo === 'NOME_DUPLICADO') setErros({ nome: e.message });
      else if (e.codigo === 'PRECO_INVALIDO') setErros({ preco: e.message });
      else if (e.codigo === 'CATEGORIA_INATIVA' || e.codigo === 'CATEGORIA_NAO_ENCONTRADA')
        setErros({ categoriaId: e.message });
      else avisos.erro(e.message);
      focarPrimeiroErro();
    },
  });

  return (
    <PainelFormulario
      titulo={produto ? t('cadastro.editarProduto') : t('cadastro.novoProduto')}
      alterado={alterado}
      salvando={salvar.isPending}
      aoFechar={aoFechar}
      aoSalvar={() => (validar() ? salvar.mutate() : focarPrimeiroErro())}
    >
      <CampoTexto
        rotulo="Nome"
        value={nome}
        maxLength={LIMITES.produtoNome.max}
        autoFocus
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => validar('nome')}
        erro={erros.nome || null}
      />
      <div>
        <label htmlFor="categoria" className="rotulo mb-1 block">
          Categoria
        </label>
        <select
          id="categoria"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          onBlur={() => validar('categoriaId')}
          aria-invalid={erros.categoriaId ? true : undefined}
          className={`h-12 w-full rounded-padrao border bg-superficie px-3 ${erros.categoriaId ? 'border-2 border-erro' : 'border-borda'}`}
        >
          <option value="">Escolha…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {erros.categoriaId && <MensagemErro texto={erros.categoriaId} />}
      </div>
      <CampoDinheiro
        rotulo="Preço"
        centavos={preco}
        aoMudar={setPreco}
        onBlur={() => validar('preco')}
        erro={erros.preco || null}
      />
      <div>
        <label htmlFor="ingredientes" className="rotulo mb-1 block">
          Ingredientes <span className="legenda">(opcional)</span>
        </label>
        <textarea
          id="ingredientes"
          value={ingredientes}
          rows={3}
          maxLength={LIMITES.ingredientes}
          placeholder="Ex.: carne moída, azeitona e ovo"
          onChange={(e) => setIngredientes(e.target.value)}
          onBlur={() => validar('ingredientes')}
          aria-invalid={erros.ingredientes ? true : undefined}
          className={`w-full rounded-padrao border bg-superficie px-3 py-2 text-[16px] outline-none transition-colors hover:border-texto focus:border-2 focus:border-acao ${erros.ingredientes ? 'border-2 border-erro' : 'border-borda'}`}
        />
        {erros.ingredientes ? (
          <MensagemErro texto={erros.ingredientes} />
        ) : (
          <p className="legenda mt-1">Aparece abaixo do nome na tela de novo pedido.</p>
        )}
      </div>
      {produto && preco !== precoInicial && (
        <p className="flex items-start gap-2 rounded-padrao bg-aviso-fundo px-3 py-2 font-semibold text-aviso">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden /> {t('dica.avisoPreco')}
        </p>
      )}
      {preco === 0 && (
        <p className="flex items-start gap-2 rounded-padrao bg-aviso-fundo px-3 py-2 font-semibold text-aviso">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden />{' '}
          {t('dica.avisoPrecoZero')}
        </p>
      )}
      {produto && (
        <p className="legenda">
          {t('cadastro.criadoEm', { data: formatarDataHora(produto.criadoEm) })} ·{' '}
          {t('cadastro.atualizadoEm', { data: formatarDataHora(produto.atualizadoEm) })}
        </p>
      )}
    </PainelFormulario>
  );
}
