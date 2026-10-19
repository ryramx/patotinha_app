import { z } from 'zod';

/**
 * Pix com o valor do pedido (etapa 13, docs/pix.md): o código "copia e cola" (BR Code) de
 * um Pix estático, no padrão EMV do Banco Central, com chave, recebedor, cidade, valor e
 * identificador. Sem banco intermediário nem taxa: o sistema não sabe se o cliente pagou,
 * quem confere é o atendente no app do banco.
 */

export const TIPOS_CHAVE_PIX = ['CPF', 'CNPJ', 'TELEFONE', 'EMAIL', 'ALEATORIA'] as const;
export type TipoChavePix = (typeof TIPOS_CHAVE_PIX)[number];

export const NOMES_TIPO_CHAVE_PIX: Record<TipoChavePix, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  TELEFONE: 'Celular',
  EMAIL: 'E-mail',
  ALEATORIA: 'Chave aleatória',
};

/** Limites do padrão: nome até 25 letras e cidade até 15, sem acentos. */
export const LIMITES_PIX = { nome: 25, cidade: 15, identificador: 25 } as const;

/** Sem acentos e só com letras, números e sinais simples, como pedem os bancos. */
export function textoPix(texto: string, max: number): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9 .,&\-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** Identificador do Pix (txid): só letras e números, até 25. Vazio vira "***". */
export function identificadorPix(texto: string): string {
  const limpo = textoPix(texto, 100)
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, LIMITES_PIX.identificador);
  return limpo || '***';
}

function cpfValido(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

function cnpjValido(d: string) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (n: number) => {
    const pesos =
      n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

/**
 * A chave como o Pix espera, a partir do que foi digitado: CPF e CNPJ só com números,
 * celular com +55 e DDD, e-mail e chave aleatória em minúsculas. Devolve null se não serve.
 */
export function normalizarChavePix(tipo: TipoChavePix, chave: string): string | null {
  const texto = chave.trim();
  const digitos = texto.replace(/\D/g, '');
  switch (tipo) {
    case 'CPF':
      return /^[\d.\-\s]+$/.test(texto) && cpfValido(digitos) ? digitos : null;
    case 'CNPJ':
      return /^[\d./\-\s]+$/.test(texto) && cnpjValido(digitos) ? digitos : null;
    case 'TELEFONE': {
      if (!/^[\d\s()+.-]+$/.test(texto)) return null;
      const semPais = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
      return /^[1-9]{2}9?\d{8}$/.test(semPais) ? `+55${semPais}` : null;
    }
    case 'EMAIL': {
      const email = texto.toLowerCase();
      return email.length <= 77 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    }
    case 'ALEATORIA': {
      const evp = texto.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(evp)
        ? evp
        : null;
    }
  }
}

const MENSAGEM_CHAVE: Record<TipoChavePix, string> = {
  CPF: 'CPF inválido. Confira os 11 números',
  CNPJ: 'CNPJ inválido. Confira os 14 números',
  TELEFONE: 'Celular com DDD, como (11) 98765-4321',
  EMAIL: 'E-mail inválido',
  ALEATORIA: 'A chave aleatória tem 32 letras e números, separados por traços',
};

/** Configuração do Pix da loja, salva pelo administrador. */
export const esquemaConfigPix = z
  .strictObject({
    tipoChave: z.enum(TIPOS_CHAVE_PIX, { error: 'Escolha o tipo da chave' }),
    chave: z.string({ error: 'Informe a chave Pix' }).trim().min(1, 'Informe a chave Pix').max(100),
    nome: z.string({ error: 'Informe o nome do recebedor' }).max(100),
    cidade: z.string({ error: 'Informe a cidade' }).max(100),
  })
  .transform((dados, ctx) => {
    const chave = normalizarChavePix(dados.tipoChave, dados.chave);
    if (!chave) {
      ctx.addIssue({ code: 'custom', path: ['chave'], message: MENSAGEM_CHAVE[dados.tipoChave] });
    }
    const nome = textoPix(dados.nome, LIMITES_PIX.nome);
    if (!nome)
      ctx.addIssue({ code: 'custom', path: ['nome'], message: 'Informe o nome do recebedor' });
    const cidade = textoPix(dados.cidade, LIMITES_PIX.cidade);
    if (!cidade) ctx.addIssue({ code: 'custom', path: ['cidade'], message: 'Informe a cidade' });
    return { tipoChave: dados.tipoChave, chave: chave ?? '', nome, cidade };
  });
export type DadosConfigPix = z.output<typeof esquemaConfigPix>;

/** Bytes UTF-8 do texto (o padrão conta tamanhos e CRC em bytes). */
function bytesUtf8(texto: string): number[] {
  const bytes: number[] = [];
  for (const letra of texto) {
    const c = letra.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63),
      );
  }
  return bytes;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
export function crc16Pix(texto: string): string {
  let crc = 0xffff;
  for (const byte of bytesUtf8(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function campo(id: string, valor: string) {
  const tamanho = bytesUtf8(valor).length;
  return `${id}${String(tamanho).padStart(2, '0')}${valor}`;
}

export interface DadosPix {
  /** Chave já normalizada (normalizarChavePix). */
  chave: string;
  nome: string;
  cidade: string;
  /** Valor em centavos; sem valor, o cliente digita no app do banco. */
  valorCentavos?: number | null;
  /** Aparece no extrato do recebedor, como o número do pedido. */
  identificador?: string;
}

/** O texto do "Pix copia e cola" (também é o conteúdo do QR Code). */
export function gerarPixCopiaECola(dados: DadosPix): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', dados.chave);
  const valor =
    dados.valorCentavos && dados.valorCentavos > 0
      ? campo('54', (dados.valorCentavos / 100).toFixed(2))
      : '';
  const semCrc =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    valor +
    campo('58', 'BR') +
    campo('59', textoPix(dados.nome, LIMITES_PIX.nome)) +
    campo('60', textoPix(dados.cidade, LIMITES_PIX.cidade)) +
    campo('62', campo('05', identificadorPix(dados.identificador ?? ''))) +
    '6304';
  return semCrc + crc16Pix(semCrc);
}
