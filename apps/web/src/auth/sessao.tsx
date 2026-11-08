import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Permissao, UsuarioSessao } from '@patotinha/shared';
import { aoExpirarSessao, api, ErroDaApi } from '../api/cliente';
import { antesDeConectar, esperarConexao, estadoConexao } from '../api/conexao';
import { t } from '../textos';
import {
  atualizarSessaoLembrada,
  atualizarUsuarioNoAparelho,
  conferirAcesso,
  esquecerAcesso,
  esquecerSessao,
  guardarAcesso,
  lembrarSessaoNova,
  lerSessaoLembrada,
} from './acessoLocal';

interface ContextoSessao {
  usuario: UsuarioSessao | null;
  /** Por que voltou ao login (sessão expirou, servidor recusou a senha), para avisar na tela. */
  avisoLogin: string | null;
  entrar: (login: string, senha: string) => Promise<UsuarioSessao>;
  sair: () => Promise<void>;
  eAdmin: boolean;
  /** O perfil do usuário pode fazer isso? Só esconde a tela; quem bloqueia é a API. */
  pode: (permissao: Permissao) => boolean;
  /** Fechou ou terminou o tutorial: guarda no servidor para não abrir sozinho de novo. */
  marcarTutorialVisto: () => void;
}

const Contexto = createContext<ContextoSessao | null>(null);

/** Saiu com o servidor dormindo: o cookie é apagado assim que ele acordar. */
const CHAVE_SAIR_PENDENTE = 'patotinha.sairPendente';

function sairPendente() {
  try {
    return localStorage.getItem(CHAVE_SAIR_PENDENTE) === '1';
  } catch {
    return false;
  }
}

function marcarSairPendente(valor: boolean) {
  try {
    if (valor) localStorage.setItem(CHAVE_SAIR_PENDENTE, '1');
    else localStorage.removeItem(CHAVE_SAIR_PENDENTE);
  } catch {
    // ignora
  }
}

/**
 * Sessão de quem usa o sistema. Abre na hora, sem esperar a API acordar (etapa 16,
 * docs/abrir-sem-esperar.md): com a sessão lembrada no aparelho, ou conferindo a senha com o
 * acesso guardado no aparelho. O servidor confere tudo em segundo plano assim que responde.
 */
export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(() => lerSessaoLembrada());
  const [avisoLogin, setAvisoLogin] = useState<string | null>(null);
  const queryClient = useQueryClient();
  /** Entrou com o acesso do aparelho: o login de verdade espera a API acordar. */
  const loginPendente = useRef<{ login: string; senha: string } | null>(null);

  // Com o servidor acordado, antes de qualquer consulta: apaga o cookie de quem saiu e faz o
  // login de quem entrou sem esperar. Falta de conexão relança o erro e tenta de novo depois.
  useEffect(
    () =>
      antesDeConectar(async () => {
        if (sairPendente()) {
          await api('/auth/logout', { metodo: 'POST' }).catch((e: ErroDaApi) => {
            if (e.semConexao) throw e;
          });
          marcarSairPendente(false);
        }
        const pendente = loginPendente.current;
        if (!pendente) return;
        try {
          const r = await api<{ usuario: UsuarioSessao }>('/auth/login', {
            metodo: 'POST',
            corpo: pendente,
          });
          loginPendente.current = null;
          setUsuario(r.usuario);
          lembrarSessaoNova(r.usuario);
          void guardarAcesso(pendente.login, pendente.senha, r.usuario);
        } catch (e) {
          const erro = e as ErroDaApi;
          if (erro.semConexao) throw erro;
          loginPendente.current = null;
          if (erro.status === 401 || erro.status === 422) esquecerAcesso(pendente.login);
          esquecerSessao();
          setUsuario(null);
          setAvisoLogin(
            erro.codigo === 'MUITAS_TENTATIVAS'
              ? t('erro.muitasTentativas')
              : t('erro.acessoRecusado'),
          );
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  // Confere a sessão no servidor em segundo plano, assim que ele responder. Sem cookie válido,
  // o 401 leva ao login pelo aviso abaixo.
  useEffect(() => {
    let ativo = true;
    esperarConexao()
      .then(() => api<{ usuario: UsuarioSessao }>('/auth/me'))
      .then((r) => {
        if (!ativo) return;
        setUsuario(r.usuario);
        atualizarSessaoLembrada(r.usuario);
        atualizarUsuarioNoAparelho(r.usuario);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  // 401 em qualquer chamada: volta ao login com aviso, sem apagar o rascunho do pedido.
  useEffect(
    () =>
      aoExpirarSessao(() => {
        // Quem entrou sem esperar ainda não tem cookie: o login de verdade vem logo.
        if (loginPendente.current) return;
        esquecerSessao();
        setUsuario((atual) => {
          if (atual) setAvisoLogin(t('erro.sessaoExpirada'));
          return null;
        });
        queryClient.clear();
      }),
    [queryClient],
  );

  const entrar = useCallback(async (login: string, senha: string) => {
    const noServidor = () =>
      api<{ usuario: UsuarioSessao }>('/auth/login', { metodo: 'POST', corpo: { login, senha } });
    // Servidor dormindo: se o aparelho conhece esta senha, entra na hora. Senão, só o servidor
    // pode conferir, e o login espera ele acordar.
    const semServidor = async () => {
      const doAparelho = await conferirAcesso(login, senha);
      if (doAparelho) {
        loginPendente.current = { login, senha };
        return doAparelho;
      }
      await esperarConexao();
      return null;
    };

    let r: { usuario: UsuarioSessao };
    if (estadoConexao() !== 'conectado') {
      const doAparelho = await semServidor();
      if (doAparelho) {
        setAvisoLogin(null);
        setUsuario(doAparelho);
        return doAparelho;
      }
    }
    try {
      r = await noServidor();
    } catch (e) {
      // A API dormiu com a tela aberta: mesmo caminho de quando ela já estava dormindo.
      if (!(e as ErroDaApi).semConexao) throw e;
      const doAparelho = await semServidor();
      if (doAparelho) {
        setAvisoLogin(null);
        setUsuario(doAparelho);
        return doAparelho;
      }
      r = await noServidor();
    }
    loginPendente.current = null;
    setAvisoLogin(null);
    setUsuario(r.usuario);
    lembrarSessaoNova(r.usuario);
    void guardarAcesso(login, senha, r.usuario);
    return r.usuario;
  }, []);

  const sair = useCallback(async () => {
    loginPendente.current = null;
    esquecerSessao();
    setUsuario(null);
    queryClient.clear();
    if (estadoConexao() !== 'conectado') {
      marcarSairPendente(true);
      return;
    }
    await api('/auth/logout', { metodo: 'POST' }).catch((e: ErroDaApi) => {
      if (e.semConexao) marcarSairPendente(true);
    });
  }, [queryClient]);

  const marcarTutorialVisto = useCallback(() => {
    if (!usuario || usuario.tutorialVisto) return;
    // Se falhar (sem internet), o tutorial volta no próximo acesso; não atrapalha o uso.
    api('/auth/tutorial', { metodo: 'PUT' }).catch(() => undefined);
    const visto = { ...usuario, tutorialVisto: true };
    setUsuario(visto);
    atualizarUsuarioNoAparelho(visto);
  }, [usuario]);

  const valor = useMemo(
    () => ({
      usuario,
      avisoLogin,
      entrar,
      sair,
      eAdmin: usuario?.perfil === 'ADMIN',
      pode: (permissao: Permissao) => podeFazer(usuario, permissao),
      marcarTutorialVisto,
    }),
    [usuario, avisoLogin, entrar, sair, marcarTutorialVisto],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao fora do ProvedorSessao');
  return ctx;
}

export function podeFazer(usuario: UsuarioSessao | null, permissao: Permissao) {
  return !!usuario && (usuario.perfil === 'ADMIN' || usuario.permissoes.includes(permissao));
}

/** Primeira tela depois do login, conforme o que o perfil pode fazer (etapa 10). */
export function telaInicial(usuario: UsuarioSessao) {
  if (podeFazer(usuario, 'FINANCEIRO')) return '/';
  if (podeFazer(usuario, 'PEDIDOS_REGISTRAR')) return '/pedidos/novo';
  if (podeFazer(usuario, 'FILA')) return '/fila';
  if (podeFazer(usuario, 'PEDIDOS_VER')) return '/pedidos';
  return '/';
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
