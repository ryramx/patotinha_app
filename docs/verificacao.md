# Verificação do MVP (etapa 6 do plano)

Executado em 08/10/2026 no PC de desenvolvimento (Windows 11, Node 24, PostgreSQL 18 local, Edge).

## Como repetir

```powershell
npm test           # 96 testes: unitários (cálculo, troco, datas) e integração da API contra o PostgreSQL
npm run test:e2e   # 11 testes Playwright: computador 1366 x 768 e tablet 1180 x 820
```

Resultado desta execução: **96 de 96** (API e shared) e **11 de 11** (ponta a ponta).

## 6.2 Critérios de aceitação e onde cada um é coberto

| Critério                    | Teste automático                                                                                | Roteiro manual no piloto                                |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| CA-01 Login                 | `apps/api/test/auth.test.ts` (6 cenários) e `e2e/fluxo-principal.spec.ts` (mensagem única, 403) | —                                                       |
| CA-02 Categorias            | `apps/api/test/cardapio.test.ts` › CA-02                                                        | Desativar "Doces" e conferir as abas no Novo pedido     |
| CA-03 Produtos              | `apps/api/test/cardapio.test.ts` › CA-03                                                        | —                                                       |
| CA-04 Alteração de preço    | `cardapio.test.ts` › CA-04 e `e2e/tela-novo-pedido.spec.ts` › CA-04 (duas janelas)              | —                                                       |
| CA-05 Montagem do pedido    | `e2e/fluxo-principal.spec.ts` (3 linhas, R$ 33,00, − e +) e `pedidos.test.ts` (quantidades)     | —                                                       |
| CA-06 Pagamento             | `e2e/fluxo-principal.spec.ts` (troco R$ 17,00, "Faltam R$ 3,00") e `pedidos.test.ts`            | —                                                       |
| CA-07 Finalização           | `pedidos.test.ts` (idempotência, transação, preço adulterado, soma) e `fluxo-principal.spec.ts` | Clique duplo no balcão                                  |
| CA-08 Histórico e detalhe   | `pedidos.test.ts` › CA-08 e `fluxo-principal.spec.ts` › CA-08                                   | Filtro "Ontem" + PIX com dados reais                    |
| CA-09 Cancelamento          | `pedidos.test.ts` › CA-09 e `fluxo-principal.spec.ts` › CA-09 e CA-10                           | —                                                       |
| CA-10 Resumo de vendas      | `relatorios.test.ts` (R$ 68,00, cartão, 23h50, zeros, volume de um mês)                         | Comparar o resumo diário com o caixa (piloto)           |
| CA-11 Usuários              | `usuarios.test.ts` e `fluxo-principal.spec.ts` (menu do funcionário)                            | —                                                       |
| CA-13 Comanda (nome e fila) | `comanda.test.ts` (9 cenários) e `fluxo-principal.spec.ts` › Comanda (16/10/2026)               | Tablet na cozinha com a fila aberta durante o piloto    |
| CA-15 Clientes (sugestão)   | `clientes.test.ts` (9 cenários) e `pedido-clientes.spec.ts` (17/10/2026)                        | Ver se os nomes se repetem no piloto                    |
| CA-16 Tutorial e lâmpadas   | `auth.test.ts` › Tutorial e `tutorial.spec.ts` (cards por perfil, lâmpada) (17/10/2026)         | Pessoa nova faz o tutorial sozinha no piloto            |
| CA-12 Operação              | Repositório sem segredos (conferido abaixo)                                                     | HTTPS e restauração de backup: etapa 7, ainda não feita |

## 6.3 Telas em computador e tablet

- Novo pedido testado em 1366 x 768 (computador) e 1180 x 820 com toque (tablet na horizontal), no
  Edge (motor Chromium). O CI roda no Chromium.
- **Pendente:** Safari (só no iPad ou Mac) e Chrome em tablet de verdade, durante o piloto.

## 6.4 Segurança (PRD 10)

| Item                              | Situação                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Senha com Argon2id                | Sim (`apps/api/src/auth/senha.ts`); a API nunca devolve a senha nem o hash (testado)                                 |
| Cookie httpOnly, Secure, SameSite | Sim, `sessao` com 12 h (testado em `auth.test.ts`)                                                                   |
| Limite de login                   | 5 erros por minuto por IP e por usuário, resposta 429 (testado)                                                      |
| Permissões por rota               | `exigirAdmin` em todas as rotas de administrador (403 testado)                                                       |
| Usuário desativado perde a sessão | Sim, conferido a cada requisição (testado)                                                                           |
| CSRF                              | SameSite=Strict + escrita só com `application/json` (415 testado)                                                    |
| Validação de entrada              | Zod em corpo, parâmetros e filtros; campos desconhecidos recusados (testado)                                         |
| SQL injection                     | Só Prisma e `$queryRaw` com parâmetros; nenhum SQL montado com texto do usuário                                      |
| Cabeçalhos de segurança           | Helmet com CSP (testado)                                                                                             |
| Segredos fora do repositório      | `.env` no `.gitignore`; só `.env.example` sem valores. As senhas em `e2e/dados.ts` existem apenas no banco de testes |
| Usuário do banco sem superusuário | `patotinha_app` criado com NOSUPERUSER                                                                               |
| `npm audit`                       | 0 vulnerabilidades                                                                                                   |
| HTTPS                             | Etapa 7 (publicação)                                                                                                 |

## 6.5 Tempos medidos

| Requisito                                           | Meta       | Medido                                                         |
| --------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| RNF-02 Finalizar pedido                             | ≤ 1 s      | Login ~130 ms; gravação de pedido bem abaixo de 1 s nos testes |
| RNF-03 Histórico e resumo de um mês (9.000 pedidos) | ≤ 2 s      | Passou no teste `relatorios.test.ts`                           |
| RNF-04 Novo pedido após o login                     | ≤ 2 s      | Passou em computador e tablet (teste e2e)                      |
| RNF-09 Pedido de 3 itens                            | ≤ 8 toques | 5 toques (3 produtos, pagamento, finalizar)                    |

## 6.6 Teste com pessoa nova (RNF-08)

**Pendente:** pedir a alguém que nunca viu o sistema para registrar o pedido do exemplo depois de
até 15 minutos de explicação.
