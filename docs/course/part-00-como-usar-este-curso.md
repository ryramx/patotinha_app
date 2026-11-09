Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 00: como usar este curso

Este curso explica, passo a passo, como o Sistema de Pedidos da Patotinha da Vovó funciona por inteiro: o que cada tela faz, o caminho que cada toque percorre até o banco de dados e por que as coisas foram feitas assim.

Ele é **didático**. As fontes de verdade continuam sendo o código, o [README](../../README.md) e os documentos de cada função em [`docs/`](../). Quando o curso e o código discordarem, o código vence e o curso deve ser corrigido no mesmo pull request.

## Para quem é

- Para o Ryan revisar e explicar o sistema (em entrevista, aula ou post).
- Para alguém que vai ajudar no código e precisa entender o todo antes de mexer.
- Para quem conhece um pouco de programação web, mas nunca viu este projeto.

## Como ler

Leia na ordem. As partes 01 a 04 dão o mapa; as partes 05 a 13 seguem o app na ordem em que a pessoa usa no balcão; as partes 14 a 16 mostram como o sistema é testado, publicado e mantido.

Cada parte tem as mesmas seções:

| Seção                   | O que tem                                                               |
| ----------------------- | ----------------------------------------------------------------------- |
| O que você vai aprender | O objetivo da parte                                                     |
| Na tela                 | O que a pessoa faz no app, com os nomes dos botões                      |
| Por trás                | O caminho da ação: tela, API, regras, banco, com os arquivos de verdade |
| Conceito novo           | Uma ideia explicada com um exemplo da própria Patotinha                 |
| Por que assim           | A decisão e a alternativa que ficou de fora                             |
| Experimente             | Um exercício pequeno e seguro no seu PC                                 |
| Para conferir           | Três perguntas, com a resposta escondida                                |
| Fontes                  | Onde ler mais                                                           |

## Índice

| Parte                                        | Assunto                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| [01](part-01-o-problema.md)                  | O problema: a pastelaria e o balcão                      |
| [02](part-02-mapa-do-sistema.md)             | Mapa do sistema: site, API, banco e pacote compartilhado |
| [03](part-03-rodando-no-pc.md)               | Rodando no PC                                            |
| [04](part-04-os-dados.md)                    | Os dados: as tabelas e por que cada uma existe           |
| [05](part-05-login-e-perfis.md)              | Login, sessão, perfis e permissões                       |
| [06](part-06-cardapio.md)                    | Cardápio: categorias e produtos                          |
| [07](part-07-novo-pedido.md)                 | Novo pedido: o coração do sistema                        |
| [08](part-08-fila-de-preparo.md)             | Fila de preparo (comanda digital)                        |
| [09](part-09-clientes.md)                    | Clientes: sugestão de nome e telefone                    |
| [10](part-10-pix-e-pagar-depois.md)          | Pix com o valor do pedido, Pagar depois e A receber      |
| [11](part-11-historico-e-resumo.md)          | Histórico, cancelamento, Resumo e carro-chefe            |
| [12](part-12-tutorial-e-visual.md)           | Tutorial, lâmpadas de ajuda, Modo Claro e Escuro         |
| [13](part-13-abrir-sem-esperar.md)           | Abrir sem esperar o servidor (uso sem internet)          |
| [14](part-14-testes-e-qualidade.md)          | Testes e qualidade                                       |
| [15](part-15-publicacao-e-operacao.md)       | Publicação e operação: Render, Neon, backup e monitor    |
| [16](part-16-glossario-e-proximos-passos.md) | Glossário e próximos passos                              |

## Como manter o curso vivo

- Função nova no app: crie uma parte nova ou atualize a parte certa **no mesmo PR** da função, e acrescente a linha no índice acima.
- Ao editar uma parte, atualize a data de `Última revisão` no topo.
- Cite só arquivos, rotas e tabelas que existem. O que ainda não roda é marcado como "planejado".
- Nunca coloque senha, chave, endereço do banco ou dado de cliente real.

## Fontes

- [README do projeto](../../README.md)
- [Verificação do MVP](../verificacao.md)
