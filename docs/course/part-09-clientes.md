Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 09: clientes (sugestão de nome e telefone)

## O que você vai aprender

- Como o campo Nome do cliente sugere quem já pediu.
- Como "José da Silva" e "jose da silva" viram o mesmo cliente.
- Por que o cadastro é "leve", sem tela própria.

## Na tela

1. No Novo pedido, comece a digitar o nome. Aparece a lista **Clientes que já pediram**, com quantos pedidos cada um fez.
2. Toque num nome (ou use as setas e Enter). Se o cliente tinha telefone, ele vem junto.
3. Nome novo? É só digitar e finalizar: o cliente é cadastrado sozinho.
4. **Adicionar telefone (opcional)** guarda o número com DDD, como (11) 98765-4321.

## Por trás

| O quê                                     | Arquivo                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Campo com sugestões e máscara do telefone | [`telas/novo-pedido/CampoCliente.tsx`](../../apps/web/src/telas/novo-pedido/CampoCliente.tsx)                |
| `GET /api/clientes?busca=…`               | [`apps/api/src/clientes/rotas.ts`](../../apps/api/src/clientes/rotas.ts)                                     |
| Gravar o cliente junto com o pedido       | `criarPedido` em [`pedidos/servico.ts`](../../apps/api/src/pedidos/servico.ts)                               |
| Normalizar o nome                         | `chaveCliente` em [`packages/shared/src/texto.ts`](../../packages/shared/src/texto.ts)                       |
| Tabela `clientes`                         | Migração [`20261017010000_clientes`](../../apps/api/prisma/migrations/20261017010000_clientes/migration.sql) |

### A chave do cliente

`chaveCliente("  José  da Silva")` tira acentos, passa para minúsculas e junta os espaços: `"jose da silva"`. A coluna `chave` é `UNIQUE`, então o mesmo cliente nunca é cadastrado duas vezes.

### A busca

A tela espera a pessoa parar de digitar um instante e chama `GET /api/clientes?busca=jose sil`. A API separa as palavras e exige que **todas** apareçam na chave, em qualquer ordem. Volta no máximo 6 sugestões, de quem pediu por último primeiro.

### Gravar junto com o pedido

Dentro da mesma transação do pedido, a API roda:

```sql
INSERT INTO clientes (nome, chave, telefone) VALUES (…)
ON CONFLICT (chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  telefone = COALESCE(EXCLUDED.telefone, clientes.telefone),
  ultimo_pedido_em = now()
RETURNING id
```

Ou seja: se o cliente não existe, cria; se existe, atualiza a grafia do nome, só troca o telefone quando veio um novo e marca a hora do último pedido.

## Conceito novo: upsert com `ON CONFLICT`

**Upsert** é "insere ou, se já existe, atualiza" numa operação só. Fazer em dois passos ("procura; se não achou, insere") tem um risco: dois pedidos com o mesmo nome novo chegando juntos podem os dois "não achar" e tentar inserir. Com `ON CONFLICT`, o próprio PostgreSQL resolve a disputa.

## Por que assim

- **Sem tela de clientes**: a loja não quer fazer cadastro; só não quer digitar o nome do freguês de sempre. O cadastro acontece sozinho no pedido.
- **Telefone opcional**: guardado só com números (10 ou 11 dígitos, conferido por `CHECK` no banco). Serve para avisar o cliente no futuro; nada é enviado hoje.
- **Fidelidade e fiado** ficaram para depois do piloto, de propósito.
- **Permissão Registrar pedidos para buscar**: quem não faz pedido não precisa ver a lista de clientes (cuidado com dado pessoal).

## Experimente

Faça dois pedidos: um para "Jose da Silva" e outro para "JOSÉ DA SILVA". Depois, no `psql`:

```sql
SELECT nome, chave, telefone, ultimo_pedido_em FROM clientes;
```

Deve haver uma linha só, com a grafia do segundo pedido.

## Para conferir

<details><summary>1. Qual é a chave de "Ana  Júlia "?</summary>

`"ana julia"`.
</details>

<details><summary>2. Um pedido sem telefone apaga o telefone que o cliente já tinha?</summary>

Não. O `COALESCE` mantém o telefone antigo quando o novo vem vazio.
</details>

<details><summary>3. Por que ON CONFLICT em vez de procurar e depois inserir?</summary>

Para dois pedidos simultâneos com o mesmo nome novo não criarem o cliente duas vezes nem darem erro.
</details>

## Fontes

- [clientes.md](../clientes.md)
- [PostgreSQL: INSERT … ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)
- [`clientes.test.ts`](../../apps/api/test/clientes.test.ts)
