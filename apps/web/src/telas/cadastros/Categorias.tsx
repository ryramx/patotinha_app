import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combinaBusca, esquemaCategoria, LIMITES, type Categoria } from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import { useAvisos } from '../../componentes/Avisos';
import { Botao } from '../../componentes/Botao';
import { CampoTexto } from '../../componentes/Campos';
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

export function Categorias() {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('ativos');
  const [editando, setEditando] = useState<Categoria | 'novo' | null>(null);
  const [confirmar, setConfirmar] = useState<Categoria | null>(null);

  const categorias = useQuery({
    queryKey: ['categorias', 'todas'],
    queryFn: () => api<Categoria[]>('/categorias'),
  });

  const alternar = useMutation({
    mutationFn: (c: Categoria) =>
      api<Categoria>(`/categorias/${c.id}/status`, { metodo: 'PATCH', corpo: { ativo: !c.ativo } }),
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: ['categorias'] });
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
      avisos.sucesso(c.ativo ? t('sucesso.ativado', { nome: c.nome }) : `${c.nome} desativada`);
      setConfirmar(null);
    },
    onError: (e: ErroDaApi) => avisos.erro(e.message),
  });

  const lista = (categorias.data ?? []).filter(
    (c) => passaStatus(c.ativo, status) && (!busca.trim() || combinaBusca(c.nome, busca)),
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BarraCadastro
        busca={busca}
        aoBuscar={setBusca}
        status={status}
        aoMudarStatus={setStatus}
        rotuloNovo={t('cadastro.novaCategoria')}
        aoNovo={() => setEditando('novo')}
      />
      <div className="cartao overflow-x-auto">
        {categorias.isPending ? (
          <div className="p-4">
            <LinhasEsqueleto />
          </div>
        ) : lista.length === 0 ? (
          <Vazio texto="Nenhuma categoria com esses filtros" />
        ) : (
          <table className={classeTabela}>
            <thead className={classeCabecalho}>
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="py-3 pr-6 text-right font-semibold">Produtos ativos</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 pr-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className={classeLinha}>
                  <td className="px-4 font-bold">{c.nome}</td>
                  <td className="pr-6 text-right tabular-nums">{c.produtosAtivos}</td>
                  <td>
                    <EtiquetaAtivo ativo={c.ativo} />
                  </td>
                  <td className="pr-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Botao className="!min-h-10" onClick={() => setEditando(c)}>
                        {t('cadastro.editar')}
                      </Botao>
                      {c.ativo ? (
                        <Botao
                          variante="perigo"
                          className="!min-h-10"
                          onClick={() => setConfirmar(c)}
                        >
                          {t('cadastro.desativar')}
                        </Botao>
                      ) : (
                        <Botao className="!min-h-10" onClick={() => alternar.mutate(c)}>
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
        <FormularioCategoria
          categoria={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
      {confirmar && (
        <Confirmacao
          titulo={t('confirmacao.desativarCategoriaTitulo', { nome: confirmar.nome })}
          texto={
            confirmar.produtosAtivos > 0
              ? t('confirmacao.desativarCategoriaTexto', { quantidade: confirmar.produtosAtivos })
              : t('confirmacao.desativarCategoriaSemProdutos')
          }
          confirmar={t('confirmacao.desativar')}
          carregando={alternar.isPending}
          aoFechar={() => setConfirmar(null)}
          aoConfirmar={() => alternar.mutate(confirmar)}
        />
      )}
    </div>
  );
}

function FormularioCategoria({
  categoria,
  aoFechar,
}: {
  categoria: Categoria | null;
  aoFechar: () => void;
}) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const validar = () => {
    const r = esquemaCategoria.safeParse({ nome });
    const mensagem = r.success
      ? null
      : nome.trim()
        ? r.error.issues[0]!.message
        : 'Informe o nome da categoria';
    setErro(mensagem);
    return !mensagem;
  };

  const salvar = useMutation({
    mutationFn: () =>
      api<Categoria>(categoria ? `/categorias/${categoria.id}` : '/categorias', {
        metodo: categoria ? 'PUT' : 'POST',
        corpo: { nome: nome.trim() },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categorias'] });
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
      avisos.sucesso(t('sucesso.categoriaSalva'));
      aoFechar();
    },
    onError: (e: ErroDaApi) => {
      if (e.codigo === 'NOME_DUPLICADO' || e.status === 422) setErro(e.message);
      else avisos.erro(e.message);
      focarPrimeiroErro();
    },
  });

  return (
    <PainelFormulario
      titulo={categoria ? t('cadastro.editarCategoria') : t('cadastro.novaCategoria')}
      alterado={nome !== (categoria?.nome ?? '')}
      salvando={salvar.isPending}
      aoFechar={aoFechar}
      aoSalvar={() => (validar() ? salvar.mutate() : focarPrimeiroErro())}
    >
      <CampoTexto
        rotulo="Nome"
        value={nome}
        maxLength={LIMITES.categoriaNome.max}
        autoFocus
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => validar()}
        erro={erro}
      />
    </PainelFormulario>
  );
}
