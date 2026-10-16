// Service worker do app instalável. Guarda só os arquivos das telas para abrir rápido;
// nunca guarda respostas da API: pedidos e preços vêm sempre do servidor (PRD 7 e D-18).
const VERSAO = 'patotinha-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Arquivos com hash no nome não mudam: cache primeiro.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icones/')) {
    evento.respondWith(
      caches.match(pedido).then(
        (salvo) =>
          salvo ||
          fetch(pedido).then((resposta) => {
            const copia = resposta.clone();
            caches.open(VERSAO).then((c) => c.put(pedido, copia));
            return resposta;
          }),
      ),
    );
    return;
  }

  // Páginas: rede primeiro, e a última versão salva se a rede falhar.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(VERSAO).then((c) => c.put('/', copia));
          return resposta;
        })
        .catch(() => caches.match('/')),
    );
  }
});
