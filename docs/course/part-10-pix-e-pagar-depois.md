Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 10: Pix com o valor do pedido, Pagar depois e A receber

## O que você vai aprender

- Como o sistema gera o QR Code do Pix já com o valor, sem banco intermediário.
- Como funciona o pedido que vai para a cozinha antes de ser pago.
- Por que o pagamento recebido depois não pode ser registrado duas vezes.

## Na tela

### Pix

1. O Administrador ou o Gerente cadastra a chave em **Cadastros › Pix da loja**: tipo da chave, chave, nome do recebedor e cidade. **Testar com R$ 1,00** mostra um QR de teste.
2. No Novo pedido, ao escolher **PIX**, aparece **Mostrar QR Code do Pix**. A janela **Pagar com Pix** tem o QR Code, o **Pix copia e cola** e o botão de enviar pelo WhatsApp.
3. O aviso deixa claro: "O sistema não confirma o pagamento sozinho: confira no app do banco se o Pix entrou antes de finalizar."

### Pagar depois

1. No Novo pedido, em vez de escolher a forma, toque em **Pagar depois**. O pedido vai para a cozinha com a etiqueta **Paga no fim**.
2. Quando o cliente terminar, abra **A receber**. A lista mostra os pedidos que faltam pagar, do mais antigo para o mais novo.
3. **Receber** abre a janela com Dinheiro (com troco), PIX (com QR), Débito ou Crédito. **Confirmar pagamento** e o pedido passa a contar nas vendas.

## Por trás

### Pix

| O quê                                        | Arquivo                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Montar o código copia e cola                 | `gerarPixCopiaECola` em [`packages/shared/src/pix.ts`](../../packages/shared/src/pix.ts)          |
| Janela com QR Code                           | [`componentes/JanelaPix.tsx`](../../apps/web/src/componentes/JanelaPix.tsx) (biblioteca `qrcode`) |
| Tela Pix da loja                             | [`telas/cadastros/PixLoja.tsx`](../../apps/web/src/telas/cadastros/PixLoja.tsx)                   |
| `GET` e `PUT /api/pix`                       | [`apps/api/src/pix/rotas.ts`](../../apps/api/src/pix/rotas.ts)                                    |
| Tabela `config_pix` (uma linha só, `id = 1`) | Migrações `20261019000000_pix` e `20261108000000_pix_gerente`                                     |

O código é gerado **na tela**, a partir da chave salva e do total do pedido. Ninguém de fora participa.

### Pagar depois

| O quê                                                             | Arquivo                                                                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pedido `ABERTO`, sem forma de pagamento                           | `criarPedido` e `calcularPedido` (com `pagarDepois = true`)                                                                                         |
| `GET /api/pedidos/a-receber` e `PATCH /api/pedidos/:id/pagamento` | [`pedidos/rotas.ts`](../../apps/api/src/pedidos/rotas.ts)                                                                                           |
| Tela A receber                                                    | [`telas/AReceber.tsx`](../../apps/web/src/telas/AReceber.tsx) e [`componentes/JanelaReceber.tsx`](../../apps/web/src/componentes/JanelaReceber.tsx) |

O `PATCH …/pagamento` roda numa transação: confere que o pedido existe e não está cancelado nem pago, calcula o troco com `calcularPagamento` (a mesma função do Novo pedido) e grava com:

```ts
tx.pedido.updateMany({ where: { id, status: 'ABERTO' }, data: { status: 'FINALIZADO', … } });
```

Se `count` vier `0`, alguém já recebeu esse pedido, e a API responde `409 PEDIDO_JA_PAGO`.

## Conceito novo: o BR Code do Pix

O "Pix copia e cola" é um texto no padrão **EMV**, definido pelo Banco Central. Cada pedaço é `ID + tamanho + valor`. Por exemplo, `5406` + `33.00` quer dizer "campo 54 (valor), com 6 caracteres: 33.00". No fim vem um **CRC16**, uma soma de conferência: se um caractere for digitado errado, o app do banco percebe e recusa.

O QR Code é só esse mesmo texto desenhado em quadradinhos.

Esse Pix é **estático**: não há aviso de pagamento para o sistema. O Pix dinâmico, com confirmação automática, exige um banco ou intermediário e costuma ter taxa.

## Conceito novo: atualização condicional

`updateMany({ where: { id, status: 'ABERTO' } })` só muda o pedido **se ele ainda estiver ABERTO** naquele instante. Se duas pessoas tocarem em Confirmar ao mesmo tempo, o banco deixa só uma passar. É a mesma técnica usada no cancelamento.

## Por que assim

- **Pix estático**: sem taxa e sem contrato com banco, que é o que a loja precisa hoje. O preço é conferir no app do banco. Ver [pix.md](../pix.md).
- **Gerente também pode trocar a chave** (permissão `PIX_LOJA`): pedido do Ryan na etapa 16.
- **Pagar depois só conta nas vendas quando recebido**: o faturamento conta só `FINALIZADO`, então o Resumo sempre bate com o dinheiro que entrou. Ver [pagar-depois.md](../pagar-depois.md).

## Experimente

Rode os testes do Pix e veja um código de exemplo sendo conferido:

```powershell
npm test -w packages/shared -- pix
```

Depois, gere um código para R$ 1,00 na tela **Pix da loja** com a sua chave e leia com o app do seu banco: o nome do recebedor tem que aparecer certo antes de pagar.

## Para conferir

<details><summary>1. O sistema sabe se o cliente pagou o Pix?</summary>

Não. O Pix é estático; quem confere é o atendente, no app do banco.
</details>

<details><summary>2. Um pedido de pagar depois aparece no faturamento antes de ser recebido?</summary>

Não. Ele está `ABERTO`, e o faturamento soma só `FINALIZADO`.
</details>

<details><summary>3. O que impede o mesmo pedido de ser recebido duas vezes?</summary>

O `updateMany` com `status: 'ABERTO'` no `where`: a segunda tentativa não muda nenhuma linha e recebe `409 PEDIDO_JA_PAGO`.
</details>

## Fontes

- [pix.md](../pix.md), [pagar-depois.md](../pagar-depois.md)
- [Banco Central: Manual do BR Code](https://www.bcb.gov.br/estabilidadefinanceira/pix)
- [`pix.test.ts` (API)](../../apps/api/test/pix.test.ts), [`pagar-depois.test.ts`](../../apps/api/test/pagar-depois.test.ts)
