-- Clientes (versão leve): quem já pediu aparece como sugestão no campo do nome,
-- com telefone opcional. O pedido continua guardando o nome dito no balcão.

-- Chave de busca: minúsculas, sem acentos e com um espaço só entre as palavras.
-- O app calcula a mesma chave em packages/shared/src/texto.ts (chaveCliente).
CREATE OR REPLACE FUNCTION chave_cliente(nome TEXT) RETURNS TEXT AS $$
  SELECT regexp_replace(
    btrim(lower(translate(nome,
      'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ',
      'aaaaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuuccnnyyy'))),
    '\s+', ' ', 'g')
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE clientes (
  id               BIGSERIAL    PRIMARY KEY,
  nome             VARCHAR(60)  NOT NULL CHECK (btrim(nome) <> ''),
  chave            VARCHAR(60)  NOT NULL UNIQUE CHECK (chave <> ''),
  telefone         VARCHAR(11)  CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,11}$'),
  ultimo_pedido_em TIMESTAMPTZ  NOT NULL DEFAULT now(),
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_clientes_atualizado BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

ALTER TABLE pedidos
  ADD COLUMN cliente_id BIGINT REFERENCES clientes (id) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX ix_pedidos_cliente ON pedidos (cliente_id);

-- Aproveita os nomes dos pedidos que já existem: um cliente por nome (sem diferenciar
-- maiúsculas, acentos e espaços), com a grafia do pedido mais recente.
INSERT INTO clientes (nome, chave, ultimo_pedido_em, criado_em)
SELECT DISTINCT ON (chave_cliente(cliente_nome))
       regexp_replace(btrim(cliente_nome), '\s+', ' ', 'g'),
       chave_cliente(cliente_nome),
       max(criado_em) OVER (PARTITION BY chave_cliente(cliente_nome)),
       min(criado_em) OVER (PARTITION BY chave_cliente(cliente_nome))
  FROM pedidos
 WHERE cliente_nome IS NOT NULL AND chave_cliente(cliente_nome) <> ''
 ORDER BY chave_cliente(cliente_nome), criado_em DESC, id DESC;

-- Ligar o cliente não é uma alteração do pedido: atualizado_em fica como estava.
ALTER TABLE pedidos DISABLE TRIGGER trg_pedidos_atualizado;
UPDATE pedidos p
   SET cliente_id = c.id
  FROM clientes c
 WHERE p.cliente_nome IS NOT NULL AND c.chave = chave_cliente(p.cliente_nome);
ALTER TABLE pedidos ENABLE TRIGGER trg_pedidos_atualizado;
