import { describe, expect, it } from 'vitest';
import {
  crc16Pix,
  esquemaConfigPix,
  gerarPixCopiaECola,
  identificadorPix,
  normalizarChavePix,
} from './pix.js';

describe('Pix copia e cola', () => {
  it('gera o exemplo do manual do BR Code do Banco Central, com o mesmo CRC', () => {
    expect(
      gerarPixCopiaECola({
        chave: '123e4567-e12b-12d1-a456-426655440000',
        nome: 'Fulano de Tal',
        cidade: 'BRASILIA',
      }),
    ).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  it('põe o valor com duas casas e o número do pedido como identificador', () => {
    const codigo = gerarPixCopiaECola({
      chave: '+5511987654321',
      nome: 'Patotinha da Vovó',
      cidade: 'São Paulo',
      valorCentavos: 2350,
      identificador: 'PEDIDO 42',
    });
    expect(codigo).toContain('0114+5511987654321');
    expect(codigo).toContain('540523.50');
    expect(codigo).toContain('5917Patotinha da Vovo');
    expect(codigo).toContain('6009Sao Paulo');
    expect(codigo).toContain('62120508PEDIDO42');
    // O CRC no fim confere com o resto do código.
    expect(codigo.slice(-4)).toBe(crc16Pix(codigo.slice(0, -4)));
  });

  it('corta nome e cidade nos limites do padrão', () => {
    const codigo = gerarPixCopiaECola({
      chave: '12345678909',
      nome: 'Pastelaria Patotinha da Vovó Ltda',
      cidade: 'São José dos Campos',
      valorCentavos: 100,
    });
    expect(codigo).toContain('5925Pastelaria Patotinha da V');
    expect(codigo).toContain('6015Sao Jose dos Ca');
  });

  it('identificador só com letras e números, até 25', () => {
    expect(identificadorPix('Pedido #7 (balcão)!')).toBe('Pedido7balcao');
    expect(identificadorPix('')).toBe('***');
    expect(identificadorPix('A'.repeat(40))).toHaveLength(25);
  });
});

describe('chave Pix', () => {
  it('normaliza cada tipo e recusa o que não serve', () => {
    expect(normalizarChavePix('CPF', '123.456.789-09')).toBe('12345678909');
    expect(normalizarChavePix('CPF', '123.456.789-00')).toBeNull();
    expect(normalizarChavePix('CNPJ', '11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizarChavePix('CNPJ', '11.222.333/0001-80')).toBeNull();
    expect(normalizarChavePix('TELEFONE', '(11) 98765-4321')).toBe('+5511987654321');
    expect(normalizarChavePix('TELEFONE', '+55 11 98765-4321')).toBe('+5511987654321');
    expect(normalizarChavePix('TELEFONE', '98765-4321')).toBeNull();
    expect(normalizarChavePix('EMAIL', ' Vovo@Patotinha.com.br ')).toBe('vovo@patotinha.com.br');
    expect(normalizarChavePix('EMAIL', 'vovo@')).toBeNull();
    expect(normalizarChavePix('ALEATORIA', '123E4567-E12B-12D1-A456-426655440000')).toBe(
      '123e4567-e12b-12d1-a456-426655440000',
    );
    expect(normalizarChavePix('ALEATORIA', 'abc')).toBeNull();
  });

  it('a configuração sai pronta para o código e aponta o campo com problema', () => {
    expect(
      esquemaConfigPix.parse({
        tipoChave: 'TELEFONE',
        chave: '11 98765-4321',
        nome: '  Patotinha   da Vovó ',
        cidade: 'São Paulo',
      }),
    ).toEqual({
      tipoChave: 'TELEFONE',
      chave: '+5511987654321',
      nome: 'Patotinha da Vovo',
      cidade: 'Sao Paulo',
    });
    const erro = esquemaConfigPix.safeParse({
      tipoChave: 'CPF',
      chave: '111',
      nome: '',
      cidade: 'X',
    });
    expect(erro.success).toBe(false);
    expect(erro.error!.issues.map((i) => i.path.join('.'))).toEqual(['chave', 'nome']);
  });
});
