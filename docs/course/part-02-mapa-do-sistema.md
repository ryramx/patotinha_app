Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 02: mapa do sistema

## O que você vai aprender

- As peças do sistema e onde cada uma roda.
- Como uma requisição viaja do toque na tela até o banco e volta.
- Como o repositório está dividido em pastas (monorepo).

## Na tela

A pessoa abre `https://patotinha-da-vovo.onrender.com` no navegador ou no app instalado. Ela não vê as peças, mas cada toque passa por elas.

## Por trás

### As peças

```text
 Navegador (computador, tablet, celular)
   │  telas React (apps/web), guardadas pelo service worker
   ▼
 Site: Static Site do Render "patotinha-da-vovo" (CDN, nunca dorme)
   │  /api/*  → repassado (rewrite) para a API, no mesmo endereço
   ▼
 API: serviço Docker do Render "patotinha-pedidos" (Fastify, dorme após 15 min)
   │  Prisma
   ▼
 Banco: PostgreSQL no Neon (us-east-2, Ohio)
```

| Peça                    | Onde está no código                                                  | O que faz                                          |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Telas                   | [`apps/web`](../../apps/web)                                         | React + Vite + Tailwind + TanStack Query           |
| API                     | [`apps/api`](../../apps/api)                                         | Fastify, regras de negócio, permissões             |
| Banco                   | [`apps/api/prisma`](../../apps/api/prisma)                           | Schema e migrações do PostgreSQL                   |
| Compartilhado           | [`packages/shared`](../../packages/shared)                           | Esquemas Zod, tipos, dinheiro, datas, Pix, perfis  |
| Testes de ponta a ponta | [`e2e`](../../e2e)                                                   | Playwright, simulando a pessoa no navegador        |
| Publicação              | [`render.yaml`](../../render.yaml), [`Dockerfile`](../../Dockerfile) | Os dois serviços do Render                         |
| Rotinas                 | [`.github/workflows`](../../.github/workflows)                       | CI, backup diário, criar admin, cadastrar cardápio |

### O caminho de uma requisição

Exemplo: a cozinha toca em "Marcar pronto".

1. A tela [`Fila.tsx`](../../apps/web/src/telas/Fila.tsx) chama `api('/pedidos/12/preparo', { metodo: 'PATCH', corpo: { status: 'PRONTO' } })`.
2. A função `api` de [`apps/web/src/api/cliente.ts`](../../apps/web/src/api/cliente.ts) faz o `fetch` para `/api/pedidos/12/preparo`, mandando o cookie de sessão.
3. O site do Render vê que o caminho começa com `/api/` e repassa para `patotinha-pedidos.onrender.com` (regra `rewrite` no [`render.yaml`](../../render.yaml)).
4. Na API, [`app.ts`](../../apps/api/src/app.ts) confere que a escrita veio como JSON, e a rota em [`pedidos/rotas.ts`](../../apps/api/src/pedidos/rotas.ts) roda antes o `app.exigir('FILA')`: o usuário está logado e o perfil dele tem a permissão "Fila de preparo"?
5. A rota valida o corpo com o esquema Zod `esquemaPreparo` (de `packages/shared`), atualiza o pedido pelo Prisma e devolve o pedido em JSON.
6. A tela recebe a resposta e manda o TanStack Query buscar a fila de novo.

### Por que um pacote compartilhado

As mesmas regras de formato valem na tela e na API. Por exemplo, `esquemaNovoPedido` em [`packages/shared/src/esquemas.ts`](../../packages/shared/src/esquemas.ts) é usado pelo formulário para avisar antes de enviar e pela API para recusar dados errados. Escrever uma vez evita que as duas pontas discordem.

## Conceito novo: monorepo com workspaces

Um **monorepo** é um repositório só com vários pacotes. Aqui, o [`package.json`](../../package.json) da raiz declara `"workspaces": ["packages/*", "apps/*"]`. O npm instala tudo junto e liga `@patotinha/shared` dentro de `apps/web` e `apps/api` como se fosse um pacote publicado.

Por isso o comando `npm run dev` da raiz primeiro compila o `shared` e depois sobe API e telas ao mesmo tempo.

## Por que assim

- **Site e API separados**: o site estático nunca dorme e abre na hora; só a API dorme. Antes (até a etapa 9) a própria API servia as telas, e a pessoa via a tela de espera do Render. Ver [site-separado.md](../site-separado.md).
- **Mesmo endereço para site e API** (o `rewrite`): o cookie de login fica na mesma origem, com `SameSite=Strict`, e não precisa de CORS.
- **Ohio**: a API fica na mesma região do banco, para cada consulta ser rápida.

## Experimente

Abra o [`render.yaml`](../../render.yaml) e ache as duas regras `rewrite` do site. Explique com suas palavras por que a de `/api/*` vem antes da de `/*`.

## Para conferir

<details><summary>1. Qual peça nunca dorme?</summary>

O site (Static Site do Render). Só a API dorme.
</details>

<details><summary>2. Onde fica o esquema que valida um novo pedido, e quem usa?</summary>

Em `packages/shared/src/esquemas.ts` (`esquemaNovoPedido`). Usam a tela e a API.
</details>

<details><summary>3. Por que o site repassa /api para a API em vez de a tela chamar a API direto?</summary>

Para tudo ficar no mesmo endereço: o cookie de sessão continua `SameSite=Strict` e não é preciso liberar CORS.
</details>

## Fontes

- [README, seções Tecnologias e Estrutura](../../README.md)
- [site-separado.md](../site-separado.md)
- [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)
- [Render: redirects e rewrites](https://render.com/docs/redirects-rewrites)
