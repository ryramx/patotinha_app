-- Comanda digital: nome do cliente no pedido e fila de preparo.
-- Pedidos antigos ficam sem nome e já como ENTREGUE, para não aparecerem na fila.

ALTER TABLE pedidos
  ADD COLUMN cliente_nome VARCHAR(60) CHECK (cliente_nome IS NULL OR btrim(cliente_nome) <> ''),
  ADD COLUMN status_preparo VARCHAR(20) NOT NULL DEFAULT 'ENTREGUE'
    CHECK (status_preparo IN ('AGUARDANDO', 'PREPARANDO', 'PRONTO', 'ENTREGUE')),
  ADD COLUMN preparo_atualizado_em TIMESTAMPTZ;

-- Daqui em diante, todo pedido novo entra na fila como AGUARDANDO.
ALTER TABLE pedidos ALTER COLUMN status_preparo SET DEFAULT 'AGUARDANDO';

-- Fila: pedidos ainda não entregues, por ordem de chegada.
CREATE INDEX ix_pedidos_fila ON pedidos (criado_em)
  WHERE status = 'FINALIZADO' AND status_preparo <> 'ENTREGUE';
