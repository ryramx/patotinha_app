import path from 'node:path';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import type { Banco } from './banco.js';
import type { Config } from './config.js';
import { ErroApp, tratadorDeErros } from './erros.js';
import pluginAutenticacao from './auth/plugin.js';
import { rotasAuth } from './auth/rotas.js';
import { LimiteLogin } from './auth/limite-login.js';
import { rotasUsuarios } from './usuarios/rotas.js';
import { rotasPerfis } from './perfis/rotas.js';
import { rotasCategorias } from './cardapio/rotas-categorias.js';
import { rotasProdutos } from './cardapio/rotas-produtos.js';
import { rotasPedidos } from './pedidos/rotas.js';
import { rotasRelatorios } from './relatorios/rotas.js';
import { rotasClientes } from './clientes/rotas.js';

declare module 'fastify' {
  interface FastifyInstance {
    banco: Banco;
  }
}

export interface OpcoesApp {
  config: Config;
  banco: Banco;
  logger?: FastifyServerOptions['logger'];
  limiteLogin?: LimiteLogin;
}

/** Nunca registrar senha, hash, token ou cookie (PRD 7.2). */
export const opcoesLog = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.senha',
      '*.senhaAtual',
      '*.novaSenha',
      '*.senhaHash',
    ],
    censor: '[oculto]',
  },
};

export async function construirApp(opcoes: OpcoesApp): Promise<FastifyInstance> {
  const { config, banco } = opcoes;
  const app = Fastify({
    logger: opcoes.logger ?? opcoesLog,
    disableRequestLogging: true,
    trustProxy: config.ambiente === 'production',
    bodyLimit: 256 * 1024,
  });

  await app.register(
    fp(
      async (instancia) => {
        instancia.decorate('banco', banco);
      },
      { name: 'banco' },
    ),
  );

  // Um registro por requisição, com rota, status, tempo e usuário (PRD 7.2).
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        metodo: request.method,
        rota: request.routeOptions.url ?? request.url,
        status: reply.statusCode,
        tempoMs: Math.round(reply.elapsedTime),
        usuarioId: request.usuario ? Number(request.usuario.id) : undefined,
      },
      'requisição',
    );
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  });
  await app.register(fastifyCookie);
  await app.register(pluginAutenticacao, { segredo: config.jwtSecret });

  app.setErrorHandler(tratadorDeErros);

  await app.register(
    async (api) => {
      // Escritas só com JSON: junto com SameSite=Strict, protege contra CSRF (PRD 10).
      api.addHook('onRequest', async (request) => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
          const tipo = request.headers['content-type'] ?? '';
          if (!tipo.toLowerCase().startsWith('application/json')) {
            throw new ErroApp(415, 'CONTENT_TYPE_INVALIDO', 'Envie os dados como application/json');
          }
        }
      });

      // Respostas da API nunca ficam guardadas: o site repassa /api pela CDN do Render (etapa 9).
      api.addHook('onSend', async (_request, reply) => {
        reply.header('Cache-Control', 'no-store');
      });

      // Para o monitor externo: não toca no banco, para o Neon poder desligar quando parado.
      api.get('/vivo', async () => ({ status: 'ok' }));

      api.get('/saude', async (_request, reply) => {
        try {
          await banco.$queryRaw`SELECT 1`;
          return { status: 'ok', banco: 'ok' };
        } catch {
          return reply.status(503).send({ status: 'erro', banco: 'indisponivel' });
        }
      });

      await api.register(rotasAuth, { limite: opcoes.limiteLogin ?? new LimiteLogin() });
      await api.register(rotasUsuarios);
      await api.register(rotasPerfis);
      await api.register(rotasCategorias);
      await api.register(rotasProdutos);
      await api.register(rotasPedidos);
      await api.register(rotasRelatorios);
      await api.register(rotasClientes);

      api.setNotFoundHandler((_request, reply) => {
        reply
          .status(404)
          .send({ erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Endereço não encontrado' } });
      });
    },
    { prefix: '/api' },
  );

  // Telas no Static Site: o endereço antigo leva para o novo, mantendo o caminho.
  if (config.siteUrl) {
    const siteUrl = config.siteUrl;
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api')) {
        return reply.redirect(`${siteUrl}${request.url}`, 302);
      }
      return reply
        .status(404)
        .send({ erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Endereço não encontrado' } });
    });
  }

  // Sem SITE_URL, a própria API serve as telas (mesma origem, sem CORS; PRD 7.3).
  // É assim no Docker local e nos testes de ponta a ponta.
  const pastaWeb = config.pastaWeb ? path.resolve(config.pastaWeb) : null;
  if (!config.siteUrl && pastaWeb && existsSync(path.join(pastaWeb, 'index.html'))) {
    await app.register(fastifyStatic, { root: pastaWeb, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      return reply
        .status(404)
        .send({ erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Endereço não encontrado' } });
    });
  }

  app.addHook('onClose', async () => {
    await banco.$disconnect();
  });

  return app;
}
