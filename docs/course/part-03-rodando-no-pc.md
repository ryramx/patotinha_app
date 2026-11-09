Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 03: rodando no PC

## O que você vai aprender

- O que precisa estar instalado.
- Como preparar o banco local, criar o primeiro administrador e subir o sistema.
- Para que serve cada variável do `.env`.

## Na tela

Depois dos passos abaixo, `http://localhost:5173` abre a tela de login. Com o `seed:dev`, aparece um cardápio de exemplo e a funcionária de teste "maria".

## Por trás

### Requisitos

- Node.js 22 LTS ou mais novo (o projeto usa o 24) e npm.
- PostgreSQL 16 ou mais novo instalado no PC (o desenvolvimento usa o 18), **ou** Docker Desktop.
- Git.

### Primeira instalação (Windows, PostgreSQL no PC)

```powershell
npm install
copy .env.example .env      # preencha DATABASE_URL, DATABASE_URL_TESTE e JWT_SECRET
powershell -ExecutionPolicy Bypass -File scripts\criar-banco-local.ps1
npm run db:migrate          # cria as tabelas (migrações do Prisma)
npm run seed:admin          # cria o primeiro administrador (pede nome, login e senha)
npm run seed:dev            # opcional: cardápio de exemplo e a funcionária "maria"
npm run dev                 # API em http://localhost:3000 e telas em http://localhost:5173
```

O que cada passo faz:

| Passo                   | Arquivo                                                                          | O que acontece                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `criar-banco-local.ps1` | [`scripts/criar-banco-local.ps1`](../../scripts/criar-banco-local.ps1)           | Lê usuário e senha da `DATABASE_URL` e cria esse usuário **sem** superusuário, mais os bancos `patotinha` e `patotinha_teste` |
| `db:migrate`            | [`apps/api/prisma/migrations`](../../apps/api/prisma/migrations)                 | Aplica as migrações na ordem da data no nome da pasta                                                                         |
| `seed:admin`            | [`apps/api/src/scripts/seed-admin.ts`](../../apps/api/src/scripts/seed-admin.ts) | Grava o administrador com a senha em Argon2id                                                                                 |
| `seed:dev`              | [`apps/api/scripts/seed-dev.ts`](../../apps/api/scripts/seed-dev.ts)             | Dados de exemplo, só para desenvolvimento                                                                                     |
| `dev`                   | [`package.json`](../../package.json)                                             | Compila o `shared` e sobe API e telas juntas com `concurrently`                                                               |

No modo `dev`, o Vite (em `5173`) repassa `/api` para a API (em `3000`), imitando o que o Render faz em produção. Veja [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts).

### Com Docker

```bash
cp .env.example .env        # defina POSTGRES_PASSWORD e JWT_SECRET
docker compose up --build   # PostgreSQL 16 e o sistema em http://localhost:3000
docker compose exec app npm run seed:admin
```

### As variáveis do `.env`

O modelo comentado é o [`.env.example`](../../.env.example). As principais:

| Variável             | Para quê                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`       | Banco da aplicação                                                |
| `DATABASE_URL_TESTE` | Banco só dos testes (é apagado e recriado a cada rodada)          |
| `JWT_SECRET`         | Segredo que assina o token de sessão (32+ caracteres em produção) |
| `TZ`                 | `America/Sao_Paulo`                                               |
| `SITE_URL`           | Só em produção; no PC fica vazio e a API serve as telas           |

A API lê tudo isso em [`apps/api/src/config.ts`](../../apps/api/src/config.ts). Se faltar uma obrigatória, ela nem sobe e diz qual falta.

## Conceito novo: migração de banco

Uma **migração** é um arquivo SQL que muda a estrutura do banco de um jeito versionado. Cada função nova que precisou de coluna ou tabela ganhou a sua, por exemplo `20261019000000_pix` criou a tabela `config_pix`.

O nome começa com a data para todo mundo aplicar na mesma ordem. O Prisma guarda no próprio banco quais já rodaram, então `db:migrate` só aplica as novas. Em produção, a imagem Docker roda `prisma migrate deploy` antes de subir a API ([`Dockerfile`](../../Dockerfile)).

## Por que assim

- **Usuário do banco sem superusuário**: se alguém conseguir mandar SQL pela aplicação, não consegue apagar o servidor inteiro nem criar outros usuários.
- **Senha do admin digitada na hora**: nenhuma senha fica no código ou no repositório.
- **Banco de teste separado**: os testes podem apagar tudo sem tocar nos seus dados de desenvolvimento.

## Experimente

1. Rode `npm run dev` e entre com o administrador que você criou.
2. Abra `http://localhost:3000/api/vivo` no navegador. Deve aparecer `{"status":"ok"}`.
3. Abra `http://localhost:3000/api/saude`. Essa testa o banco também. Pare o PostgreSQL e abra de novo: deve virar `503`.

## Para conferir

<details><summary>1. O que acontece se o JWT_SECRET estiver vazio?</summary>

A API não sobe: `lerConfig()` lança um erro dizendo que a variável não foi definida.
</details>

<details><summary>2. Qual a diferença entre /api/vivo e /api/saude?</summary>

`/api/vivo` responde sem tocar no banco (para o monitor não acordar o Neon à toa). `/api/saude` faz `SELECT 1` no banco.
</details>

<details><summary>3. Por que existem dois bancos locais?</summary>

`patotinha` para usar o sistema e `patotinha_teste` para os testes automáticos, que apagam e recriam tudo.
</details>

## Fontes

- [README, seções Primeira instalação e Variáveis de ambiente](../../README.md)
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
