# Visual: Modo Claro e Modo Escuro

Desde 2026-10-17 o sistema tem dois temas, escolhidos pelo botão de lua/sol no cabeçalho:

| Item                                  | Modo Claro ("Balcão Limpo")      | Modo Escuro ("Noite no Balcão") |
| ------------------------------------- | -------------------------------- | ------------------------------- |
| Fundo / cartões                       | `#F6F3EF` / branco               | `#140D0B` / `#231715`           |
| Cabeçalho                             | branco                           | `#1C1210`                       |
| Destaque, botão principal, item ativo | vermelho `#B3161B`, texto branco | dourado `#FFC23D`, texto marrom |
| Preço nos cartões                     | Plus Jakarta Sans, cor do texto  | Oswald dourado                  |
| Total do pedido                       | Oswald 44 px                     | Oswald 44 px dourado            |

Login e "Carregando…" ficam no vinho da marca nos dois temas. Na impressão vale sempre o claro.

## Como funciona

- `apps/web/src/tema.ts` guarda a escolha no aparelho (`localStorage`, chave `patotinha.tema`).
  Sem escolha, segue `prefers-color-scheme` do sistema e acompanha quando ele muda.
- O tema vai no atributo `data-tema` do `<html>`. `apps/web/src/estilos/tokens.css` define as
  cores do claro em `:root` e as do escuro em `:root[data-tema='escuro']`, dentro de
  `@media screen`.
- Os componentes usam só os nomes das cores do Tailwind (`moldura`, `acao`, `superficie`,
  `preco`, `total` etc.), nunca o hex. `moldura` é o destaque: vermelho no claro, dourado no escuro.
- A cor da barra do navegador (`theme-color`) acompanha o tema.

## Menu

- Computador e tablet: menu em pílulas no topo (Novo pedido, Fila de preparo, Histórico, Início;
  Resumo e o menu "Cadastros" com Produtos, Categorias e Usuários para o administrador).
- Celular: barra de abas fixa no rodapé (Novo, Fila, Histórico, Início e, para o administrador,
  "Mais").

## Fontes

Plus Jakarta Sans no texto e nos títulos (`@fontsource/plus-jakarta-sans`), Oswald nos números
grandes e Pacifico só de enfeite.

O teste `e2e/tema.spec.ts` confere a troca de tema e que a escolha sobrevive a recarregar.
