-- Pix com o valor do pedido (etapa 13, docs/pix.md): a chave Pix da loja, o nome do recebedor
-- e a cidade, que o administrador cadastra na tela "Pix da loja". Uma linha só (id = 1);
-- sem a linha, o Pix ainda não foi configurado e o pedido mostra o aviso.
CREATE TABLE config_pix (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tipo_chave        VARCHAR(10) NOT NULL CHECK (tipo_chave IN ('CPF', 'CNPJ', 'TELEFONE', 'EMAIL', 'ALEATORIA')),
  chave             VARCHAR(77) NOT NULL CHECK (btrim(chave) <> ''),
  nome_recebedor    VARCHAR(25) NOT NULL CHECK (btrim(nome_recebedor) <> ''),
  cidade            VARCHAR(15) NOT NULL CHECK (btrim(cidade) <> ''),
  atualizado_por_id BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_config_pix_atualizado_em BEFORE UPDATE ON config_pix
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
