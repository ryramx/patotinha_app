import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Permissao, UsuarioSessao } from '@patotinha/shared';
import { aoExpirarSessao, api } from '../api/cliente';

interface ContextoSessao {
  usuario: UsuarioSessao | null;
  carregando: boolean;
  expirou: boolean;
  entrar: (login: string, senha: string) => Promise<UsuarioSessao>;
  sair: () => Promise<void>;
  eAdmin: boolean;
  /** O perfil do usuário pode fazer isso? Só esconde a tela; quem bloqueia é a API. */
  pode: (permissao: Permissao) => boolean;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [expirou, setExpirou] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    api<{ usuario: UsuarioSessao }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  // 401 em qualquer chamada: volta ao login com aviso, sem apagar o rascunho do pedido.
  useEffect(
    () =>
      aoExpirarSessao(() => {
        setUsuario((atual) => {
          if (atual) setExpirou(true);
          return null;
        });
        queryClient.clear();
      }),
    [queryClient],
  );

  const entrar = useCallback(async (login: string, senha: string) => {
    const r = await api<{ usuario: UsuarioSessao }>('/auth/login', {
      metodo: 'POST',
      corpo: { login, senha },
    });
    setExpirou(false);
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const sair = useCallback(async () => {
    try {
      await api('/auth/logout', { metodo: 'POST' });
    } finally {
      setUsuario(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      expirou,
      entrar,
      sair,
      eAdmin: usuario?.perfil === 'ADMIN',
      pode: (permissao: Permissao) => podeFazer(usuario, permissao),
    }),
    [usuario, carregando, expirou, entrar, sair],
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
