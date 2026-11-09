Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 06: cardápio (categorias e produtos)

## O que você vai aprender

- Como categorias e produtos são cadastrados, alterados e desativados.
- O que acontece com os pedidos antigos quando um preço muda.
- Como o cardápio oficial chega ao banco de produção sem digitar produto por produto.

## Na tela

1. **Cadastros › Categorias**: criar "Pastéis salgados", "Bebidas"… e desativar uma categoria inteira (os produtos dela somem do Novo pedido).
2. **Cadastros › Produtos**: **Novo produto** com nome, categoria, preço e ingredientes. **Editar** para trocar o preço; aparece o aviso "O novo preço vale para pedidos a partir de agora. Pedidos anteriores não mudam".
3. **Desativar** tira o produto do Novo pedido. Não existe botão de apagar.

Só quem tem a permissão **Cardápio** vê essas telas (de fábrica, só o Administrador).

## Por trás

| O quê                                   | Arquivo                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rotas de categorias                     | [`apps/api/src/cardapio/rotas-categorias.ts`](../../apps/api/src/cardapio/rotas-categorias.ts)                                                                           |
| Rotas de produtos e formas de pagamento | [`apps/api/src/cardapio/rotas-produtos.ts`](../../apps/api/src/cardapio/rotas-produtos.ts)                                                                               |
| Telas                                   | [`telas/cadastros/Categorias.tsx`](../../apps/web/src/telas/cadastros/Categorias.tsx), [`telas/cadastros/Produtos.tsx`](../../apps/web/src/telas/cadastros/Produtos.tsx) |
| Validação (nome, preço, ingredientes)   | `esquemaProduto` e `esquemaCategoria` em [`packages/shared/src/esquemas.ts`](../../packages/shared/src/esquemas.ts)                                                      |

Pontos que valem notar no código:

- `GET /api/produtos?ativo=true` devolve só produtos ativos **de categorias ativas**. É essa lista que o Novo pedido usa.
- Nome repetido (sem diferenciar maiúsculas) é recusado.
- Não dá para pôr produto numa categoria desativada, nem reativar produto cuja categoria está desativada.
- Quando o preço muda, a API grava no log o preço anterior, o novo e quem mudou (`evento: 'preco_alterado'`).
- `GET /api/formas-pagamento` lista Dinheiro, PIX, Débito e Crédito, que vêm prontas da migração inicial.

### O cardápio oficial

Os 25 produtos reais da loja estão em [`apps/api/src/scripts/cardapio-oficial.ts`](../../apps/api/src/scripts/cardapio-oficial.ts). O script [`cadastrar-cardapio.ts`](../../apps/api/src/scripts/cadastrar-cardapio.ts) grava esse arquivo no banco. Em produção, ele roda pelo workflow **Cadastrar cardápio** na aba Actions do GitHub ([`.github/workflows/cadastrar-cardapio.yml`](../../.github/workflows/cadastrar-cardapio.yml)).

Para mudar o cardápio oficial: altere o arquivo, faça o merge e rode o workflow de novo.

## Conceito novo: operação idempotente

Uma operação é **idempotente** quando rodar uma vez ou dez vezes dá o mesmo resultado. O script do cardápio é assim: se o "Pastel de carne" já existe, ele só acerta preço, categoria e ingredientes e reativa; não cria um segundo. Por isso dá para rodar o workflow sem medo.

A mesma ideia aparece, com mais peso, no Novo pedido ([parte 07](part-07-novo-pedido.md)): finalizar duas vezes não grava dois pedidos.

## Por que assim

- **Desativar em vez de apagar**: os pedidos antigos apontam para o produto. Apagar quebraria o histórico.
- **Pedido guarda o preço do momento**: mudar o preço amanhã não altera o que foi cobrado hoje ([parte 04](part-04-os-dados.md)).
- **Cardápio em arquivo versionado**: fica no Git, com histórico de quem mudou o quê, e evita digitar 25 produtos à mão no celular.

## Experimente

1. Com o `seed:dev` rodado, abra **Produtos**, mude o preço de um item e confira o aviso.
2. Abra o Novo pedido em outra aba **antes** de mudar o preço, adicione o item e só então mude o preço na primeira aba. Finalize na segunda: o servidor recusa com "O preço de … mudou". Isso é o critério CA-04, testado em `e2e/tela-novo-pedido.spec.ts`.

## Para conferir

<details><summary>1. Desativei a categoria Bebidas. O que acontece com o refrigerante?</summary>

Some do Novo pedido (a lista de ativos exige categoria ativa), mas continua nos pedidos antigos.
</details>

<details><summary>2. Rodar o workflow Cadastrar cardápio duas vezes duplica os produtos?</summary>

Não. O script procura pelo nome e só atualiza o que já existe.
</details>

<details><summary>3. Onde fica registrado que alguém mudou um preço?</summary>

No log da API, com o evento `preco_alterado`, o preço anterior, o novo e o id de quem mudou.
</details>

## Fontes

- [README, passo 5 da Publicação](../../README.md)
- [`cardapio.test.ts`](../../apps/api/test/cardapio.test.ts)
