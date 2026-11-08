Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 13: abrir sem esperar o servidor

## O que você vai aprender

- Por que a API gratuita demora até 1 minuto para acordar e como o sistema esconde isso.
- O que fica guardado no aparelho (e o que nunca fica).
- Como um pedido feito sem servidor sobe depois, sem duplicar.

## Na tela

1. A pessoa abre o sistema às 19h. A API estava dormindo. Mesmo assim, a tela abre **na hora**.
2. Quem já entrou neste aparelho nas últimas 12 horas entra direto. Quem entrou antes também pode entrar com a mesma senha, conferida no próprio aparelho.
3. O cabeçalho mostra **Conectando ao servidor**. O cardápio aparece com a cópia guardada.
4. Finalizar um pedido nesse momento mostra "Pedido de Ana (R$ 33,00) guardado neste aparelho. Vai para a cozinha assim que o servidor conectar".
5. Quando a API responde, os pedidos guardados sobem sozinhos, em ordem: "Pedido nº 15 de Ana chegou ao servidor e foi para a cozinha".
6. Se o servidor recusar um pedido guardado (preço mudou, produto desativado), uma faixa avisa o motivo, com **Abrir no Novo pedido** para corrigir.

## Por trás

| O quê                                       | Arquivo                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Estado da conexão (conectando ou conectado) | [`apps/web/src/api/conexao.ts`](../../apps/web/src/api/conexao.ts)                        |
| Cópia do cardápio no aparelho               | [`apps/web/src/api/copiaLocal.ts`](../../apps/web/src/api/copiaLocal.ts)                  |
| Pedidos guardados                           | [`telas/novo-pedido/filaPedidos.ts`](../../apps/web/src/telas/novo-pedido/filaPedidos.ts) |
| Sessão lembrada e acesso do aparelho        | [`apps/web/src/auth/acessoLocal.ts`](../../apps/web/src/auth/acessoLocal.ts)              |
| Faixa "Conectando ao servidor"              | [`layout/FaixaConexao.tsx`](../../apps/web/src/layout/FaixaConexao.tsx)                   |
| Arquivos das telas para abrir offline       | [`apps/web/public/sw.js`](../../apps/web/public/sw.js) (service worker)                   |

### O laço de conexão

`conexao.ts` começa como `'conectando'` e pergunta a `/api/vivo` em segundo plano, esperando 2 s, depois 3 s, 4,5 s… até 15 s entre tentativas. Quando a resposta é `{"status":"ok"}`, roda os "preparos" (por exemplo, o login de verdade de quem entrou sem servidor) e só então muda para `'conectado'`.

Em [`main.tsx`](../../apps/web/src/main.tsx), esse estado é ligado ao `onlineManager` do TanStack Query: enquanto está conectando, as consultas ficam em pausa (sem erro na tela) e mostram a cópia guardada.

### O que fica no aparelho

| Guardado                                                                 | Chave no `localStorage`      |
| ------------------------------------------------------------------------ | ---------------------------- |
| Produtos e categorias ativos, formas de pagamento, Pix da loja           | `patotinha.copia`            |
| Pedidos ainda não enviados                                               | `patotinha.pedidosGuardados` |
| Pedido em montagem                                                       | `patotinha.rascunho`         |
| Quem está logado e até quando                                            | `patotinha.sessao`           |
| Resumo da senha para entrar sem servidor (PBKDF2 com sal, nunca a senha) | `patotinha.acessos`          |

Pedidos, fila e relatórios **nunca** entram na cópia: mudam o tempo todo. E o preço da cópia é só o que aparece; quem confere é o servidor, ao gravar.

### Enviar sem duplicar

Cada pedido guardado leva a **mesma chave de idempotência** do rascunho ([parte 07](part-07-novo-pedido.md)). `enviarPedidosGuardados` manda um por um, em ordem. Se a conexão cai no meio, para e tenta depois. Se o servidor já tinha gravado aquele pedido antes da queda, devolve o mesmo pedido em vez de criar outro.

## Conceito novo: offline-first

**Offline-first** é desenhar o app para funcionar primeiro sem rede e sincronizar quando ela volta. Aqui não é offline completo (o servidor é a fonte da verdade), mas a regra é a mesma: **a pessoa no balcão nunca espera a rede**. Os dados que mudam pouco ficam em cópia; as ações viram uma fila; a sincronização é segura porque cada ação tem uma chave única.

## Conceito novo: hash lento de senha no aparelho

Para conferir a senha sem servidor, o aparelho guarda um **resumo** dela, gerado com PBKDF2-SHA-256, 210 mil repetições e um sal aleatório. Mesmo que alguém copie o `localStorage`, testar senhas fica muito lento. Só entra quem já entrou antes neste aparelho; uma senha nova sempre espera o servidor, e se o servidor recusar depois (senha trocada, usuário desativado), o sistema sai.

## Por que assim

- **Render grátis dorme**: pagar o plano que não dorme foi descartado (custo zero). O monitor mantém a API acordada no horário da loja, e esta parte cobre o resto (primeira abertura, internet ruim).
- **Cópia só do que muda pouco**: menos risco de mostrar dado velho.
- **Resumo da senha no aparelho** é uma troca consciente de segurança por conveniência; o Ryan pode pedir para tirar. Ver [abrir-sem-esperar.md](../abrir-sem-esperar.md).

## Experimente

1. Rode `npm run dev`, entre e abra o Novo pedido.
2. Pare a API (Ctrl+C só no processo `api`, ou feche e rode só `npm run dev -w apps/web`).
3. Faça um pedido: ele fica guardado. Abra as Ferramentas do desenvolvedor › Application › Local Storage e ache `patotinha.pedidosGuardados`.
4. Suba a API de novo e veja o pedido subir sozinho.

O teste automático que faz esse caminho é [`e2e/sem-esperar-servidor.spec.ts`](../../e2e/sem-esperar-servidor.spec.ts).

## Para conferir

<details><summary>1. O preço guardado no aparelho é o que vale na cobrança?</summary>

Não. É só o que aparece na tela. O servidor confere o preço ao gravar e recusa se mudou.
</details>

<details><summary>2. Um pedido guardado pode subir duas vezes?</summary>

Não. Ele leva a chave de idempotência; o servidor devolve o pedido já gravado.
</details>

<details><summary>3. Uma pessoa que nunca entrou neste tablet consegue entrar com a API dormindo?</summary>

Não. O aparelho não tem o resumo da senha dela; ela espera o servidor acordar.
</details>

## Fontes

- [abrir-sem-esperar.md](../abrir-sem-esperar.md)
- [web.dev: Offline cookbook](https://web.dev/articles/offline-cookbook)
- [MDN: SubtleCrypto.deriveKey (PBKDF2)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
