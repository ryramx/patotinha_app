-- Pix da loja para o Gerente (docs/pix.md): a configuração do Pix vira a permissão PIX_LOJA,
-- que o administrador liga e desliga em "Perfis e permissões". De fábrica, Administrador e
-- Gerente têm a permissão.

ALTER TABLE perfis DROP CONSTRAINT perfis_permissoes_check;
ALTER TABLE perfis
  ADD CONSTRAINT perfis_permissoes_check
  CHECK (permissoes <@ ARRAY['PEDIDOS_REGISTRAR', 'PEDIDOS_VER', 'PEDIDOS_CANCELAR', 'FILA',
                             'FINANCEIRO', 'CARDAPIO', 'USUARIOS', 'PIX_LOJA']::VARCHAR(30)[]);

UPDATE perfis SET permissoes = array_append(permissoes, 'PIX_LOJA')
  WHERE codigo IN ('ADMIN', 'GERENTE') AND NOT ('PIX_LOJA' = ANY (permissoes));
