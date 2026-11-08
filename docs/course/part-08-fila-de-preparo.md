Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 08: fila de preparo (comanda digital)

## O que você vai aprender

- Como o pedido chega à cozinha e anda pelas etapas.
- Como vários aparelhos veem a mesma fila sem servidor de mensagens.
- Por que mudar o preparo não mexe no pagamento.

## Na tela

1. A cozinha abre **Fila de preparo** num tablet. As colunas são **Aguardando**, **Preparando** e **Pronto**, por ordem de chegada, com o nome do cliente, os itens e há quanto tempo o pedido espera ("há 7 min").
2. Cada cartão tem um botão para o próximo passo: **Começar preparo**, **Marcar pronto**, **Entregue ao cliente**.
3. Tocou errado? **Voltar etapa**. Os últimos entregues ficam em **Entregues há pouco**, com **Voltar para a fila**.
4. Pedido de pagar depois aparece com a etiqueta **Paga no fim**.
5. A tela se atualiza sozinha a cada 10 segundos.

## Por trás

| O quê                                              | Arquivo                                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tela                                               | [`apps/web/src/telas/Fila.tsx`](../../apps/web/src/telas/Fila.tsx)                                         |
| `GET /api/fila` e `PATCH /api/pedidos/:id/preparo` | [`apps/api/src/pedidos/rotas.ts`](../../apps/api/src/pedidos/rotas.ts)                                     |
| Coluna `status_preparo`                            | Migração [`20261016000000_comanda`](../../apps/api/prisma/migrations/20261016000000_comanda/migration.sql) |

`GET /api/fila` (permissão **Fila de preparo**) devolve:

- `dados`: pedidos **de hoje** (dia em Brasília), `FINALIZADO` ou `ABERTO`, que ainda não foram entregues, do mais antigo para o mais novo;
- `entreguesRecentes`: os 5 últimos entregues, para desfazer um toque errado.

Cancelados não entram. `PATCH /api/pedidos/:id/preparo` muda só `status_preparo` e `preparo_atualizado_em`. Se o pedido foi cancelado nesse meio tempo, responde `409 PEDIDO_CANCELADO` e a tela avisa "Este pedido foi cancelado e saiu da fila".

Na tela, a constante `COLUNAS` diz, para cada etapa, qual é a próxima e o texto do botão; `ANTERIOR` diz para onde o "Voltar etapa" leva.

## Conceito novo: polling

Para a cozinha ver um pedido novo sem tocar em nada, o sistema usa **polling**: pergunta de novo a cada intervalo. No código:

```ts
useQuery({ queryKey: ['fila'], queryFn: () => api('/fila'), refetchInterval: 10_000 });
```

O TanStack Query cuida do resto: pausa quando a aba está escondida e guarda a última resposta para a tela não piscar. A alternativa seria WebSocket (o servidor empurra a novidade), que exigiria a API sempre acordada e mais código. Para uma loja com dezenas de pedidos por noite, 10 segundos de atraso é aceitável.

## Por que assim

- **Dois andamentos separados** (`status` e `status_preparo`): pagar e preparar são coisas diferentes. A cozinha nunca mexe no dinheiro, e a regra RN-13 diz que itens e valores de um pedido gravado não mudam.
- **Fila só do dia**: pedido de sábado esquecido como "Pronto" não aparece no domingo.
- **Ordem de chegada**: é justo com o cliente e é o que a cozinha já fazia no papel.

## Experimente

Abra o sistema em duas janelas: numa, o Novo pedido; na outra, a Fila. Faça um pedido e conte quantos segundos ele leva para aparecer na fila. Depois mude `refetchInterval` para `3_000` em `Fila.tsx`, rode `npm run dev` e compare (não faça commit dessa mudança).

## Para conferir

<details><summary>1. Um pedido de pagar depois aparece na fila?</summary>

Sim. A fila pega `FINALIZADO` e `ABERTO`, e o de pagar depois leva a etiqueta "Paga no fim".
</details>

<details><summary>2. Marcar "Pronto" muda o total ou o pagamento?</summary>

Não. A rota de preparo só altera `status_preparo` e a hora dessa mudança.
</details>

<details><summary>3. Por que polling em vez de WebSocket?</summary>

É mais simples, funciona com a API que dorme e 10 segundos de atraso não atrapalham a cozinha.
</details>

## Fontes

- [comanda.md](../comanda.md)
- [TanStack Query: refetchInterval](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
- [`comanda.test.ts`](../../apps/api/test/comanda.test.ts)
