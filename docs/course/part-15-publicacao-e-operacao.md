Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 15: publicação e operação

## O que você vai aprender

- Como o código sai do GitHub e vira o sistema no ar.
- Onde ficam os segredos e como mudanças no banco de produção são feitas sem terminal.
- Como o backup diário e o monitor funcionam.

## Na tela

O sistema está em `https://patotinha-da-vovo.onrender.com`. A API fica em `https://patotinha-pedidos.onrender.com`, mas ninguém precisa abrir esse endereço: quem abre é levado ao site.

## Por trás

### Do merge ao ar

1. Um PR é mesclado no `main`.
2. O Render vê a mudança (`autoDeploy: true` no [`render.yaml`](../../render.yaml)) e publica os dois serviços:
   - **Site** `patotinha-da-vovo`: compila `shared` e `web` e publica `apps/web/dist` na CDN, com cabeçalhos de segurança (CSP, `X-Frame-Options`…) e cache longo só para arquivos com hash no nome.
   - **API** `patotinha-pedidos`: monta a imagem do [`Dockerfile`](../../Dockerfile) em duas fases (compilar; depois só o necessário para rodar, como usuário `node`) e, ao subir, roda `npx prisma migrate deploy` antes de `node dist/servidor.js`.
3. O Render checa a saúde em `/api/vivo`.

### Segredos

| Segredo                               | Onde fica                             | Quem usa                               |
| ------------------------------------- | ------------------------------------- | -------------------------------------- |
| `DATABASE_URL` (Neon, conexão direta) | Painel do Render, colado à mão        | API                                    |
| `JWT_SECRET`                          | Gerado pelo Render                    | API                                    |
| `SITE_URL`                            | Painel do Render                      | API (leva quem abre a API para o site) |
| `PRODUCAO_DATABASE_URL`               | GitHub › Settings › Secrets › Actions | Workflows de backup, cardápio e admin  |

Nenhum deles está no repositório. O log da API esconde cookie, senha e hash (`opcoesLog` em [`app.ts`](../../apps/api/src/app.ts)).

### Mexer no banco de produção sem terminal

O plano gratuito do Render não tem terminal. Por isso, tarefas no banco de produção são **workflows do GitHub Actions**, rodados à mão na aba Actions:

| Workflow                                                             | Para quê                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Criar primeiro admin](../../.github/workflows/criar-admin.yml)      | Uma vez, depois da primeira publicação                     |
| [Cadastrar cardápio](../../.github/workflows/cadastrar-cardapio.yml) | Grava o cardápio oficial ([parte 06](part-06-cardapio.md)) |
| [Backup do banco](../../.github/workflows/backup.yml)                | Todo dia às 3h de Brasília, ou na hora                     |

### Backup

O Neon gratuito só volta 6 horas no tempo. O workflow de backup faz `pg_dump`, **restaura a cópia num PostgreSQL vazio**, confere as contagens (usuários, produtos, pedidos, último pedido) e só então guarda o arquivo por 30 dias. Um backup que não restaura não serve; por isso ele é testado toda vez. O passo a passo para restaurar está no [README](../../README.md).

### Monitor

Um serviço externo (cron-job.org) chama `/api/vivo` a cada 10 minutos, só sábado e domingo das 18h às 22h. Isso mantém a API acordada no horário da loja. `/api/vivo` não toca no banco, então o Neon continua podendo desligar quando parado e não gasta as horas grátis.

## Conceito novo: infraestrutura como código

O `render.yaml` é um **Blueprint**: descreve os serviços, as rotas, os cabeçalhos e as variáveis num arquivo versionado. Se a conta do Render sumisse, daria para recriar tudo apontando para o repositório. E toda mudança de infraestrutura passa por PR, como o código.

## Por que assim

- **Render + Neon gratuitos**: custo zero, com o preço de a API dormir ([parte 13](part-13-abrir-sem-esperar.md)).
- **Ohio**: API ao lado do banco (us-east-2), para cada consulta ser rápida.
- **Migrações no início do contêiner**: impossível subir código novo com banco velho.
- **Backup no GitHub**: fora do Neon, de graça, e com restauração conferida.

## Experimente

Na aba Actions do repositório, abra a última execução de **Backup do banco** e ache a saída do passo "Restaurar num banco vazio e conferir". Quantos pedidos havia?

## Para conferir

<details><summary>1. Onde fica a senha do banco de produção?</summary>

No painel do Render (`DATABASE_URL`) e nos segredos do GitHub (`PRODUCAO_DATABASE_URL`). Nunca no código.
</details>

<details><summary>2. Como uma migração nova chega ao banco de produção?</summary>

No próximo deploy da API: o contêiner roda `prisma migrate deploy` antes de subir.
</details>

<details><summary>3. Por que o monitor usa /api/vivo e não /api/saude?</summary>

Porque `/api/vivo` não toca no banco: mantém a API acordada sem impedir o Neon de desligar.
</details>

## Fontes

- [README, seções Publicação e Backup](../../README.md)
- [site-separado.md](../site-separado.md)
- [Render Blueprints](https://render.com/docs/infrastructure-as-code)
- [Neon: limites do plano gratuito](https://neon.tech/docs/introduction/plans)
