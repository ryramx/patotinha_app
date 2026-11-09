Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 14: testes e qualidade

## O que você vai aprender

- Os três tipos de teste do projeto e o que cada um protege.
- Como os testes usam um PostgreSQL de verdade sem estragar seus dados.
- O que o CI do GitHub confere a cada envio.

## Na tela

Nada aparece para quem usa o sistema. Mas cada critério de aceitação do PRD (CA-01 a CA-20) tem um teste que prova que a tela e a API fazem o combinado. A tabela está em [verificacao.md](../verificacao.md).

## Por trás

| Tipo              | Ferramenta                           | Onde                                   | Exemplo                                                                                                                                                                                   |
| ----------------- | ------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitário          | Vitest                               | `*.test.ts` dentro de `src`            | [`calculo.test.ts`](../../apps/api/src/pedidos/calculo.test.ts), [`dinheiro.test.ts`](../../packages/shared/src/dinheiro.test.ts), [`pix.test.ts`](../../packages/shared/src/pix.test.ts) |
| Integração da API | Vitest + Supertest + PostgreSQL real | [`apps/api/test`](../../apps/api/test) | [`pedidos.test.ts`](../../apps/api/test/pedidos.test.ts): idempotência, preço adulterado, transação                                                                                       |
| Ponta a ponta     | Playwright                           | [`e2e`](../../e2e)                     | [`fluxo-principal.spec.ts`](../../e2e/fluxo-principal.spec.ts): login, pedido do exemplo, fila, cancelamento                                                                              |

### Como a integração usa o banco

[`apps/api/test/ajuda.ts`](../../apps/api/test/ajuda.ts) monta a API inteira com `construirApp`, apontando para `DATABASE_URL_TESTE`, e o Supertest faz requisições HTTP de verdade nela, sem abrir porta. Entre os testes, `limparBanco` esvazia as tabelas com `TRUNCATE` e volta as permissões de fábrica.

### Como o ponta a ponta prepara tudo

[`e2e/preparar.ts`](../../e2e/preparar.ts) roda antes: **apaga e recria** o banco de ponta a ponta, aplica todas as migrações em ordem e cadastra os usuários (admin, funcionário, gerente, chef e dois "novatos" que ainda não viram o tutorial) e o cardápio do exemplo do PRD. Ele se recusa a rodar se o banco for o mesmo do desenvolvimento.

[`playwright.config.ts`](../../playwright.config.ts) testa no computador (1366 x 768) e, para o Novo pedido, também no tablet. No PC do Ryan usa o Edge instalado; no CI, o Chromium.

### O CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) roda a cada envio e em cada pull request:

1. `npm ci` e `npm audit --audit-level=high` (dependência com falha grave trava o CI);
2. `format:check` (Prettier), `lint` (ESLint), `typecheck` (TypeScript);
3. `npm test` com um PostgreSQL 16 de serviço;
4. num segundo job, `npm run test:e2e` com outro PostgreSQL. Se falhar, guarda o relatório do Playwright.

Nada vai para produção com teste falhando (RNF-13), porque o Render só publica o que entra no `main`, e o `main` só recebe PR com o CI verde.

## Conceito novo: pirâmide de testes

Muitos testes **unitários** (rápidos, testam uma função), uma boa quantidade de testes de **integração** (API + banco), e poucos testes de **ponta a ponta** (lentos, mas provam o caminho que a pessoa faz). Na Patotinha: o cálculo do troco tem dezenas de casos unitários; a idempotência é provada na integração; "fazer o pedido do exemplo e ver na fila" é ponta a ponta.

## Por que assim

- **Banco real nos testes**: CHECKs, `ON CONFLICT` e `DISTINCT ON` só se comportam de verdade no PostgreSQL. Um banco falso esconderia erros.
- **Regras puras separadas do banco** (`calculo.ts`): permitem testar todos os ramos em milissegundos.
- **Cada função nova traz o seu teste e o seu critério** (CA-13 comanda, CA-15 clientes, CA-17 Pix, CA-19 pagar depois…).

## Experimente

```powershell
npm test              # unitários e integração
npm run test:e2e      # ponta a ponta (precisa de DATABASE_URL_TESTE no .env)
```

Depois quebre algo de propósito: em `calculo.ts`, troque `valorRecebidoCentavos < totalCentavos` por `<=`. Rode `npm test` e veja qual teste pega o erro. Desfaça a mudança.

## Para conferir

<details><summary>1. Por que o e2e se recusa a rodar no banco de desenvolvimento?</summary>

Porque ele apaga o banco inteiro antes de começar.
</details>

<details><summary>2. O que acontece se uma dependência tiver uma falha de segurança grave?</summary>

O `npm audit --audit-level=high` falha e o CI fica vermelho.
</details>

<details><summary>3. Onde está a lista de critérios de aceitação e o teste de cada um?</summary>

Em `docs/verificacao.md`.
</details>

## Fontes

- [verificacao.md](../verificacao.md)
- [Vitest](https://vitest.dev/), [Supertest](https://github.com/ladjs/supertest), [Playwright](https://playwright.dev/)
- [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
