import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartColumnBig,
  ChefHat,
  ChevronDown,
  Cookie,
  Ellipsis,
  HandCoins,
  House,
  KeyRound,
  LogOut,
  Moon,
  PlusCircle,
  QrCode,
  Receipt,
  ShieldCheck,
  Sun,
  Tags,
  Users,
  Keyboard,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import type { Permissao } from '@patotinha/shared';
import { primeiroNome, useSessao } from '../auth/sessao';
import { aoMudarConexao } from '../api/cliente';
import { t } from '../textos';
import { useTema } from '../tema';
import { Confirmacao } from '../componentes/Janela';
import { JanelaTrocarSenha } from './JanelaTrocarSenha';
import { JanelaAtalhos } from './JanelaAtalhos';
import { temRascunho } from '../telas/novo-pedido/rascunho';
import { Tutorial } from '../ajuda/Tutorial';
import { BotaoLampada } from '../ajuda/Lampada';

interface ItemMenu {
  para: string;
  rotulo: string;
  curto: string;
  Icone: LucideIcon;
  fim?: boolean;
  /** Aparece para quem tem alguma destas permissões; 'ADMIN' é só o administrador. */
  exige: (Permissao | 'ADMIN')[];
}

/** Sempre à vista: no topo (computador e tablet) e nas abas de baixo (celular). */
const PRINCIPAIS: ItemMenu[] = [
  {
    para: '/pedidos/novo',
    rotulo: t('menu.novoPedido'),
    curto: t('menu.novo'),
    Icone: PlusCircle,
    exige: ['PEDIDOS_REGISTRAR'],
  },
  {
    para: '/receber',
    rotulo: t('menu.receber'),
    curto: t('menu.receberCurto'),
    Icone: HandCoins,
    exige: ['PEDIDOS_REGISTRAR'],
  },
  {
    para: '/fila',
    rotulo: t('menu.fila'),
    curto: t('menu.filaCurta'),
    Icone: ChefHat,
    exige: ['FILA'],
  },
  {
    para: '/pedidos',
    rotulo: t('menu.historico'),
    curto: t('menu.historico'),
    Icone: Receipt,
    fim: true,
    exige: ['PEDIDOS_VER'],
  },
  {
    para: '/',
    rotulo: t('menu.inicio'),
    curto: t('menu.inicio'),
    Icone: House,
    fim: true,
    exige: ['PEDIDOS_VER', 'FINANCEIRO'],
  },
];

/** Conforme o perfil: Resumo no topo; os cadastros num menu "Cadastros". */
const RESUMO: ItemMenu = {
  para: '/resumo',
  rotulo: t('menu.resumo'),
  curto: t('menu.resumo'),
  Icone: ChartColumnBig,
  exige: ['FINANCEIRO'],
};
const CADASTROS: ItemMenu[] = [
  {
    para: '/produtos',
    rotulo: t('menu.produtos'),
    curto: t('menu.produtos'),
    Icone: Cookie,
    exige: ['CARDAPIO'],
  },
  {
    para: '/categorias',
    rotulo: t('menu.categorias'),
    curto: t('menu.categorias'),
    Icone: Tags,
    exige: ['CARDAPIO'],
  },
  {
    para: '/usuarios',
    rotulo: t('menu.usuarios'),
    curto: t('menu.usuarios'),
    Icone: Users,
    exige: ['USUARIOS'],
  },
  {
    para: '/perfis',
    rotulo: t('menu.perfis'),
    curto: t('menu.perfis'),
    Icone: ShieldCheck,
    exige: ['ADMIN'],
  },
  {
    para: '/pix',
    rotulo: t('menu.pix'),
    curto: t('menu.pix'),
    Icone: QrCode,
    exige: ['ADMIN'],
  },
];

const TITULOS: [RegExp, string][] = [
  [/^\/pedidos\/novo/, 'Novo pedido'],
  [/^\/pedidos\/\d+/, 'Detalhe do pedido'],
  [/^\/pedidos/, 'Histórico de pedidos'],
  [/^\/fila/, 'Fila de preparo'],
  [/^\/receber/, 'A receber'],
  [/^\/resumo/, 'Resumo de vendas'],
  [/^\/produtos/, 'Produtos'],
  [/^\/categorias/, 'Categorias'],
  [/^\/usuarios/, 'Usuários'],
  [/^\/perfis/, 'Perfis e permissões'],
  [/^\/pix/, 'Pix da loja'],
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

/** Fecha um menu suspenso ao clicar fora dele. */
function useFecharFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto, fechar]);
  return ref;
}

const pilula = (ativo: boolean) =>
  `flex h-11 items-center gap-2 rounded-full px-3 text-[14px] font-bold whitespace-nowrap transition-colors xl:px-4 ${
    ativo
      ? 'bg-moldura text-sobre-moldura'
      : 'text-texto-suave hover:bg-creme-escuro hover:text-texto'
  }`;

function ItemSuspenso({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      type="button"
      className="flex h-12 w-full items-center gap-3 px-4 text-left hover:bg-creme-escuro"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Moldura() {
  const { usuario, eAdmin, pode, sair, marcarTutorialVisto } = useSessao();
  const { tema, alternar } = useTema();
  const navegar = useNavigate();
  const local = useLocation();
  const online = useConexao();
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [menuCadastros, setMenuCadastros] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [atalhos, setAtalhos] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // Primeiro acesso: os cards abrem sozinhos; depois, só pelo menu ou pela lâmpada.
  const [tutorial, setTutorial] = useState(() => usuario?.tutorialVisto === false);
  const refUsuario = useFecharFora(
    menuUsuario,
    useCallback(() => setMenuUsuario(false), []),
  );
  const refCadastros = useFecharFora(
    menuCadastros,
    useCallback(() => setMenuCadastros(false), []),
  );

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
      if (e.key === 'F1' && pode('PEDIDOS_REGISTRAR')) navegar('/pedidos/novo');
      const alvo = e.target as HTMLElement;
      const digitando = alvo.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '?' && !digitando && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        setAtalhos(true);
      }
    };
    window.addEventListener('keydown', tratar);
    return () => window.removeEventListener('keydown', tratar);
  }, [navegar, pode]);

  useEffect(() => {
    setGaveta(false);
    setMenuCadastros(false);
  }, [local.pathname]);

  if (!usuario) return null;
  const ve = (i: ItemMenu) => i.exige.some((p) => (p === 'ADMIN' ? eAdmin : pode(p)));
  const abas = PRINCIPAIS.filter(ve);
  const principais = ve(RESUMO) ? [...abas, RESUMO] : abas;
  const cadastros = CADASTROS.filter(ve);
  const extras = [RESUMO, ...CADASTROS].filter(ve);
  const emCadastros = cadastros.some((c) => local.pathname.startsWith(c.para));
  const rotuloTema = tema === 'escuro' ? t('menu.modoClaro') : t('menu.modoEscuro');

  return (
    <div className="flex h-full flex-col">
      <header className="nao-imprimir flex h-16 shrink-0 items-center gap-2 border-b border-borda bg-cabecalho px-3 md:gap-3 md:px-4 lg:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <img src="/logo-pequeno.webp" alt="Patotinha da Vovó" className="h-11 w-auto" />
          <span className="hidden text-[15px] font-extrabold leading-[17px] 2xl:block">
            Patotinha
            <br />
            <span className="text-[13px] font-semibold text-texto-suave">da Vovó</span>
          </span>
        </div>
        {/* No celular o título fica no cabeçalho; no computador o menu mostra onde se está. */}
        <h1 className="truncate text-[18px] font-extrabold md:sr-only">{titulo}</h1>

        <nav
          aria-label="Menu principal"
          className="ml-2 hidden items-center gap-1 rounded-full bg-creme-escuro p-1 md:flex"
        >
          {principais.map(({ para, rotulo, Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              title={rotulo}
              className={({ isActive }) => pilula(isActive)}
            >
              <Icone size={18} aria-hidden className="shrink-0" />
              <span className="max-lg:sr-only">{rotulo}</span>
            </NavLink>
          ))}
          {cadastros.length > 0 && (
            <div className="relative" ref={refCadastros}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuCadastros}
                title={t('menu.cadastros')}
                onClick={() => setMenuCadastros((m) => !m)}
                className={pilula(emCadastros)}
              >
                <Cookie size={18} aria-hidden className="shrink-0 lg:hidden" />
                <span className="max-lg:sr-only">{t('menu.cadastros')}</span>
                <ChevronDown size={16} aria-hidden />
              </button>
              {menuCadastros && (
                <div
                  role="menu"
                  className="absolute left-0 top-13 z-20 w-56 overflow-hidden rounded-grande border border-borda bg-superficie py-1 shadow-elevada"
                >
                  {cadastros.map(({ para, rotulo, Icone }) => (
                    <NavLink
                      key={para}
                      to={para}
                      role="menuitem"
                      className={({ isActive }) =>
                        `flex h-12 items-center gap-3 px-4 font-semibold hover:bg-creme-escuro ${isActive ? 'text-moldura' : ''}`
                      }
                    >
                      <Icone size={20} aria-hidden /> {rotulo}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 md:gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold ${online ? 'text-sucesso' : 'text-erro'}`}
            title={online ? t('menu.conectado') : t('menu.semConexao')}
            role="status"
            aria-label={online ? t('menu.conectado') : t('menu.semConexao')}
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-sucesso' : 'bg-erro'}`} />
            <span className="hidden xl:inline">{online ? 'Online' : 'Sem conexão'}</span>
          </span>
          <BotaoLampada aoVerTutorial={() => setTutorial(true)} />
          <button
            type="button"
            onClick={alternar}
            aria-label={rotuloTema}
            title={rotuloTema}
            className="flex h-11 w-10 items-center justify-center rounded-full text-texto-suave hover:bg-creme-escuro hover:text-texto sm:w-11"
          >
            {tema === 'escuro' ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
          </button>
          <div className="relative" ref={refUsuario}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
              onClick={() => setMenuUsuario((m) => !m)}
              className="flex h-11 items-center gap-2 rounded-full border border-borda p-1 font-bold hover:bg-creme-escuro sm:pr-3"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-moldura/12 font-extrabold text-moldura"
                aria-hidden
              >
                {primeiroNome(usuario.nome).charAt(0).toUpperCase()}
              </span>
              <span className="max-sm:sr-only">{primeiroNome(usuario.nome)}</span>
              <ChevronDown size={16} aria-hidden className="max-sm:hidden" />
            </button>
            {menuUsuario && (
              <div
                role="menu"
                className="absolute right-0 top-13 z-20 w-60 overflow-hidden rounded-grande border border-borda bg-superficie py-1 text-texto shadow-elevada"
              >
                <ItemSuspenso
                  onClick={() => {
                    setMenuUsuario(false);
                    setTrocarSenha(true);
                  }}
                >
                  <KeyRound size={20} aria-hidden /> {t('menu.trocarSenha')}
                </ItemSuspenso>
                <ItemSuspenso
                  onClick={() => {
                    setMenuUsuario(false);
                    setAtalhos(true);
                  }}
                >
                  <Keyboard size={20} aria-hidden /> {t('menu.atalhos')}
                </ItemSuspenso>
                <ItemSuspenso
                  onClick={() => {
                    setMenuUsuario(false);
                    setTutorial(true);
                  }}
                >
                  <GraduationCap size={20} aria-hidden /> {t('menu.tutorial')}
                </ItemSuspenso>
                <ItemSuspenso onClick={pedirSaida}>
                  <LogOut size={20} aria-hidden /> {t('menu.sair')}
                </ItemSuspenso>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={pedirSaida}
            className="hidden h-11 items-center gap-2 rounded-full px-3 font-bold text-texto-suave hover:bg-creme-escuro hover:text-texto xl:flex"
          >
            <LogOut size={20} aria-hidden /> {t('menu.sair')}
          </button>
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto max-md:pb-[var(--altura-abas-celular)]">
        <Outlet />
      </main>

      {/* Celular: abas fixas embaixo; "Mais" abre Resumo e cadastros, conforme o perfil. */}
      <nav
        aria-label="Menu principal"
        className="nao-imprimir fixed inset-x-0 bottom-0 z-10 grid h-[var(--altura-abas-celular)] border-t border-borda bg-cabecalho md:hidden"
        style={{
          gridTemplateColumns: `repeat(${abas.length + (extras.length > 0 ? 1 : 0)}, minmax(0, 1fr))`,
        }}
      >
        {abas.map(({ para, curto, rotulo, Icone, fim }) => (
          <NavLink
            key={para}
            to={para}
            end={fim}
            aria-label={rotulo}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[11.5px] font-bold ${isActive ? 'text-moldura' : 'text-texto-suave'}`
            }
          >
            <Icone size={22} aria-hidden />
            <span aria-hidden>{curto}</span>
          </NavLink>
        ))}
        {extras.length > 0 && (
          <button
            type="button"
            aria-expanded={gaveta}
            onClick={() => setGaveta((g) => !g)}
            className={`flex flex-col items-center justify-center gap-1 text-[11.5px] font-bold ${gaveta ? 'text-moldura' : 'text-texto-suave'}`}
          >
            <Ellipsis size={22} aria-hidden />
            {t('menu.mais')}
          </button>
        )}
      </nav>
      {gaveta && (
        <div className="fixed inset-0 z-30 bg-veu md:hidden" onClick={() => setGaveta(false)}>
          <nav
            aria-label={t('menu.mais')}
            className="anim-toast absolute inset-x-0 bottom-0 rounded-t-[24px] bg-superficie p-3 pb-6 shadow-elevada"
            onClick={(e) => e.stopPropagation()}
          >
            {extras.map(({ para, rotulo, Icone }) => (
              <NavLink
                key={para}
                to={para}
                className={({ isActive }) =>
                  `flex h-14 items-center gap-3 rounded-padrao px-4 text-[16px] font-bold ${isActive ? 'bg-moldura/12 text-moldura' : 'hover:bg-creme-escuro'}`
                }
              >
                <Icone size={22} aria-hidden /> {rotulo}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {trocarSenha && <JanelaTrocarSenha aoFechar={() => setTrocarSenha(false)} />}
      {atalhos && <JanelaAtalhos aoFechar={() => setAtalhos(false)} />}
      {tutorial && (
        <Tutorial
          aoFechar={() => {
            setTutorial(false);
            marcarTutorialVisto();
          }}
        />
      )}
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
