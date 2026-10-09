import { diaEmSaoPaulo, isoSaoPaulo, somarDias } from '@patotinha/shared';
import { ErroApp } from './erros.js';

/**
 * Converte um intervalo de dias civis em Brasília (AAAA-MM-DD, inclusive) no intervalo
 * de instantes [inicio, fim) usado nas consultas (RN-24, D-26).
 */
export function intervaloDeDias(
  de: string | undefined,
  ate: string | undefined,
  codigoErro: string,
): { de: string; ate: string; inicio: Date; fim: Date } {
  const hoje = diaEmSaoPaulo();
  const diaDe = de ?? ate ?? hoje;
  const diaAte = ate ?? de ?? hoje;
  if (!diaValido(diaDe) || !diaValido(diaAte)) {
    throw new ErroApp(422, codigoErro, 'Data inválida');
  }
  if (diaAte < diaDe) {
    throw new ErroApp(422, codigoErro, 'A data final é anterior à data inicial');
  }
  return {
    de: diaDe,
    ate: diaAte,
    inicio: meiaNoiteEmSaoPaulo(diaDe),
    fim: meiaNoiteEmSaoPaulo(somarDias(diaAte, 1)),
  };
}

function diaValido(dia: string): boolean {
  const data = new Date(`${dia}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === dia;
}

/** Instante da meia-noite em Brasília no dia dado, considerando o deslocamento daquele dia. */
export function meiaNoiteEmSaoPaulo(dia: string): Date {
  const meioDiaUtc = new Date(`${dia}T12:00:00Z`);
  const deslocamento = isoSaoPaulo(meioDiaUtc).slice(-6); // ex.: "-03:00"
  return new Date(`${dia}T00:00:00${deslocamento}`);
}
