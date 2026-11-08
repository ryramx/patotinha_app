Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 01: o problema

## O que você vai aprender

- Para quem o sistema foi feito e em que situação ele é usado.
- Quais problemas do balcão ele resolve.
- Quais limites (de dinheiro e de tempo) moldaram as decisões técnicas.

## Na tela

A Patotinha da Vovó é a pastelaria da avó do Ryan. Ela abre **só aos sábados e domingos, das 19h às 22h**, atende **no balcão** e **não faz delivery**.

Uma noite típica no sistema:

1. Quem atende entra no sistema no computador do balcão (ou num tablet ou celular).
2. Para cada cliente, abre o **Novo pedido**, toca nos pastéis e bebidas, escreve o nome do cliente e escolhe a forma de pagamento (Dinheiro, PIX, Débito ou Crédito), ou **Pagar depois**.
3. O pedido aparece na **Fila de preparo**, aberta num tablet na cozinha. A cozinha toca em "Começar preparo", "Marcar pronto" e "Entregue ao cliente".
4. No fim da noite, a avó ou o gerente abre o **Resumo** e compara o faturamento com o caixa.

## Por trás

Antes do sistema, o pedido era anotado no papel. Os problemas eram:

- conta errada na soma e no troco;
- pedido esquecido ou trocado na cozinha;
- nenhum número confiável no fim da noite (quanto entrou em PIX, quanto em dinheiro, o que mais vendeu).

Cada problema virou uma parte do sistema:

| Problema                                | Onde o sistema resolve                                          | Parte do curso                      |
| --------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Soma e troco errados                    | O servidor calcula o total e o troco com o preço do banco       | [07](part-07-novo-pedido.md)        |
| Pedido esquecido na cozinha             | Comanda digital com nome do cliente e fila por ordem de chegada | [08](part-08-fila-de-preparo.md)    |
| Sem números no fim da noite             | Resumo por forma de pagamento e carro-chefe                     | [11](part-11-historico-e-resumo.md) |
| Pix digitado errado                     | QR Code já com o valor do pedido                                | [10](part-10-pix-e-pagar-depois.md) |
| Cliente que come primeiro e paga depois | Pagar depois e tela A receber                                   | [10](part-10-pix-e-pagar-depois.md) |

## Conceito novo: requisito não funcional

Um **requisito funcional** diz o que o sistema faz ("calcular o troco"). Um **requisito não funcional** diz como ele precisa se comportar ("abrir rápido mesmo com a internet ruim", "custar zero por mês").

Na Patotinha, os não funcionais pesaram muito:

- **Custo zero**: tudo roda em planos gratuitos (Render e Neon). O preço disso é que a API "dorme" quando ninguém usa. A [parte 13](part-13-abrir-sem-esperar.md) mostra como o sistema contorna isso.
- **Uso por quem não é da área**: telas em português simples, botões grandes, tutorial no primeiro acesso ([parte 12](part-12-tutorial-e-visual.md)).
- **Três horas por noite, dois dias por semana**: o monitor só mantém a API acordada nesse horário ([parte 15](part-15-publicacao-e-operacao.md)).

## Por que assim

Um sistema de PDV pronto custaria mensalidade e traria funções que a pastelaria não usa (estoque, nota fiscal, delivery). Um sistema próprio, pequeno e gratuito, resolve só o que dói no balcão e serve de projeto de portfólio para o Ryan.

## Experimente

Abra o [README](../../README.md) e encontre a seção "O que o sistema faz hoje". Para cada item, tente dizer qual problema do balcão ele resolve.

## Para conferir

<details><summary>1. Por que a API "dorme"?</summary>

Porque roda no plano gratuito do Render, que desliga o serviço depois de 15 minutos sem acesso.
</details>

<details><summary>2. Em que dias e horários o sistema precisa estar no ar?</summary>

Sábado e domingo, das 19h às 22h.
</details>

<details><summary>3. Quem calcula o total do pedido: a tela ou o servidor?</summary>

O servidor, sempre com o preço que está no banco. A tela só mostra uma prévia.
</details>

## Fontes

- [README do projeto](../../README.md)
