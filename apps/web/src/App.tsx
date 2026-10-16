import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSessao } from './auth/sessao';
import { Moldura } from './layout/Moldura';
import { Login } from './telas/Login';
import { Inicio } from './telas/Inicio';
import { NovoPedido } from './telas/novo-pedido/NovoPedido';
import { Historico } from './telas/Historico';
import { DetalhePedido } from './telas/DetalhePedido';
import { Fila } from './telas/Fila';
import { Resumo } from './telas/Resumo';
import { Produtos } from './telas/cadastros/Produtos';
import { Categorias } from './telas/cadastros/Categorias';
import { Usuarios } from './telas/cadastros/Usuarios';
import { Vazio } from './componentes/Diversos';
import { t } from './textos';

function Carregando() {
  return (
    <div className="flex h-full items-center justify-center bg-moldura">
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

/** Telas de administrador: escondidas do menu e bloqueadas aqui; a API também bloqueia. */
function ExigeAdmin({ children }: { children: ReactNode }) {
  const { eAdmin } = useSessao();
  if (!eAdmin) return <Vazio texto={t('erro.semPermissao')} />;
  return children;
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
        <Route index element={<Inicio />} />
        <Route path="pedidos/novo" element={<NovoPedido />} />
        <Route path="pedidos" element={<Historico />} />
        <Route path="pedidos/:id" element={<DetalhePedido />} />
        <Route path="fila" element={<Fila />} />
        <Route
          path="resumo"
          element={
            <ExigeAdmin>
              <Resumo />
            </ExigeAdmin>
          }
        />
        <Route
          path="produtos"
          element={
            <ExigeAdmin>
              <Produtos />
            </ExigeAdmin>
          }
        />
        <Route
          path="categorias"
          element={
            <ExigeAdmin>
              <Categorias />
            </ExigeAdmin>
          }
        />
        <Route
          path="usuarios"
          element={
            <ExigeAdmin>
              <Usuarios />
            </ExigeAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
