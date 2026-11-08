Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 07: novo pedido, o coração do sistema

## O que você vai aprender

- O caminho completo de um pedido, do toque no pastel até a linha no banco.
- Por que o servidor recalcula tudo, mesmo a tela já mostrando o total.
- Como o sistema evita gravar o mesmo pedido duas vezes.
- Por que o pedido em montagem não se perde se a página recarregar.

## Na tela

1. **Novo pedido** (ou tecla F1). Os produtos aparecem em abas por categoria, com busca (tecla `/`).
2. Cada toque adiciona o produto ao painel do pedido. Os botões − e + mudam a quantidade; remover um item mostra **Desfazer**.
3. **Nome do cliente** é obrigatório: é como a cozinha chama quando fica pronto ([parte 09](part-09-clientes.md)).
4. Escolha **Dinheiro, PIX, Débito ou Crédito** (F2 a F5). Em Dinheiro, o **Valor recebido** é opcional e calcula o troco na hora; se faltar dinheiro, aparece "Faltam R$ …".
5. **Finalizar pedido** (Ctrl+Enter). Aparece "Pedido nº 12 de Ana registrado, R$ 33,00" e a tela limpa para o próximo.
6. Ou **Pagar depois**, se o cliente vai pagar no fim ([parte 10](part-10-pix-e-pagar-depois.md)).

## Por trás

### Na tela

[`apps/web/src/telas/novo-pedido/NovoPedido.tsx`](../../apps/web/src/telas/novo-pedido/NovoPedido.tsx) monta o pedido num **rascunho** ([`rascunho.ts`](../../apps/web/src/telas/novo-pedido/rascunho.ts)) que é salvo no navegador a cada mudança. O rascunho nasce com uma `chaveIdempotencia` (um UUID de `crypto.randomUUID()`).

Ao finalizar, a função `finalizar` monta o corpo e faz `POST /api/pedidos`:

```json
{
  "chaveIdempotencia": "8f1c…",
  "cliente": "Ana",
  "formaPagamento": "DINHEIRO",
  "valorRecebido": "50.00",
  "itens": [{ "produtoId": 3, "quantidade": 2, "precoExibido": "8.50" }]
}
```

Note o `precoExibido`: a tela conta ao servidor qual preço a pessoa viu.

### Na API

1. A rota em [`pedidos/rotas.ts`](../../apps/api/src/pedidos/rotas.ts) exige a permissão **Registrar pedidos** e valida o corpo com `esquemaNovoPedido`.
2. Chama `criarPedido` em [`pedidos/servico.ts`](../../apps/api/src/pedidos/servico.ts):
   1. Já existe pedido com essa `chaveIdempotencia`? Devolve ele mesmo (status `200`, sem gravar de novo).
   2. Abre uma **transação**.
   3. Carrega os produtos atuais do banco e a forma de pagamento.
   4. Chama `calcularPedido` em [`pedidos/calculo.ts`](../../apps/api/src/pedidos/calculo.ts), que confere, nesta ordem: pedido tem itens; os produtos existem; estão ativos; **o preço exibido é igual ao do banco**; quantidade de 1 a 99; forma de pagamento válida; valor recebido só em dinheiro e não menor que o total. Depois calcula subtotais, total e troco, em centavos.
   5. Grava ou atualiza o cliente ([parte 09](part-09-clientes.md)).
   6. Cria o pedido `FINALIZADO` (ou `ABERTO`, se for pagar depois), com `status_preparo = 'AGUARDANDO'`, e os itens. O usuário vem do token e a hora vem do servidor.
3. Responde `201` com o pedido completo.

Se o preço mudou, a API responde `409 PRECO_ALTERADO`, com o preço antigo e o novo. A tela marca a linha ("Preço mudou de R$ 8,00 para R$ 8,50"), atualiza o valor e pede para finalizar de novo.

## Conceito novo: idempotência

Imagine: a internet engasga, a pessoa toca em Finalizar de novo. Sem cuidado, a loja teria dois pedidos iguais e a cozinha faria o dobro.

A solução é a **chave de idempotência**: o rascunho tem um UUID, e o mesmo UUID vai em todas as tentativas. O banco tem `chave_idempotencia` como `UNIQUE`. Então:

- primeira tentativa: grava e responde `201`;
- segunda tentativa com a mesma chave: encontra o pedido e devolve ele, com `200`;
- duas tentativas **ao mesmo tempo**: a segunda bate no `UNIQUE`, e o `catch` em `servico.ts` (`eUnicoViolado`) busca e devolve o pedido da primeira.

Só quando o pedido é gravado a tela cria um rascunho novo, com chave nova.

## Conceito novo: transação

Uma **transação** é "tudo ou nada". O pedido e os itens são gravados dentro de `banco.$transaction`. Se algo falhar no meio (por exemplo, o banco cair depois do pedido e antes dos itens), nada fica gravado. Nunca existe um pedido sem itens.

## Por que assim

- **O servidor recalcula tudo**: a tela pode estar desatualizada (preço mudou em outro aparelho) ou adulterada. O teste `pedidos.test.ts` manda um preço falso e confere que a API recusa.
- **Contas em centavos**: ver [parte 04](part-04-os-dados.md).
- **Regras de cálculo num arquivo sem banco** (`calculo.ts`): dá para testar todos os casos rapidinho, em [`calculo.test.ts`](../../apps/api/src/pedidos/calculo.test.ts), sem subir PostgreSQL.
- **Rascunho no navegador**: se a página recarregar ou a bateria do tablet acabar, a tela pergunta "Continuar pedido anterior?".

## Experimente

Rode só os testes de cálculo e leia os nomes dos casos:

```powershell
npm test -w apps/api -- calculo
```

Depois crie um caso novo em `calculo.test.ts`: 3 pastéis de R$ 8,50 pagos com R$ 30,00 devem dar troco de R$ 4,50 (`450` centavos).

## Para conferir

<details><summary>1. A tela mostra o total. Por que o servidor calcula de novo?</summary>

Porque a tela pode estar com preço velho ou ter sido adulterada. Quem decide o valor é o banco.
</details>

<details><summary>2. O que a API responde se a mesma chaveIdempotencia chegar duas vezes?</summary>

O mesmo pedido já gravado, com status `200` em vez de `201`. Nada é duplicado.
</details>

<details><summary>3. Em que ordem calcularPedido confere as regras, e por que a ordem importa?</summary>

Itens, existência, ativo, preço, quantidade, pagamento. A primeira regra violada vira o erro mostrado; assim a mensagem é sempre a mais útil (não adianta falar de troco se o produto nem existe mais).
</details>

## Fontes

- [comanda.md](../comanda.md), [verificacao.md](../verificacao.md) (CA-05 a CA-07)
- [Prisma: transações](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests)
