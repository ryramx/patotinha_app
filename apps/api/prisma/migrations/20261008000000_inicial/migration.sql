-- Migração inicial: DDL do PRD 15.5, com a chave de idempotência do PRD 6.5.
-- Escrita à mão porque o Prisma não gera CHECKs, índices em lower() nem gatilhos.

-- Função para manter atualizado_em
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Usuários
CREATE TABLE usuarios (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          VARCHAR(100) NOT NULL CHECK (btrim(nome) <> ''),
  login         VARCHAR(50)  NOT NULL CHECK (login ~ '^[a-zA-Z0-9._-]{3,50}$'),
  senha_hash    VARCHAR(255) NOT NULL,
  perfil        VARCHAR(20)  NOT NULL CHECK (perfil IN ('ADMIN', 'FUNCIONARIO')),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_usuarios_login ON usuarios (lower(login));
CREATE TRIGGER trg_usuarios_atualizado BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Categorias
CREATE TABLE categorias (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          VARCHAR(60) NOT NULL CHECK (btrim(nome) <> ''),
  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_categorias_nome ON categorias (lower(nome));
CREATE TRIGGER trg_categorias_atualizado BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Produtos
CREATE TABLE produtos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria_id  BIGINT        NOT NULL REFERENCES categorias (id) ON DELETE RESTRICT,
  nome          VARCHAR(100)  NOT NULL CHECK (btrim(nome) <> ''),
  preco         NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  ativo         BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_produtos_nome ON produtos (lower(nome));
CREATE INDEX ix_produtos_categoria ON produtos (categoria_id);
CREATE TRIGGER trg_produtos_atualizado BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Formas de pagamento (lista fixa)
CREATE TABLE formas_pagamento (
  id     SMALLINT    PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nome   VARCHAR(40) NOT NULL,
  ativo  BOOLEAN     NOT NULL DEFAULT TRUE
);
INSERT INTO formas_pagamento (id, codigo, nome) VALUES
  (1, 'DINHEIRO', 'Dinheiro'),
  (2, 'PIX',      'PIX'),
  (3, 'DEBITO',   'Cartão de débito'),
  (4, 'CREDITO',  'Cartão de crédito');

-- Pedidos
CREATE TABLE pedidos (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status              VARCHAR(20)   NOT NULL
                      CHECK (status IN ('ABERTO', 'FINALIZADO', 'CANCELADO')),
  usuario_id          BIGINT        NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  forma_pagamento_id  SMALLINT      REFERENCES formas_pagamento (id) ON DELETE RESTRICT,
  total               NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  valor_recebido      NUMERIC(10,2) CHECK (valor_recebido >= 0),
  troco               NUMERIC(10,2) CHECK (troco >= 0),
  chave_idempotencia  UUID          UNIQUE,
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  finalizado_em       TIMESTAMPTZ,
  cancelado_em        TIMESTAMPTZ,
  cancelado_por_id    BIGINT        REFERENCES usuarios (id) ON DELETE RESTRICT,
  motivo_cancelamento VARCHAR(255),
  atualizado_em       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Finalizado exige pagamento e data de finalização
  CONSTRAINT ck_pedidos_finalizado CHECK (
    status <> 'FINALIZADO'
    OR (forma_pagamento_id IS NOT NULL AND finalizado_em IS NOT NULL)
  ),
  -- Dados de cancelamento existem se, e somente se, o pedido está cancelado
  CONSTRAINT ck_pedidos_cancelamento CHECK (
    (status = 'CANCELADO') = (
      cancelado_em IS NOT NULL
      AND cancelado_por_id IS NOT NULL
      AND motivo_cancelamento IS NOT NULL
      AND btrim(motivo_cancelamento) <> ''
    )
  ),
  -- Troco só com valor recebido, e sempre coerente com o total
  CONSTRAINT ck_pedidos_troco CHECK (
    (valor_recebido IS NULL AND troco IS NULL)
    OR (valor_recebido >= total AND troco = valor_recebido - total)
  )
);
CREATE INDEX ix_pedidos_criado_em      ON pedidos (criado_em DESC);
CREATE INDEX ix_pedidos_status_criado  ON pedidos (status, criado_em);
CREATE INDEX ix_pedidos_usuario        ON pedidos (usuario_id);
CREATE INDEX ix_pedidos_forma_pgto     ON pedidos (forma_pagamento_id);
CREATE TRIGGER trg_pedidos_atualizado BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Itens do pedido (imutáveis após gravados)
CREATE TABLE itens_pedido (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id      BIGINT        NOT NULL REFERENCES pedidos (id) ON DELETE RESTRICT,
  produto_id     BIGINT        NOT NULL REFERENCES produtos (id) ON DELETE RESTRICT,
  nome_produto   VARCHAR(100)  NOT NULL,
  quantidade     INTEGER       NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
  subtotal       NUMERIC(10,2) NOT NULL,
  CONSTRAINT ck_itens_subtotal CHECK (subtotal = quantidade * preco_unitario),
  CONSTRAINT uq_itens_pedido_produto UNIQUE (pedido_id, produto_id)
);
CREATE INDEX ix_itens_produto ON itens_pedido (produto_id);
-- (pedido_id já é coberto pelo índice da UNIQUE acima)
