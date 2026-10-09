# Imagem única da aplicação (PRD 7.3 e 7.4): a API serve as telas já compiladas.

# ---------- Fase 1: compila shared, web e api ----------
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build

# ---------- Fase 2: só o necessário para rodar ----------
FROM node:24-slim AS producao
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PASTA_WEB=/app/web \
    PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api --workspace packages/shared --include-workspace-root=false \
  && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /app/apps/web/dist web
USER node
EXPOSE 3000
WORKDIR /app/apps/api
# Aplica as migrações pendentes e sobe a API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/servidor.js"]
