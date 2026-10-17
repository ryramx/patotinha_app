# Site separado da API (etapa 9)

## Por quê

No plano gratuito do Render, o serviço da API desliga depois de 15 minutos sem acesso e leva
cerca de 1 minuto para voltar. Quando o site e a API eram o mesmo serviço, quem abria o sistema
com ele dormindo via a tela do próprio Render ("waking up") em vez da Patotinha.

Agora são dois serviços no `render.yaml`:

| Serviço             | Tipo                 | Dorme? | O que faz                                 |
| ------------------- | -------------------- | ------ | ----------------------------------------- |
| `patotinha`         | Static Site (grátis) | Nunca  | Entrega as telas React pela CDN do Render |
| `patotinha-pedidos` | Web Service (Docker) | Sim    | API (`/api/...`) e banco Neon, como antes |

## Como funciona

- O site abre na hora e mostra a logo. Antes de qualquer tela, ele pergunta a `/api/vivo` se a API
  está acordada (componente `apps/web/src/componentes/EsperarServidor.tsx`).
- Se a API não responde logo (falha ou demora mais de 2,5 segundos), aparece **"Carregando…"** com o aviso de que o
  sistema está acordando. O site tenta de novo a cada 2 segundos.
- Depois de 2,5 minutos sem resposta, aparece "Não foi possível abrir o sistema" com o botão
  **Tentar de novo**.
- O site repassa tudo que vai para `/api/*` à API (regra de rewrite do `render.yaml`). Para o
  navegador, site e API têm o mesmo endereço: o cookie de login continua `SameSite=Strict`, sem
  CORS, e funciona no Safari do iPad.
- As respostas da API saem com `Cache-Control: no-store`, para a CDN nunca guardar dados.
- O endereço antigo (`patotinha-pedidos.onrender.com`) continua funcionando: com a variável
  `SITE_URL` definida, quem abre as telas por ele é levado ao site novo, no mesmo caminho. A API
  continua respondendo em `/api` nesse endereço, e o monitor do cron-job.org (`/api/vivo`) não
  muda.
- Sem `SITE_URL` (no PC, no Docker local e nos testes), a API continua servindo as telas como
  antes.

A aparência da tela de carregamento fica toda em `TelaCarregando`, no mesmo arquivo, e os textos
em `textos.pt-BR.json` (seção `carregando`).

## Passo a passo no Render (uma vez, depois do merge)

1. **Criar o site.** No painel do Render, abrir **Blueprints**, escolher o Blueprint deste
   repositório e clicar em **Manual sync** (se ele não sincronizar sozinho). O Render cria o
   Static Site `patotinha`. Se o sistema foi criado sem Blueprint, usar **New > Static Site** com:
   - Build command: o `buildCommand` do `render.yaml`
   - Publish directory: `apps/web/dist`
   - Variável `NODE_VERSION` = `24`
   - Em **Redirects/Rewrites**, as duas regras do `render.yaml`, na mesma ordem
   - Em **Headers**, os cabeçalhos do `render.yaml`
2. **Anotar o endereço do site**, que aparece no topo da página do serviço (por exemplo,
   `https://patotinha.onrender.com`; se o nome já existir, o Render acrescenta letras no fim).
3. **Testar:** abrir o endereço do site, entrar com o usuário e abrir um novo pedido.
4. **Ligar o redirecionamento:** no serviço `patotinha-pedidos`, **Environment** > adicionar
   `SITE_URL` com o endereço do site (sem barra no fim) > **Save changes**. A partir daí, o
   endereço antigo leva ao novo.
5. **App instalado:** nos tablets e celulares onde o app foi instalado pelo endereço antigo,
   remover o atalho antigo e instalar de novo pelo endereço novo. O antigo continua abrindo, mas
   passa pela tela do Render antes de chegar ao site.

O monitor do cron-job.org continua apontando para
`https://patotinha-pedidos.onrender.com/api/vivo`, que é a API.

## Testes

- `apps/api/test/site.test.ts`: o endereço antigo leva ao site mantendo o caminho; `/api`
  continua respondendo; respostas da API com `no-store`.
- `e2e/carregando.spec.ts`: com `/api/vivo` falhando (como no Render dormindo), aparece
  "Carregando…" com a logo e, quando a API responde, o login abre; com a API acordada, a mensagem
  não aparece.
