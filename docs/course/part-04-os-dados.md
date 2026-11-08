Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 04: os dados

## O que você vai aprender

- As tabelas do banco e por que cada uma existe.
- Como um pedido é guardado (pedido, itens, pagamento, preparo).
- Por que o banco tem regras próprias (CHECKs), além das regras da API.

## Na tela

Tudo o que aparece nas telas sai destas tabelas: o cardápio do Novo pedido, a fila da cozinha, o histórico e o resumo.

## Por trás

O modelo está em [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma). Os nomes no código são em camelCase (`clienteNome`) e no banco em snake_case (`cliente_nome`), ligados pelo `@map`.

| Tabela             | Para quê                                               | Criada em                                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------- |
| `usuarios`         | Quem entra no sistema, com senha em hash e perfil      | `20261008000000_inicial`                          |
| `perfis`           | Os 4 perfis e a lista de permissões de cada um         | `20261017000000_perfis`                           |
| `categorias`       | Partes do cardápio (Pastéis, Bebidas…)                 | `inicial`                                         |
| `produtos`         | Itens com preço, categoria e ingredientes              | `inicial` e `20261016010000_ingredientes_produto` |
| `formas_pagamento` | Dinheiro, PIX, Débito e Crédito, com código fixo       | `inicial`                                         |
| `pedidos`          | Cada venda: status, total, pagamento, cliente, preparo | `inicial` e `20261016000000_comanda`              |
| `itens_pedido`     | As linhas de cada pedido                               | `inicial`                                         |
| `clientes`         | Quem já pediu, para sugerir o nome                     | `20261017010000_clientes`                         |
| `config_pix`       | A chave Pix da loja (uma linha só)                     | `20261019000000_pix`                              |

### O pedido em detalhe

Um pedido tem **dois andamentos independentes**:

- `status` diz se o dinheiro entrou: `ABERTO` (pagar depois), `FINALIZADO` (pago) ou `CANCELADO`.
- `status_preparo` diz onde está na cozinha: `AGUARDANDO`, `PREPARANDO`, `PRONTO` ou `ENTREGUE`.

Um pedido pode estar `ABERTO` e `ENTREGUE` ao mesmo tempo: o cliente já comeu e ainda vai pagar.

Os itens guardam **uma cópia** do nome e do preço do produto naquele momento (`nome_produto`, `preco_unitario`). Se o preço do pastel subir amanhã, o pedido de hoje continua com o valor que foi cobrado.

### Regras no próprio banco

As migrações SQL têm `CHECK`s que o Prisma não representa. Exemplos da [migração inicial](../../apps/api/prisma/migrations/20261008000000_inicial/migration.sql):

- `ck_pedidos_finalizado`: pedido `FINALIZADO` precisa ter forma de pagamento e data de finalização.
- `ck_pedidos_cancelamento`: os dados de cancelamento (quando, quem, motivo) existem **se, e somente se**, o pedido está cancelado.
- `preco >= 0`, `total >= 0`, `troco >= 0`.

E um gatilho (`set_atualizado_em`) atualiza a coluna `atualizado_em` sozinho a cada mudança.

## Conceito novo: dinheiro sem ponto flutuante

No computador, `0.1 + 0.2` dá `0.30000000000000004`. Para dinheiro isso é inaceitável. O sistema usa duas proteções:

1. No banco, valores são `NUMERIC(10,2)`: número exato com duas casas.
2. No código, contas são feitas em **centavos inteiros**. Um pastel de R$ 8,50 vira `850`. Veja [`packages/shared/src/dinheiro.ts`](../../packages/shared/src/dinheiro.ts): `paraCentavos("8,50")` dá `850`, e `deCentavos(3300)` dá `"33.00"`, o formato que viaja pela API.

## Por que assim

- **Nada é apagado**: produto, categoria e usuário são desativados (`ativo = false`), nunca apagados. Assim os pedidos antigos continuam apontando para eles. As chaves estrangeiras usam `ON DELETE RESTRICT` para impedir apagar por engano.
- **Formas de pagamento por código**: as regras usam `codigo = 'DINHEIRO'`, nunca o número do id, para não quebrar se a ordem mudar.
- **Regras repetidas no banco**: a API já confere tudo, mas o banco é a última barreira. Um bug futuro na API não consegue gravar um pedido finalizado sem pagamento.

## Experimente

Com o sistema rodando e um pedido feito, abra o `psql` no banco local e rode:

```sql
SELECT id, status, status_preparo, total, cliente_nome FROM pedidos ORDER BY id DESC LIMIT 5;
SELECT pedido_id, nome_produto, quantidade, preco_unitario, subtotal FROM itens_pedido ORDER BY id DESC LIMIT 5;
```

Depois tente quebrar uma regra de propósito e veja o banco recusar:

```sql
UPDATE pedidos SET status = 'FINALIZADO', forma_pagamento_id = NULL WHERE id = (SELECT max(id) FROM pedidos);
```

## Para conferir

<details><summary>1. Por que itens_pedido guarda nome e preço, se o produto já tem?</summary>

Para o pedido continuar igual ao que foi cobrado, mesmo que o produto mude de nome ou preço depois.
</details>

<details><summary>2. Um pedido pode estar ABERTO e PRONTO?</summary>

Sim. `status` (pagamento) e `status_preparo` (cozinha) são independentes.
</details>

<details><summary>3. Quanto é R$ 12,90 em centavos, e como volta para a API?</summary>

`1290`, e volta como `"12.90"` (`deCentavos(1290)`).
</details>

## Fontes

- [`schema.prisma`](../../apps/api/prisma/schema.prisma)
- [Migrações](../../apps/api/prisma/migrations)
- [PostgreSQL: tipos numéricos](https://www.postgresql.org/docs/current/datatype-numeric.html)
