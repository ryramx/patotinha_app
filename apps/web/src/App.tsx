import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Permissao } from '@patotinha/shared';
import { telaInicial, useSessao } from './auth/sessao';
import { Moldura } from './layout/Moldura';
import { Login } from './telas/Login';
import { Inicio } from './telas/Inicio';
import { NovoPedido } from './telas/novo-pedido/NovoPedido';
import { Historico } from './telas/Historico';
import { DetalhePedido } from './telas/DetalhePedido';
import { Fila } from './telas/Fila';
import { AReceber } from './telas/AReceber';
import { Resumo } from './telas/Resumo';
import { Produtos } from './telas/cadastros/Produtos';
import { Categorias } from './telas/cadastros/Categorias';
import { Usuarios } from './telas/cadastros/Usuarios';
import { Perfis } from './telas/cadastros/Perfis';
import { PixLoja } from './telas/cadastros/PixLoja';
import { Vazio } from './componentes/Diversos';
import { t } from './textos';

function Carregando() {
  return (
    <div className="flex h-full items-center justify-center bg-marca">
      <img src="/logo.webp" alt="Patotinha da Vovó" className="w-40 animate-pulse" />
    </div>
  );
}

function ExigeLogin({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useSessao();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return children;
}

/** Telas fora do perfil: escondidas do menu e bloqueadas aqui; a API também bloqueia. */
function Exige({ permissao, children }: { permissao: Permissao | 'ADMIN'; children: ReactNode }) {
  const { eAdmin, pode } = useSessao();
  const liberado = permissao === 'ADMIN' ? eAdmin : pode(permissao);
  if (!liberado) return <Vazio texto={t('erro.semPermissao')} />;
  return children;
}

/** Início mostra pedidos e números do dia; sem isso no perfil, vai para a tela dele. */
function TelaInicio() {
  const { usuario, pode } = useSessao();
  if (usuario && !pode('PEDIDOS_VER') && !pode('FINANCEIRO')) {
    const destino = telaInicial(usuario);
    if (destino !== '/') return <Navigate to={destino} replace />;
  }
  return <Inicio />;
}

export function App() {
  const { carregando } = useSessao();
  if (carregando) return <Carregando />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ExigeLogin>
            <Moldura />
          </ExigeLogin>
        }
      >
        <Route index element={<TelaInicio />} />
        <Route
          path="pedidos/novo"
          element={
            <Exige permissao="PEDIDOS_REGISTRAR">
              <NovoPedido />
            </Exige>
          }
        />
        <Route
          path="pedidos"
          element={
            <Exige permissao="PEDIDOS_VER">
              <Historico />
            </Exige>
          }
        />
        <Route
          path="pedidos/:id"
          element={
            <Exige permissao="PEDIDOS_VER">
              <DetalhePedido />
            </Exige>
          }
        />
        <Route
          path="receber"
          element={
            <Exige permissao="PEDIDOS_REGISTRAR">
              <AReceber />
            </Exige>
          }
        />
        <Route
          path="fila"
          element={
            <Exige permissao="FILA">
              <Fila />
            </Exige>
          }
        />
        <Route
          path="resumo"
          element={
            <Exige permissao="FINANCEIRO">
              <Resumo />
            </Exige>
          }
        />
        <Route
          path="produtos"
          element={
            <Exige permissao="CARDAPIO">
              <Produtos />
            </Exige>
          }
        />
        <Route
          path="categorias"
          element={
            <Exige permissao="CARDAPIO">
              <Categorias />
            </Exige>
          }
        />
        <Route
          path="usuarios"
          element={
            <Exige permissao="USUARIOS">
              <Usuarios />
            </Exige>
          }
        />
        <Route
          path="perfis"
          element={
            <Exige permissao="ADMIN">
              <Perfis />
            </Exige>
          }
        />
        <Route
          path="pix"
          element={
            <Exige permissao="ADMIN">
              <PixLoja />
            </Exige>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
