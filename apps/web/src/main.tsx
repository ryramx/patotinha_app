import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/pacifico/400.css';
import './estilos/tokens.css';
import './index.css';
import { App } from './App';
import { ProvedorSessao } from './auth/sessao';
import { ProvedorAvisos } from './componentes/Avisos';
import { EsperarServidor } from './componentes/EsperarServidor';
import type { ErroDaApi } from './api/cliente';
import { iniciarTema } from './tema';

// Antes da primeira tela, para não piscar o tema errado.
iniciarTema();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Não insiste em erro de permissão, sessão ou recurso inexistente.
      retry: (tentativas, erro) => {
        const status = (erro as ErroDaApi).status;
        return tentativas < 2 && (status === 0 || status >= 500);
      },
    },
  },
});

// App instalável: o service worker só existe no build de produção.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProvedorAvisos>
          {/* A sessão só é conferida depois que a API acordar. */}
          <EsperarServidor>
            <ProvedorSessao>
              <App />
            </ProvedorSessao>
          </EsperarServidor>
        </ProvedorAvisos>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
