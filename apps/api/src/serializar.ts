import { isoSaoPaulo } from '@patotinha/shared';
import type { Prisma } from './banco.js';

/** Dinheiro sai da API como string com 2 casas ("33.00"); datas em ISO 8601 com fuso (PRD 14.1). */
export function dinheiro(valor: Prisma.Decimal): string;
export function dinheiro(valor: Prisma.Decimal | null): string | null;
export function dinheiro(valor: Prisma.Decimal | null): string | null {
  return valor === null ? null : valor.toFixed(2);
}

export function data(valor: Date): string;
export function data(valor: Date | null): string | null;
export function data(valor: Date | null): string | null {
  return valor === null ? null : isoSaoPaulo(valor);
}

export function id(valor: bigint): number {
  return Number(valor);
}
