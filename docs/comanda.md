# Comanda digital: nome do cliente e fila de preparo

Adicionada em 16/10/2026, a pedido do Ryan: o sistema também serve de comanda, para saber de
qual cliente é cada pedido e em que ordem preparar.

## Como fica no balcão

1. **Novo pedido:** o painel do pedido tem o campo **Nome do cliente** (obrigatório, até 40
   letras). Sem nome, o botão Finalizar fica desabilitado com a dica "Informe o nome do cliente".
   O aviso de sucesso diz o número e o nome: "Pedido nº 12 de Dona Joana registrado, R$ 33,00".
2. **Fila de preparo** (menu, para quem tem a permissão Fila; de fábrica, Administrador e Chef,
   ver [perfis.md](perfis.md)): mostra os pedidos do dia ainda não
   entregues, por ordem de chegada, em três colunas: **Aguardando**, **Preparando** e **Pronto**.
   Cada cartão tem o nome em destaque, o nº do pedido, a hora, há quantos minutos chegou, a
   posição na fila (1º, 2º...) e os itens com quantidade. Não mostra valores.
3. Um toque no botão do cartão leva o pedido à etapa seguinte: **Começar preparo** →
   **Marcar pronto** → **Entregue ao cliente**. Entregue sai da fila.
4. Toque errado: **Voltar etapa** no cartão, ou **Voltar para a fila** na lista "Entregues há
   pouco" (os 5 últimos entregues do dia).
5. A tela atualiza sozinha a cada 10 segundos, então um tablet na cozinha e o computador do
   balcão veem a mesma fila.
6. Pedido cancelado sai da fila na hora. Histórico, Início e Detalhe do pedido mostram o nome
   do cliente; o histórico também filtra por nome (parte do nome, sem diferenciar maiúsculas).

## Regras

- RN-C1: todo pedido novo exige o nome do cliente (1 a 40 caracteres, espaços extras removidos).
- RN-C2: todo pedido novo entra na fila como **Aguardando**, no fim da fila (ordem de chegada).
- RN-C3: o andamento do preparo é independente do pagamento; o pedido continua **Finalizado**
  (pago) e o faturamento não muda. Mudar o preparo não altera itens nem valores (RN-13 segue
  valendo).
- RN-C4: qualquer usuário logado muda o preparo, para frente ou para trás.
- RN-C5: pedido cancelado não aparece na fila e não pode mudar de preparo.
- RN-C6: a fila mostra só os pedidos do dia (horário de Brasília).
- Pedidos gravados antes desta mudança ficam sem nome e marcados como **Entregue**.

## Técnico

- Migração `apps/api/prisma/migrations/20261016000000_comanda`: colunas `cliente_nome`,
  `status_preparo` (`AGUARDANDO`, `PREPARANDO`, `PRONTO`, `ENTREGUE`, com CHECK) e
  `preparo_atualizado_em` em `pedidos`, mais o índice parcial `ix_pedidos_fila`. Roda sozinha
  no Render (`prisma migrate deploy` no início do contêiner).
- API:
  - `POST /api/pedidos` passa a exigir `cliente` (texto).
  - `GET /api/pedidos?cliente=...` filtra pelo nome. Pedido e lista trazem `cliente` e
    `preparo: { status, atualizadoEm }`.
  - `GET /api/fila`: `{ dados, entreguesRecentes }`, só com nº, nome, hora, preparo e itens.
  - `PATCH /api/pedidos/:id/preparo` com `{ "status": "PRONTO" }`. Erros:
    `STATUS_PREPARO_INVALIDO` (422), `PEDIDO_NAO_ENCONTRADO` (404), `PEDIDO_CANCELADO` (409).
- Tela: `apps/web/src/telas/Fila.tsx`; campo do nome em `novo-pedido/PainelPedido.tsx`.
- Testes: `apps/api/test/comanda.test.ts` (9 cenários) e `e2e/fluxo-principal.spec.ts` ›
  Comanda.

## Fora do escopo por enquanto

Impressão de comanda, aviso sonoro quando fica pronto, painel para o cliente ver o próprio
pedido e separar itens por estação (pastel e bebida).
