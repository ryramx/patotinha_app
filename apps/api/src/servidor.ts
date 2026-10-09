import { construirApp } from './app.js';
import { criarBanco } from './banco.js';
import { lerConfig } from './config.js';

const config = lerConfig();
const app = await construirApp({ config, banco: criarBanco(config.databaseUrl) });

const encerrar = async (sinal: string) => {
  app.log.info({ sinal }, 'encerrando');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));

try {
  await app.listen({
    port: config.porta,
    // "localhost" escuta em IPv4 e IPv6; só 127.0.0.1 faz o navegador perder ~200 ms tentando ::1.
    host: config.ambiente === 'production' ? '0.0.0.0' : 'localhost',
  });
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
