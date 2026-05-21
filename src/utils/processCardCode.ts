import type { CallType, Facility, SpecialtyService } from '../types';

// A Process Card code is NN-L-NNN:
//   NN  = 2-digit specialty-service number (zero-padded)
//   L   = sub-version letter (or the call-type letter when it has no
//         sub-versions)
//   NNN = 3-digit receiving-facility code
// e.g. 10-A-303

// The code letter for a (call type, sub-version) pair.
export function letterFor(
  callType: CallType | undefined,
  subVersionId: string | null | undefined,
): string {
  if (!callType) return '';
  if (callType.subVersions.length === 0) return (callType.letter || '').toUpperCase();
  const sv = callType.subVersions.find((s) => s.id === subVersionId);
  return (sv?.letter || '').toUpperCase();
}

export function processCardCode(
  service: Pick<SpecialtyService, 'number'> | undefined,
  callType: CallType | undefined,
  subVersionId: string | null | undefined,
  facility: Pick<Facility, 'code'> | undefined,
): string {
  const svc =
    service && service.number > 0 ? String(service.number).padStart(2, '0') : '··';
  const letter = letterFor(callType, subVersionId) || '·';
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

// Find which (call type, sub-version) a code letter belongs to.
export function findByLetter(
  callTypes: CallType[],
  letter: string,
): { callType: CallType; subVersionId: string } | null {
  const L = letter.toUpperCase();
  for (const ct of callTypes) {
    if (ct.subVersions.length === 0) {
      if ((ct.letter || '').toUpperCase() === L) {
        return { callType: ct, subVersionId: 'default' };
      }
    } else {
      const sv = ct.subVersions.find((s) => (s.letter || '').toUpperCase() === L);
      if (sv) return { callType: ct, subVersionId: sv.id };
    }
  }
  return null;
}
