Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 11: histórico, cancelamento, Resumo e carro-chefe

## O que você vai aprender

- Como os pedidos são filtrados por período, e por que "hoje" é o dia em Brasília.
- Como um pedido é cancelado sem apagar nada.
- Como o Resumo calcula faturamento, totais por forma e o carro-chefe de cada categoria.

## Na tela

1. **Início**: saudação, faturamento do dia, pedidos finalizados, dinheiro, PIX e os pedidos de hoje.
2. **Histórico**: filtros por período (Hoje, Ontem, Últimos 7 dias, Este mês, Personalizado), status, pagamento, usuário, cliente e nº do pedido. Quem tem Financeiro vê também o total finalizado no filtro.
3. Toque num pedido para ver o **detalhe**: itens, pagamento, troco, quem registrou, andamento do preparo.
4. **Cancelar pedido** pede um motivo e avisa: "O pedido de R$ … vai sair do faturamento e continuar no histórico como cancelado. Não é possível desfazer."
5. **Resumo** (permissão Financeiro): faturamento, média por pedido, cancelados, por forma de pagamento, cartão (débito + crédito), mais vendidos e **Carro-chefe de cada categoria**. Tem botão **Imprimir**.

## Por trás

| O quê                                                                                               | Arquivo                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/pedidos` (filtros e paginação), `GET /api/pedidos/:id`, `PATCH /api/pedidos/:id/cancelar` | [`apps/api/src/pedidos/rotas.ts`](../../apps/api/src/pedidos/rotas.ts)                                                                                                                                                                 |
| `GET /api/relatorios/vendas`                                                                        | [`apps/api/src/relatorios/rotas.ts`](../../apps/api/src/relatorios/rotas.ts)                                                                                                                                                           |
| Período em dias de Brasília                                                                         | `intervaloDeDias` em [`apps/api/src/periodo.ts`](../../apps/api/src/periodo.ts)                                                                                                                                                        |
| Telas                                                                                               | [`Inicio.tsx`](../../apps/web/src/telas/Inicio.tsx), [`Historico.tsx`](../../apps/web/src/telas/Historico.tsx), [`DetalhePedido.tsx`](../../apps/web/src/telas/DetalhePedido.tsx), [`Resumo.tsx`](../../apps/web/src/telas/Resumo.tsx) |

### O histórico

`GET /api/pedidos` monta um filtro do Prisma a partir da query (`de`, `ate`, `status`, `formaPagamento`, `usuarioId`, `cliente`, `pagina`). Três consultas rodam juntas com `Promise.all`: a página de pedidos, a contagem total e a soma dos finalizados. A soma em reais só vai na resposta para quem tem **Financeiro**.

### O cancelamento

Na transação, a API confere que o pedido existe, não está cancelado e que veio um motivo. Depois muda **só** `status`, `cancelado_em`, `cancelado_por_id` e `motivo_cancelamento`. Itens e valores ficam como estavam. Não existe rota para editar nem apagar pedido (regra RN-13).

### O Resumo

Cinco consultas em paralelo:

1. as formas de pagamento;
2. `groupBy` dos finalizados por forma (quantidade e soma);
3. os cancelados (quantidade e valor);
4. os produtos mais vendidos, em SQL;
5. o **carro-chefe**: o mais vendido de cada categoria, com `DISTINCT ON (categoria_id)`.

Cancelados ficam fora do faturamento (RN-16). Pedidos `ABERTO` também, porque o dinheiro ainda não entrou.

## Conceito novo: dia civil e fuso horário

O banco guarda horas em UTC. Um pedido feito às 21h30 de sábado em Brasília fica gravado como 00h30 de domingo em UTC. Se o Resumo filtrasse "domingo" em UTC, esse pedido apareceria no dia errado.

`intervaloDeDias('2026-11-07', '2026-11-07')` resolve isso: calcula a meia-noite de Brasília daquele dia (`meiaNoiteEmSaoPaulo`) e devolve o intervalo `[início, fim)`, do sábado 00h00 até o domingo 00h00, em Brasília. Todas as consultas de período usam esse intervalo.

## Conceito novo: `DISTINCT ON`

No PostgreSQL, `SELECT DISTINCT ON (categoria_id) … ORDER BY categoria_id, quantidade DESC` devolve **uma linha por categoria**: a primeira na ordem pedida, ou seja, a que mais vendeu. É o jeito mais curto de pegar "o campeão de cada grupo". O carro-chefe é por categoria porque, na lista geral, o refrigerante sempre ganharia.

## Por que assim

- **Cancelar em vez de apagar**: o histórico precisa bater com o caixa, inclusive para saber o que foi cancelado, por quem e por quê.
- **Consultas em paralelo** (`Promise.all`): o Resumo espera a mais lenta, não a soma de todas.
- **SQL escrito à mão no Resumo**: o Prisma não faz `DISTINCT ON` com agregação; a consulta usa parâmetros (`${periodo.inicio}`), então não há risco de SQL injection.

## Experimente

Rode os testes do relatório e procure o caso do pedido às 23h50:

```powershell
npm test -w apps/api -- relatorios
```

Explique por que um pedido às 23h50 de sábado precisa contar no sábado, e não no domingo.

## Para conferir

<details><summary>1. Um pedido cancelado aparece no histórico?</summary>

Sim, como cancelado, com quem cancelou, quando e o motivo. Só sai do faturamento.
</details>

<details><summary>2. Por que o carro-chefe é por categoria?</summary>

Porque na lista geral a bebida ganharia sempre; por categoria aparece o sabor de pastel campeão, a bebida campeã e assim por diante.
</details>

<details><summary>3. O Funcionário vê a soma em reais no histórico?</summary>

Não. A soma só vai na resposta para quem tem a permissão Financeiro (e, de fábrica, o Funcionário nem vê o histórico).
</details>

## Fontes

- [carro-chefe.md](../carro-chefe.md)
- [PostgreSQL: DISTINCT ON](https://www.postgresql.org/docs/current/sql-select.html#SQL-DISTINCT)
- [`relatorios.test.ts`](../../apps/api/test/relatorios.test.ts), [`pedidos.test.ts`](../../apps/api/test/pedidos.test.ts)
