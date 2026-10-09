import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { useSessao } from '../auth/sessao';
import { ErroDaApi } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import { CampoSenha, CampoTexto } from '../componentes/Campos';
import { marcarRascunhoRetomado } from './novo-pedido/rascunho';
import { t } from '../textos';

const CHAVE_ULTIMO = 'patotinha.ultimoUsuario';

function ultimoUsuario() {
  try {
    return localStorage.getItem(CHAVE_ULTIMO) ?? '';
  } catch {
    return '';
  }
}

export function telaInicial(perfil: string) {
  // Funcionário vai direto para Novo pedido; administrador para Início (PRD 8.1).
  return perfil === 'ADMIN' ? '/' : '/pedidos/novo';
}

export function Login() {
  const { usuario, entrar, expirou } = useSessao();
  const navegar = useNavigate();
  const [login, setLogin] = useState(ultimoUsuario);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<{ login?: string; senha?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const refSenha = useRef<HTMLInputElement>(null);

  if (usuario) return <Navigate to={telaInicial(usuario.perfil)} replace />;

  const enviar = async () => {
    const faltando = {
      login: login.trim() ? undefined : t('login.informeUsuario'),
      senha: senha ? undefined : t('login.informeSenha'),
    };
    setErrosCampo(faltando);
    if (faltando.login || faltando.senha) return;
    setEnviando(true);
    setErro(null);
    try {
      const u = await entrar(login.trim(), senha);
      try {
        localStorage.setItem(CHAVE_ULTIMO, login.trim());
      } catch {
        // ignora
      }
      marcarRascunhoRetomado(false);
      navegar(telaInicial(u.perfil), { replace: true });
    } catch (e) {
      const falha = e as ErroDaApi;
      setErro(
        falha.codigo === 'MUITAS_TENTATIVAS'
          ? t('erro.muitasTentativas')
          : falha.semConexao
            ? t('erro.semConexaoCarregar')
            : falha.status === 401 || falha.status === 422
              ? t('erro.loginInvalido')
              : t('erro.inesperado'),
      );
      // Apaga só a senha; o foco volta para ela.
      setSenha('');
      refSenha.current?.focus();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center bg-moldura px-4 py-10"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 30%, rgba(242,165,26,.15) 0%, rgba(242,165,26,0) 45%)',
      }}
    >
      <img src="/selo-completo.svg" alt="Patotinha da Vovó" className="mb-12 w-40 sm:w-[200px]" />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
        className="w-[360px] max-w-full rounded-padrao bg-fundo p-8 shadow-elevada"
      >
        <h1 className="mb-4 font-titulo text-[20px] font-semibold">{t('login.titulo')}</h1>
        {(erro || expirou) && (
          <div
            role="alert"
            className={`mb-4 flex items-start gap-2 rounded-padrao px-3 py-2 font-semibold ${
              erro ? 'bg-erro-fundo text-erro' : 'bg-aviso-fundo text-aviso'
            }`}
          >
            <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden />
            {erro ?? t('erro.sessaoExpirada')}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <CampoTexto
            rotulo={t('login.usuario')}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            erro={errosCampo.login}
            autoFocus={!login}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <CampoSenha
            ref={refSenha}
            rotulo={t('login.senha')}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={errosCampo.senha}
            autoFocus={Boolean(login)}
            autoComplete="current-password"
          />
          <Botao
            type="submit"
            variante="principal"
            tamanho="grande"
            className="w-full"
            carregando={enviando}
            textoCarregando={t('login.entrando')}
          >
            {t('login.entrar')}
          </Botao>
        </div>
      </form>
      <p className="enfeite mt-6 text-[16px] text-acao">{t('sistema.rodapeLogin')}</p>
    </div>
  );
}
