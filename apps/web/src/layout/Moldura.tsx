import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartColumnBig,
  ChefHat,
  ChevronDown,
  Cookie,
  House,
  KeyRound,
  LogOut,
  Menu,
  PlusCircle,
  Receipt,
  Tags,
  Users,
  Wifi,
  WifiOff,
  Keyboard,
} from 'lucide-react';
import { primeiroNome, useSessao } from '../auth/sessao';
import { aoMudarConexao } from '../api/cliente';
import { t } from '../textos';
import { Confirmacao } from '../componentes/Janela';
import { JanelaTrocarSenha } from './JanelaTrocarSenha';
import { JanelaAtalhos } from './JanelaAtalhos';
import { temRascunho } from '../telas/novo-pedido/rascunho';

const ITENS_MENU = [
  { para: '/pedidos/novo', rotulo: t('menu.novoPedido'), Icone: PlusCircle, admin: false },
  { para: '/fila', rotulo: t('menu.fila'), Icone: ChefHat, admin: false },
  { para: '/pedidos', rotulo: t('menu.historico'), Icone: Receipt, admin: false, fim: true },
  { para: '/', rotulo: t('menu.inicio'), Icone: House, admin: false, fim: true },
  { para: '/resumo', rotulo: t('menu.resumo'), Icone: ChartColumnBig, admin: true },
  { para: '/produtos', rotulo: t('menu.produtos'), Icone: Cookie, admin: true },
  { para: '/categorias', rotulo: t('menu.categorias'), Icone: Tags, admin: true },
  { para: '/usuarios', rotulo: t('menu.usuarios'), Icone: Users, admin: true },
];

const TITULOS: [RegExp, string][] = [
  [/^\/pedidos\/novo/, 'Novo pedido'],
  [/^\/pedidos\/\d+/, 'Detalhe do pedido'],
  [/^\/pedidos/, 'Histórico de pedidos'],
  [/^\/fila/, 'Fila de preparo'],
  [/^\/resumo/, 'Resumo de vendas'],
  [/^\/produtos/, 'Produtos'],
  [/^\/categorias/, 'Categorias'],
  [/^\/usuarios/, 'Usuários'],
  [/^\/$/, 'Início'],
];

/** Ponto verde ou vermelho com o estado da conexão, o tempo todo. */
function useConexao() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const parar = aoMudarConexao(setOnline);
    const verificar = () =>
      fetch('/api/saude', { cache: 'no-store' })
        .then((r) => setOnline(r.ok))
        .catch(() => setOnline(false));
    const id = setInterval(verificar, 30_000);
    const offline = () => setOnline(false);
    window.addEventListener('offline', offline);
    window.addEventListener('online', verificar);
    return () => {
      parar();
      clearInterval(id);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', verificar);
    };
  }, []);
  return online;
}

export function Moldura() {
  const { usuario, eAdmin, sair } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const online = useConexao();
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [atalhos, setAtalhos] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);

  const titulo = TITULOS.find(([re]) => re.test(local.pathname))?.[1] ?? '';

  const pedirSaida = useCallback(() => {
    setMenuUsuario(false);
    if (temRascunho()) setConfirmarSaida(true);
    else void sair();
  }, [sair]);

  // Atalhos globais: F1 abre Novo pedido e "?" mostra a lista. F1 a F5 não fazem a ação do navegador.
  useEffect(() => {
    const tratar = (e: KeyboardEvent) => {
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) e.preventDefault();
      if (e.key === 'F1') navegar('/pedidos/novo');
      const alvo = e.target as HTMLElement;
      const digitando = alvo.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '?' && !digitando && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        setAtalhos(true);
      }
    };
    window.addEventListener('keydown', tratar);
    return () => window.removeEventListener('keydown', tratar);
  }, [navegar]);

  useEffect(() => {
    if (!menuUsuario) return;
    const fora = (e: MouseEvent) => {
      if (!refMenu.current?.contains(e.target as Node)) setMenuUsuario(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [menuUsuario]);

  useEffect(() => setGaveta(false), [local.pathname]);

  if (!usuario) return null;
  const itens = ITENS_MENU.filter((i) => !i.admin || eAdmin);

  const menu = (recolhivel: boolean) => (
    <nav aria-label="Menu principal" className="flex flex-col gap-1 p-2">
      {itens.map(({ para, rotulo, Icone, fim }) => (
        <NavLink
          key={para}
          to={para}
          end={fim}
          title={rotulo}
          className={({ isActive }) =>
            `flex min-h-12 items-center gap-3 rounded-padrao px-3 font-bold text-sobre-moldura transition-colors ${
              isActive ? 'bg-selecionado' : 'hover:bg-moldura-escura'
            } ${recolhivel ? 'lg:justify-start max-lg:justify-center' : ''}`
          }
        >
          <Icone size={24} aria-hidden className="shrink-0" />
          <span className={recolhivel ? 'max-lg:sr-only' : ''}>{rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="nao-imprimir flex h-16 shrink-0 items-center gap-3 bg-moldura px-3 text-sobre-moldura md:px-4">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-padrao hover:bg-moldura-escura md:hidden"
          aria-label={t('menu.abrirMenu')}
          aria-expanded={gaveta}
          onClick={() => setGaveta((g) => !g)}
        >
          <Menu size={24} />
        </button>
        <img src="/logo-pequeno.webp" alt="Patotinha da Vovó" className="h-12 w-auto" />
        <span className="hidden font-titulo text-[18px] font-semibold uppercase tracking-wide sm:inline">
          {t('sistema.nome')}
        </span>
        <span className="hidden h-6 w-px bg-sobre-moldura/40 sm:inline" aria-hidden />
        <h1 className="truncate font-titulo text-[20px] font-medium uppercase">{titulo}</h1>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px]"
            title={online ? t('menu.conectado') : t('menu.semConexao')}
            role="status"
            aria-label={online ? t('menu.conectado') : t('menu.semConexao')}
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-[#4caf50]' : 'bg-[#ff5252]'}`} />
            {online ? <Wifi size={18} aria-hidden /> : <WifiOff size={18} aria-hidden />}
          </span>
          <div className="relative" ref={refMenu}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
              onClick={() => setMenuUsuario((m) => !m)}
              className="flex h-12 items-center gap-1 rounded-padrao px-3 font-bold hover:bg-moldura-escura"
            >
              {primeiroNome(usuario.nome)} <ChevronDown size={18} aria-hidden />
            </button>
            {menuUsuario && (
              <div
                role="menu"
                className="absolute right-0 top-14 z-20 w-56 overflow-hidden rounded-padrao bg-superficie py-1 text-texto shadow-elevada"
              >
                <button
                  role="menuitem"
                  type="button"
                  className="flex h-12 w-full items-center gap-3 px-4 hover:bg-creme-escuro"
                  onClick={() => {
                    setMenuUsuario(false);
                    setTrocarSenha(true);
                  }}
                >
                  <KeyRound size={20} aria-hidden /> {t('menu.trocarSenha')}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="flex h-12 w-full items-center gap-3 px-4 hover:bg-creme-escuro"
                  onClick={() => {
                    setMenuUsuario(false);
                    setAtalhos(true);
                  }}
                >
                  <Keyboard size={20} aria-hidden /> {t('menu.atalhos')}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="flex h-12 w-full items-center gap-3 px-4 hover:bg-creme-escuro"
                  onClick={pedirSaida}
                >
                  <LogOut size={20} aria-hidden /> {t('menu.sair')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={pedirSaida}
            className="hidden h-12 items-center gap-2 rounded-padrao px-3 font-bold hover:bg-moldura-escura sm:flex"
          >
            <LogOut size={20} aria-hidden /> {t('menu.sair')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Computador: 220 px; tablet: recolhido em ícones de 72 px; celular: gaveta. */}
        <aside className="nao-imprimir hidden w-[72px] shrink-0 overflow-y-auto bg-moldura md:block lg:w-[220px]">
          {menu(true)}
        </aside>
        {gaveta && (
          <div
            className="fixed inset-0 top-16 z-30 bg-texto/40 md:hidden"
            onClick={() => setGaveta(false)}
          >
            <aside className="h-full w-[260px] bg-moldura" onClick={(e) => e.stopPropagation()}>
              {menu(false)}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {trocarSenha && <JanelaTrocarSenha aoFechar={() => setTrocarSenha(false)} />}
      {atalhos && <JanelaAtalhos aoFechar={() => setAtalhos(false)} />}
      {confirmarSaida && (
        <Confirmacao
          titulo={t('confirmacao.sairTitulo')}
          texto={t('confirmacao.sairTexto')}
          confirmar={t('confirmacao.sair')}
          perigo={false}
          aoFechar={() => setConfirmarSaida(false)}
          aoConfirmar={() => {
            setConfirmarSaida(false);
            void sair();
          }}
        />
      )}
    </div>
  );
}
