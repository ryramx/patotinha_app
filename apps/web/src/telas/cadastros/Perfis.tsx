import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react';
import {
  DESCRICAO_PERMISSOES,
  PERMISSOES,
  PERMISSOES_PADRAO,
  type PerfilAcesso,
  type Permissao,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import { useAvisos } from '../../componentes/Avisos';
import { Botao } from '../../componentes/Botao';
import { LinhasEsqueleto } from '../../componentes/Diversos';
import { t } from '../../textos';

/** Perfis e permissões (etapa 10): o administrador liga e desliga o que cada perfil faz. */
export function Perfis() {
  const perfis = useQuery({
    queryKey: ['perfis'],
    queryFn: () => api<PerfilAcesso[]>('/perfis'),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
      <p className="text-texto-suave">{t('perfis.intro')}</p>
      {perfis.isPending ? (
        <div className="cartao p-4">
          <LinhasEsqueleto linhas={6} />
        </div>
      ) : perfis.isError ? (
        <p className="text-erro" role="alert">
          {perfis.error.message}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {perfis.data.map((p) => (
            <CartaoPerfil key={`${p.codigo}-${p.atualizadoEm}`} perfil={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoPerfil({ perfil }: { perfil: PerfilAcesso }) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [marcadas, setMarcadas] = useState<Permissao[]>(perfil.permissoes);

  const iguais = (a: readonly Permissao[], b: readonly Permissao[]) =>
    a.length === b.length && a.every((p) => b.includes(p));
  const alterado = !iguais(marcadas, perfil.permissoes);
  const padrao = PERMISSOES_PADRAO[perfil.codigo];

  const salvar = useMutation({
    mutationFn: () =>
      api<PerfilAcesso>(`/perfis/${perfil.codigo}/permissoes`, {
        metodo: 'PUT',
        corpo: { permissoes: marcadas },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['perfis'] });
      avisos.sucesso(t('perfis.salvo', { nome: perfil.nome }));
    },
    onError: (e: ErroDaApi) => avisos.erro(e.message),
  });

  const alternar = (p: Permissao) =>
    setMarcadas((atual) =>
      atual.includes(p)
        ? atual.filter((x) => x !== p)
        : PERMISSOES.filter((x) => x === p || atual.includes(x)),
    );

  return (
    <section className="cartao flex flex-col" aria-labelledby={`perfil-${perfil.codigo}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-borda px-4 py-3">
        <h2 id={`perfil-${perfil.codigo}`} className="titulo-secao flex items-center gap-2">
          {!perfil.editavel && <Lock size={18} aria-hidden />}
          {perfil.nome}
        </h2>
        <span className="legenda">
          {t('perfis.usuarios', { quantidade: perfil.usuariosAtivos })}
        </span>
      </header>

      <ul className="flex flex-col">
        {PERMISSOES.map((p) => {
          const ligada = marcadas.includes(p);
          const { nome, descricao } = DESCRICAO_PERMISSOES[p];
          return (
            <li key={p} className="border-b border-borda last:border-b-0">
              <button
                type="button"
                role="switch"
                aria-checked={ligada}
                disabled={!perfil.editavel}
                onClick={() => alternar(p)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left enabled:hover:bg-creme-escuro disabled:cursor-default"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{nome}</span>
                  <span className="block text-[14px] text-texto-suave">{descricao}</span>
                </span>
                <span
                  aria-hidden
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    ligada ? 'bg-moldura' : 'bg-desab-fundo'
                  } ${perfil.editavel ? '' : 'opacity-60'}`}
                >
                  <span
                    className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-superficie shadow transition-all ${
                      ligada ? 'left-6' : 'left-1'
                    }`}
                  >
                    {ligada && <Check size={12} className="text-moldura" />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-borda px-4 py-3">
        {perfil.editavel ? (
          <>
            {marcadas.length === 0 && (
              <p className="mr-auto text-[14px] font-semibold text-aviso">{t('perfis.nenhuma')}</p>
            )}
            <Botao
              variante="texto"
              disabled={iguais(marcadas, padrao)}
              onClick={() => setMarcadas([...padrao])}
            >
              {t('perfis.padrao')}
            </Botao>
            <Botao
              variante="principal"
              disabled={!alterado}
              carregando={salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              {t('perfis.salvar')}
            </Botao>
          </>
        ) : (
          <p className="mr-auto text-[14px] text-texto-suave">{t('perfis.adminFixo')}</p>
        )}
      </footer>
    </section>
  );
}
