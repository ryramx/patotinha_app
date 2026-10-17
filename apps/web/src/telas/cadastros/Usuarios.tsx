import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import {
  combinaBusca,
  esquemaUsuarioEdicao,
  esquemaUsuarioNovo,
  LIMITES,
  NOMES_PERFIL,
  PERFIS,
  type Perfil,
  type Usuario,
} from '@patotinha/shared';
import { api, ErroDaApi } from '../../api/cliente';
import { useSessao } from '../../auth/sessao';
import { useAvisos } from '../../componentes/Avisos';
import { Botao } from '../../componentes/Botao';
import { CampoTexto } from '../../componentes/Campos';
import { EtiquetaAtivo, LinhasEsqueleto, Vazio } from '../../componentes/Diversos';
import { Confirmacao, Janela } from '../../componentes/Janela';
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

/** Senha aleatória legível (sem caracteres parecidos). */
function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => letras[b % letras.length]).join('');
}

export function Usuarios() {
  const { usuario: eu, eAdmin } = useSessao();
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('ativos');
  const [editando, setEditando] = useState<Usuario | 'novo' | null>(null);
  const [confirmar, setConfirmar] = useState<Usuario | null>(null);
  const [redefinir, setRedefinir] = useState<Usuario | null>(null);

  const usuarios = useQuery({
    queryKey: ['usuarios', 'todos'],
    queryFn: () => api<Usuario[]>('/usuarios'),
  });

  const alternar = useMutation({
    mutationFn: (u: Usuario) =>
      api<Usuario>(`/usuarios/${u.id}/status`, { metodo: 'PATCH', corpo: { ativo: !u.ativo } }),
    onSuccess: (u) => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      avisos.sucesso(
        u.ativo
          ? t('sucesso.ativado', { nome: u.nome })
          : t('sucesso.usuarioDesativado', { nome: u.nome }),
      );
      setConfirmar(null);
    },
    onError: (e: ErroDaApi) => {
      avisos.erro(e.message);
      setConfirmar(null);
    },
  });

  const lista = (usuarios.data ?? []).filter(
    (u) =>
      passaStatus(u.ativo, status) &&
      (!busca.trim() || combinaBusca(`${u.nome} ${u.login}`, busca)),
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BarraCadastro
        busca={busca}
        aoBuscar={setBusca}
        status={status}
        aoMudarStatus={setStatus}
        rotuloNovo={t('cadastro.novoUsuario')}
        aoNovo={() => setEditando('novo')}
      />
      <div className="cartao overflow-x-auto">
        {usuarios.isPending ? (
          <div className="p-4">
            <LinhasEsqueleto />
          </div>
        ) : lista.length === 0 ? (
          <Vazio texto="Nenhum usuário com esses filtros" />
        ) : (
          <table className={classeTabela}>
            <thead className={classeCabecalho}>
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="py-3 font-semibold">Login</th>
                <th className="py-3 font-semibold">Perfil</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 pr-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const souEu = u.id === eu?.id;
                // Só o administrador mexe em administradores (a API também confere).
                const podeMexer = eAdmin || u.perfil !== 'ADMIN';
                return (
                  <tr key={u.id} className={classeLinha}>
                    <td className="px-4 font-bold">
                      {u.nome}{' '}
                      {souEu && (
                        <span className="font-normal text-texto-suave">{t('cadastro.voce')}</span>
                      )}
                    </td>
                    <td>{u.login}</td>
                    <td>
                      <span
                        className={`rounded-full px-3 py-0.5 text-[14px] font-bold ${
                          u.perfil === 'ADMIN'
                            ? 'bg-moldura text-sobre-moldura'
                            : 'bg-desab-fundo text-texto-suave'
                        }`}
                      >
                        {NOMES_PERFIL[u.perfil]}
                      </span>
                    </td>
                    <td>
                      <EtiquetaAtivo ativo={u.ativo} />
                    </td>
                    <td className="pr-4 text-right">
                      <div className={`flex justify-end gap-2 ${podeMexer ? '' : 'hidden'}`}>
                        <Botao className="!min-h-10" onClick={() => setEditando(u)}>
                          {t('cadastro.editar')}
                        </Botao>
                        <Botao className="!min-h-10" onClick={() => setRedefinir(u)}>
                          {t('cadastro.redefinirSenha')}
                        </Botao>
                        {!souEu &&
                          (u.ativo ? (
                            <Botao
                              variante="perigo"
                              className="!min-h-10"
                              onClick={() => setConfirmar(u)}
                            >
                              {t('cadastro.desativar')}
                            </Botao>
                          ) : (
                            <Botao className="!min-h-10" onClick={() => alternar.mutate(u)}>
                              {t('cadastro.ativar')}
                            </Botao>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <FormularioUsuario
          usuario={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
      {redefinir && (
        <JanelaRedefinirSenha usuario={redefinir} aoFechar={() => setRedefinir(null)} />
      )}
      {confirmar && (
        <Confirmacao
          titulo={t('confirmacao.desativarUsuarioTitulo', { nome: confirmar.nome })}
          texto={t('confirmacao.desativarUsuarioTexto')}
          confirmar={t('confirmacao.desativar')}
          carregando={alternar.isPending}
          aoFechar={() => setConfirmar(null)}
          aoConfirmar={() => alternar.mutate(confirmar)}
        />
      )}
    </div>
  );
}

function FormularioUsuario({
  usuario,
  aoFechar,
}: {
  usuario: Usuario | null;
  aoFechar: () => void;
}) {
  const avisos = useAvisos();
  const queryClient = useQueryClient();
  const { eAdmin } = useSessao();
  const opcoesPerfil = PERFIS.filter((p) => eAdmin || p !== 'ADMIN');
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [login, setLogin] = useState(usuario?.login ?? '');
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? 'FUNCIONARIO');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  const alterado =
    nome !== (usuario?.nome ?? '') ||
    login !== (usuario?.login ?? '') ||
    perfil !== (usuario?.perfil ?? 'FUNCIONARIO') ||
    senha !== '';

  const validar = (campo?: string) => {
    const r = usuario
      ? esquemaUsuarioEdicao.safeParse({ nome, login, perfil })
      : esquemaUsuarioNovo.safeParse({ nome, login, perfil, senha });
    const novos: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) novos[String(i.path[0])] ??= i.message;
    if (!nome.trim()) novos.nome = 'Informe o nome';
    setErros((atual) => (campo ? { ...atual, [campo]: novos[campo] ?? '' } : novos));
    return Object.keys(novos).length === 0;
  };

  const salvar = useMutation({
    mutationFn: () =>
      api<Usuario>(usuario ? `/usuarios/${usuario.id}` : '/usuarios', {
        metodo: usuario ? 'PUT' : 'POST',
        corpo: usuario
          ? { nome: nome.trim(), login: login.trim(), perfil }
          : { nome: nome.trim(), login: login.trim(), perfil, senha },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      avisos.sucesso(t('sucesso.usuarioSalvo'));
      aoFechar();
    },
    onError: (e: ErroDaApi) => {
      if (e.codigo === 'LOGIN_DUPLICADO') setErros({ login: e.message });
      else if (e.codigo === 'SENHA_FRACA') setErros({ senha: e.message });
      else if (e.codigo === 'ULTIMO_ADMIN' || e.codigo === 'SO_ADMIN')
        setErros({ perfil: e.message });
      else avisos.erro(e.message);
      focarPrimeiroErro();
    },
  });

  return (
    <PainelFormulario
      titulo={usuario ? t('cadastro.editarUsuario') : t('cadastro.novoUsuario')}
      alterado={alterado}
      salvando={salvar.isPending}
      aoFechar={aoFechar}
      aoSalvar={() => (validar() ? salvar.mutate() : focarPrimeiroErro())}
    >
      <CampoTexto
        rotulo="Nome"
        value={nome}
        maxLength={LIMITES.usuarioNome.max}
        autoFocus
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => validar('nome')}
        erro={erros.nome || null}
      />
      <CampoTexto
        rotulo="Login"
        value={login}
        maxLength={LIMITES.login.max}
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => setLogin(e.target.value.toLowerCase())}
        onBlur={() => validar('login')}
        erro={erros.login || null}
        dica="Letras minúsculas, números, ponto e traço"
      />
      <fieldset>
        <legend className="rotulo mb-1">Perfil</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {opcoesPerfil.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={perfil === p}
              onClick={() => setPerfil(p)}
              className={`h-12 rounded-padrao border font-bold ${
                perfil === p
                  ? 'border-moldura bg-moldura text-sobre-moldura'
                  : 'border-borda bg-superficie hover:border-moldura'
              }`}
            >
              {NOMES_PERFIL[p]}
            </button>
          ))}
        </div>
        {erros.perfil && <p className="mt-1 text-[14px] text-erro">{erros.perfil}</p>}
      </fieldset>
      {!usuario && (
        <CampoTexto
          rotulo="Senha inicial"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onBlur={() => validar('senha')}
          erro={erros.senha || null}
          autoComplete="new-password"
          dica="Mínimo de 8 caracteres"
          direita={
            <Botao
              variante="texto"
              className="h-10 px-2 text-[14px]"
              icone={<Dices size={16} aria-hidden />}
              onClick={() => setSenha(gerarSenha())}
            >
              {t('cadastro.gerarSenha')}
            </Botao>
          }
          className="[&_input]:pr-36"
        />
      )}
    </PainelFormulario>
  );
}

function JanelaRedefinirSenha({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const avisos = useAvisos();
  const [senha, setSenha] = useState(gerarSenha);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: () =>
      api(`/usuarios/${usuario.id}/senha`, { metodo: 'PUT', corpo: { novaSenha: senha } }),
    onSuccess: () => {
      avisos.sucesso(t('sucesso.senhaRedefinida', { nome: usuario.nome }));
      aoFechar();
    },
    onError: (e: ErroDaApi) => setErro(e.message),
  });
  return (
    <Janela
      titulo={`${t('cadastro.redefinirSenha')}: ${usuario.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" autoFocus onClick={aoFechar}>
            {t('cadastro.cancelar')}
          </Botao>
          <Botao
            variante="principal"
            carregando={salvar.isPending}
            onClick={() =>
              senha.length >= LIMITES.senha.min
                ? salvar.mutate()
                : setErro('A senha precisa ter pelo menos 8 caracteres')
            }
          >
            {t('cadastro.salvar')}
          </Botao>
        </>
      }
    >
      <CampoTexto
        rotulo={t('senha.nova')}
        value={senha}
        onChange={(e) => {
          setSenha(e.target.value);
          setErro(null);
        }}
        erro={erro}
        className="[&_input]:font-bold [&_input]:tracking-wider"
      />
      <p className="mt-3 rounded-padrao bg-aviso-fundo px-3 py-2 font-semibold text-aviso">
        {t('cadastro.anoteSenha')}
      </p>
    </Janela>
  );
}
