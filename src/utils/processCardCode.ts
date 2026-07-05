import type { CallType, Facility, SpecialtyService } from '../types';

// A Process Card code is NN-L-NNN:
//   NN  = 2-digit specialty-service number (zero-padded)
//   L   = the call-type letter
//   NNN = 3-digit receiving-facility code
// e.g. 10-A-303

export function letterFor(callType: CallType | undefined): string {
  return ((callType?.letter ?? '') || '').toUpperCase();
}

export function processCardCode(
  service: Pick<SpecialtyService, 'number'> | undefined,
  callType: CallType | undefined,
  facility: Pick<Facility, 'code'> | undefined,
): string {
  const svc =
    service && service.number > 0 ? String(service.number).padStart(2, '0') : '··';
  const letter = letterFor(callType) || '·';
  const fac = facility?.code || '···';
  return `${svc}-${letter}-${fac}`;
}

export interface ParsedProcessCardCode {
  serviceNumber: number;
  letter: string;
  facilityCode: string;
}

// Parse "10-A-303" (case-insensitive) into its parts.
export function parseProcessCardCode(raw: string): ParsedProcessCardCode | null {
  const m = raw.trim().toUpperCase().match(/^(\d{1,2})-?([A-Z])-?(\d{3})$/);
  if (!m) return null;
  return {
    serviceNumber: Number(m[1]),
    letter: m[2],
    facilityCode: m[3],
  };
}

// Find which call type a code letter belongs to.
export function findByLetter(
  callTypes: CallType[],
  letter: string,
): CallType | null {
  const L = letter.toUpperCase();
  return callTypes.find((ct) => (ct.letter || '').toUpperCase() === L) ?? null;
}
