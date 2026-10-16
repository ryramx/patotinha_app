# Sistema de Pedidos · Patotinha da Vovó

Sistema web de balcão: registra pedidos, calcula o total no servidor, grava a forma de pagamento
e mostra o histórico e um resumo das vendas. Segue o PRD, a descrição da interface e o plano de
desenvolvimento do projeto.

- **Backend:** Node.js + Fastify + Prisma (`apps/api`), API REST em `/api`
- **Frontend:** React + Vite + Tailwind CSS + TanStack Query (`apps/web`)
- **Compartilhado:** esquemas Zod, tipos e formatação de R$ e datas (`packages/shared`)
- **Banco:** PostgreSQL (Neon em produção; 16 ou mais novo em desenvolvimento)

## Requisitos

- Node.js 22 LTS ou mais novo (testado com o 24 LTS) e npm
- PostgreSQL 16+ instalado no computador **ou** Docker Desktop com Docker Compose
- Git

## Primeira instalação (PostgreSQL instalado no computador)

```powershell
npm install
copy .env.example .env      # depois preencha DATABASE_URL, DATABASE_URL_TESTE e JWT_SECRET
powershell -ExecutionPolicy Bypass -File scripts\criar-banco-local.ps1   # pede a senha do "postgres"
npm run db:migrate          # aplica as migrações em DATABASE_URL
npm run seed:admin          # cria o primeiro administrador (pede nome, login e senha)
npm run seed:dev            # opcional: cardápio de exemplo e a funcionária de teste "maria"
npm run dev                 # API em http://localhost:3000 e telas em http://localhost:5173
```

O script `criar-banco-local.ps1` lê usuário e senha da `DATABASE_URL` do `.env` e cria esse
usuário no PostgreSQL **sem** permissão de superusuário, mais os bancos `patotinha` e
`patotinha_teste`. Nenhuma senha fica no código: o primeiro administrador é criado pelo
`seed:admin`, com a senha digitada na hora.

## Com Docker

```bash
cp .env.example .env        # defina POSTGRES_PASSWORD e JWT_SECRET
docker compose up --build   # sobe o PostgreSQL 16 e a aplicação em http://localhost:3000
docker compose exec app npm run seed:admin
```

## Variáveis de ambiente

| Variável             | Para quê                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`       | Conexão com o banco da aplicação                                          |
| `DATABASE_URL_TESTE` | Banco só dos testes automáticos (é apagado e recriado a cada rodada)      |
| `JWT_SECRET`         | Segredo da sessão: texto longo e aleatório (32+ caracteres em produção)   |
| `NODE_ENV`           | `development`, `production` ou `test`                                     |
| `APP_ORIGIN`         | Endereço pelo qual o sistema é acessado                                   |
| `TZ`                 | `America/Sao_Paulo`                                                       |
| `PORT`               | Porta da API (padrão 3000)                                                |
| `PASTA_WEB`          | Pasta com o build das telas, servida pela API (a imagem Docker já define) |

## Publicação (Render + Neon, planos gratuitos)

O Render roda a aplicação (imagem Docker do `Dockerfile`, descrita no `render.yaml`) e o banco
fica num projeto do Neon na região us-east-2 (Ohio), a mesma do app. A cada publicação a imagem
aplica as migrações pendentes antes de subir.

1. **Neon:** criar um projeto (região AWS us-east-2) e copiar o endereço de conexão **direto**
   (desligar "Connection pooling", sem `-pooler` no servidor), terminado em `?sslmode=require`.
2. **Render:** New > Blueprint, escolher este repositório. Ele pede só a `DATABASE_URL`: colar o
   endereço do Neon. O `JWT_SECRET` é gerado pelo Render.
3. **GitHub** (Settings > Secrets and variables > Actions): criar `PRODUCAO_DATABASE_URL` com o
   mesmo endereço e `ADMIN_SENHA` com a senha do primeiro administrador.
4. **Primeiro admin:** aba Actions > "Criar primeiro admin" > Run workflow, com nome e login.
   Depois de entrar no sistema, apagar o segredo `ADMIN_SENHA`.
5. **Monitor:** apontar um serviço de monitoramento (ex.: cron-job.org) para `/api/vivo` a cada
   10 minutos, só no horário da loja. Essa rota não consulta o banco, então o Neon continua
   podendo desligar quando parado. O `/api/saude` testa o banco também, para conferências.

Limites do plano gratuito: o app do Render desliga depois de 15 minutos sem acesso e leva cerca
de 1 minuto para voltar (o monitor evita isso no horário da loja); as 750 horas mensais do Render
são divididas entre todos os apps gratuitos da conta. O Neon tem 1 GB e 100 horas de
processamento por mês, desligando depois de 5 minutos parado.

### Backup e restauração

O workflow "Backup do banco" (`.github/workflows/backup.yml`) roda todo dia às 3h (Brasília):
copia o banco com `pg_dump`, restaura a cópia num PostgreSQL vazio, confere as contagens e guarda
o arquivo por 30 dias na aba Actions. Para rodar na hora: Actions > Backup do banco > Run workflow.

Para restaurar: baixar o arquivo `patotinha-AAAA-MM-DD.dump` da execução desejada (vem dentro de
um .zip) e, num banco vazio (por exemplo, um branch novo do Neon), rodar:

```bash
pg_restore --no-owner --no-privileges --exit-on-error -d "ENDERECO_DO_BANCO_VAZIO" patotinha-AAAA-MM-DD.dump
```

Conferir os pedidos do dia e só então trocar a `DATABASE_URL` no Render para o banco restaurado.
Repetir esse teste a cada 3 meses (plano 7.6).

## Testes e qualidade

```powershell
npm run lint          # ESLint
npm run format        # Prettier (o VS Code formata ao salvar)
npm run typecheck     # TypeScript em todos os pacotes
npm test              # unitários + integração da API contra o PostgreSQL (DATABASE_URL_TESTE)
npm run test:e2e      # ponta a ponta com Playwright (usa o Edge instalado no Windows)
```

O CI (`.github/workflows/ci.yml`) roda tudo isso com um PostgreSQL 16 de serviço, mais
`npm audit`, a cada envio.

## Estrutura

```text
apps/api/        Fastify + Prisma. Módulos: auth, usuarios, cardapio, pedidos, relatorios
  prisma/        schema.prisma e migrações (DDL do PRD 15.5, com CHECKs e gatilhos)
  scripts/       seed-dev.ts (o seed-admin fica em src/scripts para rodar também no servidor)
  test/          testes de integração (Supertest) contra PostgreSQL real
apps/web/        React. telas/, componentes/, layout/, estilos/tokens.css, textos.pt-BR.json
packages/shared/ Esquemas Zod usados na tela e na API, tipos e formatação
e2e/             Testes Playwright (fluxo do pedido do exemplo, tablet, preço alterado)
```

## Logo e ícones

A arte original da família está em `docs/marca/logo-original.png`. Para refazer a logo das telas,
os ícones do app instalável e o favicon depois de trocar a arte:

```
python3 scripts/recortar-logo.py docs/marca/logo-original.png docs/marca/logo-transparente.png
python3 scripts/gerar-icones.py docs/marca/logo-transparente.png apps/web/public
```

Ao trocar os ícones, suba a `VERSAO` em `apps/web/public/sw.js` para os aparelhos buscarem os novos.

## Pendências conhecidas

- As decisões pendentes do PRD (seção 20) seguem a sugestão do próprio PRD; os limites de campo
  seguem a tabela final do plano (quantidade 1 a 99, nome de produto 2 a 80, categoria 2 a 40,
  login 3 a 30 só minúsculas, motivo 5 a 200, preço até R$ 9.999,99).
- Publicação (etapa 7 do plano): os arquivos estão prontos; falta criar as contas e seguir os
  passos da seção Publicação.
