Dono: Ryan · Status: atual · Última revisão: 2026-11-08

# Parte 12: tutorial, lâmpadas de ajuda, Modo Claro e Escuro

## O que você vai aprender

- Como o tutorial de primeiro acesso mostra só o que o perfil usa.
- Onde ficam os textos das telas e por que eles não estão espalhados pelo código.
- Como o Modo Claro e o Modo Escuro trocam todas as cores de uma vez.

## Na tela

1. No **primeiro acesso**, aparecem cards: "Olá, Maria! Que bom ter você aqui", depois um card para cada tela que o perfil abre. Fechou ou terminou, não aparecem mais sozinhos.
2. Em toda tela há uma **lâmpada** no cabeçalho ("Como funciona") com o passo a passo daquela tela, e o botão **Ver tutorial** para rever os cards.
3. O botão de **lua/sol** troca entre Modo Claro (vermelho e branco) e Modo Escuro (dourado e marrom). O aparelho lembra a escolha.
4. No computador, o menu fica em pílulas no topo; no celular, vira uma barra de abas no rodapé.

## Por trás

| O quê                           | Arquivo                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Textos dos cards e das lâmpadas | [`apps/web/src/ajuda/conteudo.ts`](../../apps/web/src/ajuda/conteudo.ts) (`CARDS_TUTORIAL` e `AJUDA_TELAS`)                                      |
| Cards e lâmpada                 | [`ajuda/Tutorial.tsx`](../../apps/web/src/ajuda/Tutorial.tsx), [`ajuda/Lampada.tsx`](../../apps/web/src/ajuda/Lampada.tsx)                       |
| Quando o usuário viu o tutorial | Coluna `usuarios.tutorial_visto_em` e `PUT /api/auth/tutorial` em [`auth/rotas.ts`](../../apps/api/src/auth/rotas.ts)                            |
| Cabeçalho, menu e abas          | [`layout/Moldura.tsx`](../../apps/web/src/layout/Moldura.tsx)                                                                                    |
| Textos de todas as telas        | [`apps/web/src/textos.pt-BR.json`](../../apps/web/src/textos.pt-BR.json), lidos pela função `t()` de [`textos.ts`](../../apps/web/src/textos.ts) |
| Tema                            | [`apps/web/src/tema.ts`](../../apps/web/src/tema.ts) e [`estilos/tokens.css`](../../apps/web/src/estilos/tokens.css)                             |

### Tutorial só do perfil

Cada card tem um campo `exige` com as permissões. O card "Fila de preparo" tem `exige: ['FILA']`, então só quem tem essa permissão vê. Ao fechar, a tela chama `PUT /api/auth/tutorial`, que grava a hora em `tutorial_visto_em` **só se ainda estiver vazia**. O tutorial é por usuário, não por aparelho.

Tela nova no sistema precisa de uma entrada em `AJUDA_TELAS`, senão a lâmpada fica sem texto.

### Textos num arquivo só

Nenhum texto de tela fica solto nos componentes. Por exemplo, o botão de finalizar usa `t('pedido.finalizar')`, que lê "Finalizar pedido" do JSON. Variáveis entram entre chaves: `t('sucesso.pedidoGravado', { numero, cliente, total })`.

### Tema por tokens

`tokens.css` define as cores com nomes de uso (`--cor-fundo`, `--cor-texto`, `--cor-borda`…). Os componentes usam só esses nomes, nunca o hex. O Modo Escuro redefine os mesmos nomes quando o `<html>` tem `data-tema="escuro"`. `tema.ts` lê a escolha guardada no aparelho (`patotinha.tema`) ou, sem escolha, o tema do sistema operacional.

## Conceito novo: design tokens

Um **token de design** é um nome para uma decisão visual: "a cor do texto", "o fundo do cartão". Em vez de 200 lugares com `#1f1412`, há 200 lugares com `var(--cor-texto)` e **um** lugar que diz quanto vale. Trocar o tema vira trocar os valores dos tokens, e o resto do app acompanha.

## Por que assim

- **Tutorial por perfil**: o Chef não precisa saber do Resumo; menos texto, mais chance de ler.
- **Gravado no servidor**: a pessoa que já viu no computador não vê de novo no tablet.
- **Textos em JSON**: dá para revisar o português de todas as telas num arquivo só, e um dia traduzir.
- **Escuro só na tela**: na impressão do Resumo, o sistema sempre usa o claro, para não gastar tinta.

## Experimente

1. Em `textos.pt-BR.json`, troque `"finalizar": "Finalizar pedido"` por outro texto, rode `npm run dev` e veja o botão mudar (desfaça depois).
2. Em `tokens.css`, ache `--cor-fundo` nos dois temas e compare os valores.

## Para conferir

<details><summary>1. O Funcionário vê o card do Resumo no tutorial?</summary>

Não. O card do Resumo exige a permissão Financeiro, que o Funcionário não tem de fábrica.
</details>

<details><summary>2. Fiz uma tela nova. O que preciso acrescentar para a lâmpada funcionar?</summary>

Uma entrada em `AJUDA_TELAS`, em `apps/web/src/ajuda/conteudo.ts`.
</details>

<details><summary>3. Onde o aparelho guarda o tema escolhido?</summary>

No `localStorage`, na chave `patotinha.tema`.
</details>

## Fontes

- [tutorial.md](../tutorial.md), [visual.md](../visual.md)
- [MDN: propriedades personalizadas (variáveis CSS)](https://developer.mozilla.org/pt-BR/docs/Web/CSS/Using_CSS_custom_properties)
