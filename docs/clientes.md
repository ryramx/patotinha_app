# Clientes (versão leve): sugestão do nome e telefone opcional

Adicionada em 17/10/2026, a pedido do Ryan. Não é uma ficha de cadastro: no balcão, com fila no
fim de semana e sem delivery, nada pode atrasar o pedido. O sistema só lembra quem já pediu,
para não precisar digitar o nome inteiro de novo e para guardar um telefone quando a família
quiser. Fidelidade ("10º pastel grátis") e fiado ficam para depois do piloto, se os nomes se
repetirem bastante.

## Como fica no balcão

1. **Novo pedido**, campo **Nome do cliente**: ao digitar duas ou três letras, aparece a lista
   **Clientes que já pediram** com até 6 nomes, quem pediu por último primeiro. Cada linha
   mostra o nome, o telefone (se tiver) e quantos pedidos a pessoa já fez.
2. Para escolher: toque na linha, ou **seta para baixo** e **Enter** no teclado. **Esc** fecha a
   lista. A busca ignora acentos e maiúsculas e aceita qualquer parte do nome ("bene" acha
   "Seu Benedito"; "silva jose" acha "José da Silva").
3. Nome novo: é só digitar e finalizar, como antes. O cliente é cadastrado sozinho quando o
   pedido é finalizado; não existe tela nem passo extra.
4. **Telefone (opcional)**: o link **Adicionar telefone (opcional)** abre o campo, que formata
   enquanto digita: (11) 98765-4321. Telefone incompleto deixa o Finalizar desabilitado com a
   dica "Telefone com DDD, como (11) 98765-4321". Ao escolher um cliente que já tem telefone, ele
   aparece numa linha só, com **Trocar**, para não ocupar o espaço dos itens.
5. Se a internet cair, a lista só não aparece; o pedido continua saindo normalmente.

## Regras

- RN-CL1: um cliente por nome. "Seu João", "seu joão" e "Seu Joao" são o mesmo cliente (sem
  diferenciar maiúsculas, acentos e espaços).
- RN-CL2: todo pedido finalizado liga o pedido ao cliente, criando o cliente se ele não existir.
  O cadastro fica com a grafia do pedido mais recente.
- RN-CL3: o pedido continua guardando o nome como foi dito no balcão (comanda, histórico e
  detalhe não mudam).
- RN-CL4: telefone é opcional, só números com DDD (10 ou 11 dígitos). Pedido sem telefone não
  apaga o telefone já guardado; pedido com telefone substitui o anterior.
- RN-CL5: trocar o nome depois de escolher uma sugestão tira o telefone que veio dela.
- Os nomes dos pedidos que já existiam viraram clientes na migração, com os pedidos ligados a
  eles. Pedidos de antes da comanda (sem nome) ficam sem cliente.

## Técnico

- Migração `apps/api/prisma/migrations/20261017010000_clientes`: tabela `clientes` (`nome`,
  `chave` única, `telefone` com CHECK de 10 ou 11 dígitos, `ultimo_pedido_em`) e coluna
  `cliente_id` em `pedidos` (com índice `ix_pedidos_cliente`). A função SQL `chave_cliente`
  calcula a mesma chave que `chaveCliente` em `packages/shared/src/texto.ts` (há teste
  comparando as duas). O preenchimento a partir dos pedidos antigos não muda o `atualizado_em`
  deles. Roda sozinha no Render (`prisma migrate deploy` no início do contêiner), sem perder
  pedidos.
- API:
  - `POST /api/pedidos` aceita `telefone` (opcional, com ou sem máscara). O cliente é criado ou
    atualizado na mesma transação do pedido, com `INSERT ... ON CONFLICT (chave)`, então dois
    pedidos ao mesmo tempo com um nome novo não duplicam o cliente.
  - `GET /api/clientes?busca=jo`: até 6 sugestões `{ id, nome, telefone, pedidos,
ultimoPedidoEm }`, para quem pode registrar pedidos (permissão `PEDIDOS_REGISTRAR`; o Chef não vê).
- Tela: `apps/web/src/telas/novo-pedido/CampoCliente.tsx` (combobox acessível, com
  `role="combobox"` e `listbox`). O rascunho do pedido guarda o telefone junto.
- Testes: `apps/api/test/clientes.test.ts` (9 cenários, incluindo a migração) e
  `e2e/pedido-clientes.spec.ts`.

Registrado também no PRD (4.11, 6.8, 8.12, 14.11 e CA-15), na Interface (Novo pedido) e no Plano
(etapa 11).
