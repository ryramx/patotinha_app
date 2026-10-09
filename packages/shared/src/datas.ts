/** Todas as datas do sistema são exibidas e agrupadas no fuso de Brasília (RN-24). */
export const FUSO = 'America/Sao_Paulo';

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const fmtDiaIso = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const fmtExtenso = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function comoData(valor: Date | string): Date {
  return typeof valor === 'string' ? new Date(valor) : valor;
}

/** "08/10/2026" */
export function formatarData(valor: Date | string): string {
  return fmtData.format(comoData(valor));
}

/** "19:42" */
export function formatarHora(valor: Date | string): string {
  return fmtHora.format(comoData(valor));
}

/** "08/10/2026 19:42" */
export function formatarDataHora(valor: Date | string): string {
  return `${formatarData(valor)} ${formatarHora(valor)}`;
}

/** "quinta-feira, 8 de outubro" */
export function formatarDiaPorExtenso(valor: Date | string): string {
  return fmtExtenso.format(comoData(valor));
}

/** Dia civil em Brasília no formato AAAA-MM-DD. */
export function diaEmSaoPaulo(valor: Date | string = new Date()): string {
  return fmtDiaIso.format(comoData(valor));
}

/** Soma dias a uma data AAAA-MM-DD, sem depender do fuso do computador. */
export function somarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/** Hora (0 a 23) atual em Brasília, para a saudação. */
export function horaEmSaoPaulo(valor: Date = new Date()): number {
  return Number(fmtHora.format(valor).slice(0, 2));
}

/**
 * Converte um instante em ISO 8601 com o deslocamento de Brasília
 * ("2026-10-08T13:20:00-03:00"), como pede o PRD 14.1.
 */
export function isoSaoPaulo(valor: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(valor)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const local = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
  const desvioMin = Math.round((local - Math.floor(valor.getTime() / 1000) * 1000) / 60000);
  const sinal = desvioMin >= 0 ? '+' : '-';
  const abs = Math.abs(desvioMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}${sinal}${hh}:${mm}`;
}
