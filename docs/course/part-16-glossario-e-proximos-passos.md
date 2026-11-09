Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 16: glossário e próximos passos

## O que você vai aprender

- O significado dos termos que aparecem no curso.
- O que ainda está pendente no projeto.

## Glossário

| Termo             | O que é, na Patotinha                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| API               | O servidor Fastify em `apps/api`, que recebe as requisições em `/api`         |
| Argon2id          | O algoritmo que transforma a senha em hash antes de guardar                   |
| BR Code           | O texto do Pix copia e cola, no padrão EMV do Banco Central                   |
| CA-xx             | Critério de aceitação do PRD; cada um tem teste em `docs/verificacao.md`      |
| Centavos          | Como o dinheiro é calculado no código: R$ 8,50 = `850`                        |
| CHECK             | Regra gravada no próprio banco, que recusa dados incoerentes                  |
| CI                | O workflow que roda lint, tipos e testes a cada envio                         |
| Cookie `httpOnly` | Cookie que o JavaScript da página não consegue ler                            |
| CSRF              | Ataque em que outro site faz a pessoa gravar algo sem querer                  |
| Idempotência      | Repetir a mesma ação não muda o resultado (finalizar duas vezes = um pedido)  |
| JWT               | O token assinado que diz quem está logado, guardado no cookie `sessao`        |
| Migração          | Arquivo SQL versionado que muda a estrutura do banco                          |
| Monorepo          | Um repositório com vários pacotes (`apps/api`, `apps/web`, `packages/shared`) |
| Offline-first     | Funcionar primeiro sem rede e sincronizar depois                              |
| Polling           | Perguntar de novo a cada intervalo (a fila, a cada 10 s)                      |
| Prisma            | A biblioteca que fala com o PostgreSQL e gera os tipos                        |
| PWA               | App instalável pelo navegador, com ícone e tela cheia                         |
| RN-xx             | Regra de negócio do PRD citada no código                                      |
| Service worker    | Script do navegador que guarda os arquivos das telas (`sw.js`)                |
| Token de design   | Nome para uma cor ou medida (`--cor-fundo`), trocado pelo tema                |
| Transação         | Grupo de gravações "tudo ou nada"                                             |
| Upsert            | Inserir ou, se já existe, atualizar (`ON CONFLICT`)                           |
| Zod               | Biblioteca dos esquemas que validam dados na tela e na API                    |

## Próximos passos do projeto

Pendências conhecidas (fonte: [README](../../README.md)):

- Testar no Safari (iPad ou Mac), num tablet de verdade e com alguém que nunca usou o sistema.
- Fazer o primeiro teste de restauração do backup.
- Cadastrar a chave Pix real e testar com R$ 1,00.
- Testar Pagar depois no balcão num sábado.
- Piloto na loja, comparando o Resumo diário com o caixa.
- Fidelidade e fiado: planejados só depois do piloto.

## Próximos passos de estudo

Se você chegou até aqui, tente:

1. Ler `apps/api/src/pedidos/servico.ts` inteiro e explicar cada passo em voz alta.
2. Seguir um pedido do toque na tela até a linha em `itens_pedido`, usando as Ferramentas do desenvolvedor (aba Rede) e o `psql`.
3. Escolher uma pendência acima e escrever o plano dela antes de programar.

## Fontes

- [Parte 00: índice do curso](part-00-como-usar-este-curso.md)
