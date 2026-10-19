# Sistema de Pedidos · Patotinha da Vovó

Sistema web de balcão da pastelaria Patotinha da Vovó: registra os pedidos, calcula o total no
servidor, grava a forma de pagamento e mostra o histórico e um resumo das vendas. Segue o PRD, a
descrição da interface e o plano de desenvolvimento do projeto.

**No ar:** <https://patotinha-pedidos.onrender.com> (Render + Neon, planos gratuitos; o endereço
do site separado entra aqui depois do passo a passo de [docs/site-separado.md](docs/site-separado.md)). A loja
funciona aos sábados e domingos, das 19h às 22h, só no balcão, sem delivery.

## O que o sistema faz hoje

- **Novo pedido:** produtos em abas por categoria, busca, quantidades com − e +, desfazer a
  remoção de um item, forma de pagamento (Dinheiro, PIX, Débito ou Crédito) e troco calculado
  para pagamento em dinheiro. O total é sempre recalculado no servidor com o preço atual; se um
  preço mudou enquanto o pedido era montado, a tela avisa. Finalizar duas vezes não duplica o
  pedido.
- **Comanda digital:** cada pedido leva o nome do cliente, e a tela **Fila de preparo** mostra os
  pedidos do dia por ordem de chegada (Aguardando, Preparando, Pronto), com um toque para avançar
  cada um até a entrega. Detalhes em [docs/comanda.md](docs/comanda.md).
- **Clientes (versão leve):** o campo do nome sugere quem já pediu (toque ou seta + Enter), com
  telefone opcional. Nome novo é cadastrado sozinho ao finalizar. Detalhes em
  [docs/clientes.md](docs/clientes.md).
- **Histórico e detalhe:** pedidos por período (hoje, ontem, últimos 7 dias, este mês ou datas
  escolhidas), com o detalhe de cada um. Quem tem a permissão pode cancelar um pedido informando o
  motivo.
- **Resumo de vendas** (permissão Financeiro): faturamento do período, totais por forma de pagamento,
  pedidos cancelados e produtos mais vendidos.
- **Cadastros:** categorias, produtos com preço, e usuários (Administrador, Gerente, Chef ou
  Funcionário), com ativar e desativar em vez de apagar.
- **Perfis e permissões:** Administrador (tudo), Gerente (pedidos e financeiro), Chef (fila de
  preparo) e Funcionário (só registra pedidos). O administrador liga e desliga o que cada perfil
  pode fazer na tela **Perfis e permissões**, e a API confere em toda requisição. Detalhes em
  [docs/perfis.md](docs/perfis.md).
- **Tutorial e lâmpadas de ajuda:** no primeiro acesso, cards explicam o que cada parte faz (só
  as telas do perfil da pessoa); toda tela tem uma lâmpada no cabeçalho com o passo a passo.
  Detalhes em [docs/tutorial.md](docs/tutorial.md).
- **Pix com o valor do pedido:** o pedido em PIX mostra o QR Code e o Pix copia e cola já com o
  valor, para a chave que o administrador cadastra em **Cadastros › Pix da loja**. Sem taxa; quem
  atende confere no app do banco. Detalhes em [docs/pix.md](docs/pix.md).
- **Pagar depois:** o pedido vai para a cozinha sem pagamento e aparece na tela **A receber**,
  onde o balcão cobra quando o cliente terminar (dinheiro com troco, PIX, débito ou crédito). Só
  conta nas vendas depois de recebido. Detalhes em [docs/pagar-depois.md](docs/pagar-depois.md).
- **Acesso:** login com sessão de 12 horas, troca da própria senha e limite de tentativas de
  login. Um usuário desativado perde a sessão na hora.
- **Atalhos de teclado** para o balcão (tecla `?` mostra a lista): F1 abre um novo pedido, `/`
  vai para a busca, F2 a F5 escolhem a forma de pagamento e Ctrl+Enter finaliza.
- **App instalável (PWA):** pode ser instalado no computador, tablet ou celular pelo navegador e
  abre em tela cheia com o ícone da Patotinha. Só os arquivos das telas ficam guardados no
  aparelho; pedidos e preços vêm sempre do servidor, então o sistema precisa de internet.
- **Modo Claro e Modo Escuro:** botão de lua/sol no cabeçalho; o aparelho lembra a escolha e,
  sem escolha, segue o tema do sistema. Menu em pílulas no topo (cadastros no menu "Cadastros")
  e, no celular, barra de abas no rodapé. Detalhes em [docs/visual.md](docs/visual.md).
- Telas em português, pensadas para computador (1366 x 768), tablet na horizontal e celular.

## Tecnologias

- **Backend:** Node.js + Fastify + Prisma (`apps/api`), API REST em `/api`
- **Frontend:** React + Vite + Tailwind CSS + TanStack Query (`apps/web`)
- **Compartilhado:** esquemas Zod, tipos e formatação de R$ e datas (`packages/shared`)
- **Banco:** PostgreSQL (Neon em produção; 16 ou mais novo em desenvolvimento)

## Requisitos

- Node.js 22 LTS ou mais novo (testado com o 24 LTS) e npm
- PostgreSQL 16+ instalado no computador (o desenvolvimento usa o 18) **ou** Docker Desktop com
  Docker Compose
- Git

## Primeira instalação (PostgreSQL instalado no computador)

```powershell
npm install
copy .env.example .env      # depois preencha DATABASE_URL, DATABASE_URL_TESTE e JWT_SECRET
powershell -ExecutionPolicy Bypass -File scripts\criar-banco-local.ps1   # pede a senha do "postgres"
npm run db:migrate          # aplica as migrações em DATABASE_URL
npm run seed:admin          # cria o primeiro administrador (pede nome, login e senha)
npm run seed:dev            # opcional: cardápio de exemplo e a funcionária de teste "maria"
npm run dev                 # API em http://localhost:3000 e telas em http://localhost:5173
```

O script `criar-banco-local.ps1` lê usuário e senha da `DATABASE_URL` do `.env` e cria esse
usuário no PostgreSQL **sem** permissão de superusuário, mais os bancos `patotinha` e
`patotinha_teste`. Nenhuma senha fica no código: o primeiro administrador é criado pelo
`seed:admin`, com a senha digitada na hora.

## Com Docker

```bash
cp .env.example .env        # defina POSTGRES_PASSWORD e JWT_SECRET
docker compose up --build   # sobe o PostgreSQL 16 e a aplicação em http://localhost:3000
docker compose exec app npm run seed:admin
```

## Variáveis de ambiente

| Variável             | Para quê                                                                           |
| -------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Conexão com o banco da aplicação                                                   |
| `DATABASE_URL_TESTE` | Banco só dos testes automáticos (é apagado e recriado a cada rodada)               |
| `JWT_SECRET`         | Segredo da sessão: texto longo e aleatório (32+ caracteres em produção)            |
| `NODE_ENV`           | `development`, `production` ou `test`                                              |
| `APP_ORIGIN`         | Endereço pelo qual o sistema é acessado                                            |
| `TZ`                 | `America/Sao_Paulo`                                                                |
| `PORT`               | Porta da API (padrão 3000)                                                         |
| `PASTA_WEB`          | Pasta com o build das telas, servida pela API (a imagem Docker já define)          |
| `SITE_URL`           | Só em produção: endereço do site separado; as telas abertas pela API levam para lá |

## Publicação (Render + Neon, planos gratuitos)

O `render.yaml` descreve dois serviços: o **site** (`patotinha-da-vovo`, Static Site com as telas, que
nunca dorme) e a **API** (`patotinha-pedidos`, imagem Docker do `Dockerfile`). O site repassa
`/api/*` para a API pelo mesmo endereço e mostra "Carregando…" com a logo enquanto ela acorda.
Detalhes e o passo a passo no painel em [docs/site-separado.md](docs/site-separado.md). O banco
fica num projeto do Neon na região us-east-2 (Ohio), a mesma da API. A cada publicação a imagem
aplica as migrações pendentes antes de subir.

1. **Neon:** criar um projeto (região AWS us-east-2) e copiar o endereço de conexão **direto**
   (desligar "Connection pooling", sem `-pooler` no servidor), terminado em `?sslmode=require`.
2. **Render:** New > Blueprint, escolher este repositório. Ele pede só a `DATABASE_URL`: colar o
   endereço do Neon. O `JWT_SECRET` é gerado pelo Render. Depois que o site existir, colar o
   endereço dele em `SITE_URL` no serviço `patotinha-pedidos`.
3. **GitHub** (Settings > Secrets and variables > Actions): criar `PRODUCAO_DATABASE_URL` com o
   mesmo endereço e `ADMIN_SENHA` com a senha do primeiro administrador.
4. **Primeiro admin:** aba Actions > "Criar primeiro admin" > Run workflow, com nome e login.
   Depois de entrar no sistema, apagar o segredo `ADMIN_SENHA`.
5. **Cardápio oficial:** aba Actions > "Cadastrar cardápio" > Run workflow. Cadastra os produtos
   de `apps/api/src/scripts/cardapio-oficial.ts` (com os ingredientes dos pastéis, quando o
   campo existir). Pode rodar de novo sempre que o arquivo mudar: não duplica, só acerta preço,
   categoria e ingredientes. Marcando "Desativar produtos que não estão no cardápio oficial", os
   demais produtos (ex.: de teste) e as categorias que ficarem vazias são desativados, sem sumir
   dos pedidos antigos.
6. **Monitor:** apontar um serviço de monitoramento (ex.: cron-job.org) para `/api/vivo` a cada
   10 minutos, só no horário da loja. Essa rota não consulta o banco, então o Neon continua
   podendo desligar quando parado. O `/api/saude` testa o banco também, para conferências.

Limites do plano gratuito: a API desliga depois de 15 minutos sem acesso e leva cerca de 1 minuto
para voltar (o monitor evita isso no horário da loja; fora dele, o site mostra "Carregando…"); as 750 horas mensais do Render
são divididas entre todos os apps gratuitos da conta. O Neon tem 1 GB e 100 horas de
processamento por mês, desligando depois de 5 minutos parado.

### Backup e restauração

O workflow "Backup do banco" (`.github/workflows/backup.yml`) roda todo dia às 3h (Brasília):
copia o banco com `pg_dump`, restaura a cópia num PostgreSQL vazio, confere as contagens e guarda
o arquivo por 30 dias na aba Actions. Para rodar na hora: Actions > Backup do banco > Run workflow.

Para restaurar: baixar o arquivo `patotinha-AAAA-MM-DD.dump` da execução desejada (vem dentro de
um .zip) e, num banco vazio (por exemplo, um branch novo do Neon), rodar:

```bash
pg_restore --no-owner --no-privileges --exit-on-error -d "ENDERECO_DO_BANCO_VAZIO" patotinha-AAAA-MM-DD.dump
```

Conferir os pedidos do dia e só então trocar a `DATABASE_URL` no Render para o banco restaurado.
Repetir esse teste a cada 3 meses (plano 7.6). O primeiro teste de restauração ainda não foi feito.

## Testes e qualidade

```powershell
npm run lint          # ESLint
npm run format        # Prettier (o VS Code formata ao salvar)
npm run typecheck     # TypeScript em todos os pacotes
npm test              # unitários + integração da API contra o PostgreSQL (DATABASE_URL_TESTE)
npm run test:e2e      # ponta a ponta com Playwright (usa o Edge instalado no Windows)
```

O CI (`.github/workflows/ci.yml`) roda tudo isso com um PostgreSQL 16 de serviço, mais
`npm audit`, a cada envio.

## Estrutura

```text
apps/api/        Fastify + Prisma. Módulos: auth, usuarios, cardapio, pedidos (com a fila), relatorios, pix
  prisma/        schema.prisma e migrações (DDL do PRD 15.5, com CHECKs e gatilhos)
  scripts/       seed-dev.ts (o seed-admin fica em src/scripts para rodar também no servidor)
  test/          testes de integração (Supertest) contra PostgreSQL real
apps/web/        React. telas/, componentes/, layout/, estilos/tokens.css, textos.pt-BR.json
  public/        manifest.webmanifest, sw.js (app instalável), logo, ícones e favicon
packages/shared/ Esquemas Zod usados na tela e na API, tipos e formatação
e2e/             Testes Playwright (fluxo do pedido do exemplo, comanda, clientes, tutorial, Pix, pagar depois, tablet, preço alterado)
docs/            verificacao.md: critérios de aceitação, segurança e tempos medidos (etapa 6)
                 comanda.md: nome do cliente e fila de preparo
                 clientes.md: sugestão de clientes e telefone opcional
                 perfis.md: perfis de acesso e a tela de permissões (etapa 10)
                 tutorial.md: tutorial de primeiro acesso e lâmpadas de ajuda (etapa 12)
                 pix.md: Pix com o valor do pedido e a tela Pix da loja (etapa 13)
                 pagar-depois.md: Pagar depois e a tela A receber (etapa 15)
                 site-separado.md: site no Static Site, tela "Carregando…" e passo a passo
  marca/         Arte original da logo e a versão sem fundo
scripts/         Banco local (PowerShell) e geração da logo e dos ícones (Python)
render.yaml      Site (Static Site) e API (Docker) no Render, plano gratuito, Ohio
.github/         CI, backup diário do banco e criação do primeiro admin
```

## Logo e ícones

A arte original da família está em `docs/marca/logo-original.png`. Para refazer a logo das telas,
os ícones do app instalável e o favicon depois de trocar a arte:

```
python3 scripts/recortar-logo.py docs/marca/logo-original.png docs/marca/logo-transparente.png
python3 scripts/gerar-icones.py docs/marca/logo-transparente.png apps/web/public
```

Ao trocar os ícones, suba a `VERSAO` em `apps/web/public/sw.js` para os aparelhos buscarem os novos.

## Situação atual

As etapas 1 a 6 do plano estão concluídas (96 de 96 testes da API e 11 de 11 ponta a ponta; ver
`docs/verificacao.md`) e a publicação da etapa 7 está feita: o sistema está no ar, com o primeiro
administrador criado, backup diário e monitor no horário da loja.

## Pendências conhecidas

- Apagar o segredo `ADMIN_SENHA` do GitHub, agora que o primeiro administrador já entrou.
- Cadastrar o cardápio real e os usuários dos funcionários em produção (Chef, Gerente e
  Funcionário; ver [docs/perfis.md](docs/perfis.md)).
- Testar no Safari (iPad ou Mac), num tablet de verdade e com alguém que nunca usou o sistema.
- Fazer o primeiro teste de restauração do backup.
- Piloto na loja, comparando o resumo diário com o caixa.
- As decisões pendentes do PRD (seção 20) seguem a sugestão do próprio PRD; os limites de campo
  seguem a tabela final do plano (quantidade 1 a 99, nome de produto 2 a 80, categoria 2 a 40,
  login 3 a 30 só minúsculas, motivo 5 a 200, preço até R$ 9.999,99).
