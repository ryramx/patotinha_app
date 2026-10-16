-- Ingredientes do produto (opcional). Só acrescenta a coluna: os produtos existentes ficam
-- com NULL e nada é apagado.
ALTER TABLE produtos ADD COLUMN ingredientes VARCHAR(300);
