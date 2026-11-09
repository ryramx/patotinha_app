Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 05: login, sessão, perfis e permissões

## O que você vai aprender

- O que acontece quando alguém toca em "Entrar".
- Como o sistema lembra quem está logado (cookie com token JWT) por 12 horas.
- Como os 4 perfis e as 8 permissões decidem o que cada pessoa vê e pode fazer.

## Na tela

1. Na tela **Entrar no sistema**, a pessoa digita usuário e senha e toca em **Entrar**.
2. Ela cai na tela certa para o perfil: o Chef vai direto para a **Fila de preparo**, o Funcionário para o **Novo pedido**, o Gerente e o Administrador para o **Início**.
3. O menu só mostra o que o perfil pode usar.
4. O Administrador abre **Cadastros › Perfis e permissões** e liga ou desliga o que cada perfil pode fazer. Vale na hora.
5. Qualquer pessoa pode usar **Trocar minha senha** no menu.

## Por trás

### O login

[`apps/api/src/auth/rotas.ts`](../../apps/api/src/auth/rotas.ts), rota `POST /api/auth/login`:

1. Valida o corpo com `esquemaLogin`.
2. Confere o limite de tentativas: 5 erros por minuto, contados por IP e por login ([`limite-login.ts`](../../apps/api/src/auth/limite-login.ts)). Passou disso, responde `429`.
3. Busca o usuário e confere a senha com **Argon2id** ([`senha.ts`](../../apps/api/src/auth/senha.ts)). Se o login não existe, compara mesmo assim com um hash falso, para o tempo de resposta não revelar quais logins existem.
4. Usuário inexistente, senha errada e usuário desativado dão **a mesma mensagem**: "Usuário ou senha inválidos".
5. Deu certo: assina um token JWT com o id e o perfil e grava no cookie `sessao`, com `httpOnly`, `secure` e `sameSite: 'strict'`, válido por 12 horas.

### Cada requisição depois do login

[`apps/api/src/auth/plugin.ts`](../../apps/api/src/auth/plugin.ts) cria três protetores de rota:

| Protetor             | Quem passa                                              |
| -------------------- | ------------------------------------------------------- |
| `app.autenticar`     | Qualquer usuário logado e ativo                         |
| `app.exigir('FILA')` | Logado e com a permissão (o Administrador sempre passa) |
| `app.exigirAdmin`    | Só o Administrador                                      |

O `autenticar` não confia só no token: a cada requisição, busca o usuário no banco e confere se continua **ativo** e com o **mesmo perfil**. Por isso, desativar alguém tira o acesso na hora, sem esperar as 12 horas.

### Perfis e permissões

Definidos em [`packages/shared/src/perfis.ts`](../../packages/shared/src/perfis.ts):

| Perfil        | Permissões de fábrica                                   |
| ------------- | ------------------------------------------------------- |
| Administrador | Todas, sempre (não dá para tirar)                       |
| Gerente       | Registrar pedidos, Ver pedidos, Financeiro, Pix da loja |
| Chef          | Fila de preparo                                         |
| Funcionário   | Registrar pedidos                                       |

As permissões ficam na tabela `perfis` (coluna `permissoes`) e são lidas do banco a cada requisição. A tela de perfis grava em `PUT /api/perfis/:codigo/permissoes` ([`perfis/rotas.ts`](../../apps/api/src/perfis/rotas.ts)), que recusa mexer no perfil Administrador para ninguém trancar o sistema.

### Na tela

[`apps/web/src/App.tsx`](../../apps/web/src/App.tsx) envolve cada rota em `<Exige permissao="...">`. Sem a permissão, aparece "Seu perfil não tem acesso a esta tela". A função `telaInicial` em [`auth/sessao.tsx`](../../apps/web/src/auth/sessao.tsx) escolhe para onde cada perfil vai depois de entrar.

## Conceito novo: esconder na tela não é proteger

Esconder o botão "Resumo" do Funcionário é só conforto. Alguém esperto poderia abrir o endereço `/api/relatorios/vendas` direto. Quem **bloqueia** de verdade é a API, com `app.exigir('FINANCEIRO')`. A regra do projeto é: a tela esconde, a API bloqueia. O comentário em `sessao.tsx` diz isso: "Só esconde a tela; quem bloqueia é a API".

## Por que assim

- **Cookie `httpOnly` em vez de guardar o token no navegador**: um script malicioso na página não consegue ler o cookie.
- **`SameSite=Strict` + escritas só em JSON** (em [`app.ts`](../../apps/api/src/app.ts)): juntos, impedem que outro site faça a pessoa gravar algo sem querer (CSRF).
- **Perfis fixos com permissões editáveis**: mais simples que criar perfis livres, e cobre a loja (avó, gerente, cozinha, balcão). Detalhes em [perfis.md](../perfis.md).

## Experimente

Rode os testes de login e veja os cenários cobertos:

```powershell
npm test -w apps/api -- auth
```

Abra [`apps/api/test/auth.test.ts`](../../apps/api/test/auth.test.ts) e ache o teste do limite de tentativas.

## Para conferir

<details><summary>1. Por que senha errada e usuário inexistente dão a mesma mensagem?</summary>

Para quem tenta invadir não descobrir quais logins existem.
</details>

<details><summary>2. O administrador desativou a Maria agora. Ela ainda consegue usar o sistema até o cookie vencer?</summary>

Não. O `autenticar` confere no banco a cada requisição se o usuário está ativo.
</details>

<details><summary>3. Onde estão as permissões de fábrica de cada perfil?</summary>

Em `PERMISSOES_PADRAO`, no arquivo `packages/shared/src/perfis.ts`. Elas também são gravadas pela migração dos perfis e usadas pelo botão "Voltar ao padrão".
</details>

## Fontes

- [perfis.md](../perfis.md)
- [OWASP: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN: cookies SameSite](https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)
