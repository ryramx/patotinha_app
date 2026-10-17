-- Perfis de acesso (etapa 10, docs/perfis.md): Administrador, Gerente, Chef e Funcionário.
-- Cada perfil guarda a lista de permissões que o administrador liga e desliga na tela
-- "Perfis e permissões". Os usuários que já existem continuam com o perfil que tinham.

CREATE TABLE perfis (
  codigo        VARCHAR(20) PRIMARY KEY CHECK (codigo IN ('ADMIN', 'GERENTE', 'CHEF', 'FUNCIONARIO')),
  nome          VARCHAR(40) NOT NULL CHECK (btrim(nome) <> ''),
  permissoes    VARCHAR(30)[] NOT NULL DEFAULT '{}'
                CHECK (permissoes <@ ARRAY['PEDIDOS_REGISTRAR', 'PEDIDOS_VER', 'PEDIDOS_CANCELAR',
                                           'FILA', 'FINANCEIRO', 'CARDAPIO', 'USUARIOS']::VARCHAR(30)[]),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_perfis_atualizado_em BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Permissões de fábrica (iguais a PERMISSOES_PADRAO em packages/shared/src/perfis.ts).
-- O administrador sempre pode tudo, inclusive o que não está na lista.
INSERT INTO perfis (codigo, nome, permissoes) VALUES
  ('ADMIN', 'Administrador',
   ARRAY['PEDIDOS_REGISTRAR', 'PEDIDOS_VER', 'PEDIDOS_CANCELAR', 'FILA', 'FINANCEIRO', 'CARDAPIO', 'USUARIOS']),
  ('GERENTE', 'Gerente', ARRAY['PEDIDOS_REGISTRAR', 'PEDIDOS_VER', 'FINANCEIRO']),
  ('CHEF', 'Chef', ARRAY['FILA']),
  ('FUNCIONARIO', 'Funcionário', ARRAY['PEDIDOS_REGISTRAR']);

-- O perfil do usuário passa a apontar para a tabela de perfis, no lugar da lista fixa.
ALTER TABLE usuarios DROP CONSTRAINT usuarios_perfil_check;
ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_perfil FOREIGN KEY (perfil) REFERENCES perfis (codigo)
  ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE INDEX ix_usuarios_perfil ON usuarios (perfil);
