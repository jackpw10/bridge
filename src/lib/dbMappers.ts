// Maps between the app-facing camelCase types and the Postgres snake_case rows.
//
// Read-side mappers TOLERATE the pre-rewrite JSONB shape (sub-versions,
// service preQuestions, `ctId:svId` override keys). Write-side always emits
// the new flat shape.

import type {
  CallType,
  CardOverride,
  CardOverridePart,
  Diagnosis,
  Facility,
  HealthAuthority,
  InitialCallQuestion,
  Notification,
  OverrideReason,
  ProcessCardStep,
  ProcessStep,
  ReferenceCard,
  ServiceTemplate,
  SpecialtyService,
  Workflow,
} from '../types';

// ---------- Call types ----------
export interface CallTypeRow {
  id: string;
  name: string;
  letter: string;
}

export function callTypeFromRow(r: CallTypeRow): CallType {
  return {
    id: r.id,
    name: r.name,
    letter: r.letter ?? '',
  };
}

export function callTypeToRow(c: CallType): CallTypeRow {
  return { id: c.id, name: c.name, letter: c.letter ?? '' };
}

// ---------- Facilities ----------
export interface FacilityRow {
  id: string;
  name: string;
  abbreviation: string;
  code: string;
  health_authority_id: string;
  on_site_service_ids: unknown;
  referral_patterns: unknown;
  notification_requirements: unknown;
  service_notifs: unknown;
}

export function facilityFromRow(r: FacilityRow): Facility {
  return {
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation ?? '',
    code: r.code ?? '',
    healthAuthorityId: r.health_authority_id ?? '',
    onSiteServiceIds: (r.on_site_service_ids as string[]) ?? [],
    referralPatterns: (r.referral_patterns as Facility['referralPatterns']) ?? {},
    notificationRequirements:
      (r.notification_requirements as Facility['notificationRequirements']) ?? [],
    serviceNotifs: (r.service_notifs as Facility['serviceNotifs']) ?? {},
  };
}

export function facilityToRow(f: Facility): FacilityRow {
  return {
    id: f.id,
    name: f.name,
    abbreviation: f.abbreviation ?? '',
    code: f.code ?? '',
    health_authority_id: f.healthAuthorityId,
    on_site_service_ids: f.onSiteServiceIds,
    referral_patterns: f.referralPatterns,
    notification_requirements: f.notificationRequirements,
    service_notifs: f.serviceNotifs,
  };
}

// ---------- Specialty services ----------
export interface SpecialtyServiceRow {
  id: string;
  name: string;
  number: number;
  templates: unknown;
  transport_advisor: unknown;
  enabled_call_type_ids: unknown;
}

// Read one Process Card template out of raw JSON. Accepts either the new
// shape { steps: [...] } or the legacy shape { preQuestions, exceptionSteps }.
function coerceServiceTemplate(raw: unknown): ServiceTemplate {
  if (!raw || typeof raw !== 'object') return { steps: [] };
  const obj = raw as { steps?: unknown; exceptionSteps?: unknown };
  const arr = Array.isArray(obj.steps)
    ? obj.steps
    : Array.isArray(obj.exceptionSteps)
      ? obj.exceptionSteps
      : [];
  const steps: ProcessCardStep[] = arr
    .filter((s: unknown): s is { id: string; text: string } =>
      !!s && typeof s === 'object' && 'id' in s && 'text' in s)
    .map((s) => ({ id: String(s.id), text: String(s.text) }));
  return { steps };
}

function coerceTemplates(raw: unknown): Record<string, ServiceTemplate> {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: Record<string, ServiceTemplate> = {};
  for (const [ctId, val] of Object.entries(rec)) {
    if (!val || typeof val !== 'object') continue;
    const v = val as { steps?: unknown; exceptionSteps?: unknown };
    // New shape: value is a template directly.
    if (Array.isArray(v.steps) || Array.isArray(v.exceptionSteps)) {
      out[ctId] = coerceServiceTemplate(v);
      continue;
    }
    // Legacy shape: value is Record<subVersionId, ServiceTemplate_old>.
    // Prefer the 'default' entry; otherwise the first entry.
    const inner = val as Record<string, unknown>;
    const preferred = inner['default'] ?? inner[Object.keys(inner)[0]];
    out[ctId] = coerceServiceTemplate(preferred);
  }
  return out;
}

export function svcFromRow(r: SpecialtyServiceRow): SpecialtyService {
  return {
    id: r.id,
    name: r.name,
    number: typeof r.number === 'number' ? r.number : 0,
    templates: coerceTemplates(r.templates),
    transportAdvisor: (r.transport_advisor as SpecialtyService['transportAdvisor']) ?? {
      enabled: false,
      cards: [],
    },
    enabledCallTypeIds: (r.enabled_call_type_ids as string[]) ?? [],
  };
}

export function svcToRow(s: SpecialtyService): SpecialtyServiceRow {
  return {
    id: s.id,
    name: s.name,
    number: s.number ?? 0,
    templates: s.templates,
    transport_advisor: s.transportAdvisor,
    enabled_call_type_ids: s.enabledCallTypeIds ?? [],
  };
}

// ---------- Diagnoses ----------
export interface DiagnosisRow {
  id: string;
  text: string;
  notif_enabled: boolean;
  notif_message: string;
}

export function dxFromRow(r: DiagnosisRow): Diagnosis {
  return {
    id: r.id,
    text: r.text,
    notifEnabled: r.notif_enabled,
    notifMessage: r.notif_message ?? '',
  };
}

export function dxToRow(d: Diagnosis): DiagnosisRow {
  return {
    id: d.id,
    text: d.text,
    notif_enabled: d.notifEnabled,
    notif_message: d.notifMessage,
  };
}

// ---------- Workflows ----------
export interface WorkflowRow {
  id: string;
  name: string;
  call_type_id: string;
  questions: unknown;
  process_steps: unknown;
  position: number;
}

// The process_steps JSONB used to be Record<subVersionId | "svId:std|outside", ProcessStep[]>.
// Collapse to a flat ProcessStep[] on read: prefer the 'default' key, else
// the first non-empty entry.
function coerceProcessSteps(raw: unknown): ProcessStep[] {
  if (Array.isArray(raw)) return raw as ProcessStep[];
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const preferred = rec['default'] ?? rec[Object.keys(rec)[0]];
    return Array.isArray(preferred) ? (preferred as ProcessStep[]) : [];
  }
  return [];
}

export function workflowFromRow(r: WorkflowRow): Workflow {
  return {
    id: r.id,
    name: r.name,
    callTypeId: r.call_type_id ?? '',
    questions: (r.questions as Workflow['questions']) ?? [],
    processSteps: coerceProcessSteps(r.process_steps),
  };
}

export function workflowToRow(w: Workflow, position: number): WorkflowRow {
  return {
    id: w.id,
    name: w.name,
    call_type_id: w.callTypeId,
    questions: w.questions,
    process_steps: w.processSteps,
    position,
  };
}

// ---------- Card overrides ----------
export interface CardOverrideRow {
  id: string;
  facility_id: string;
  svc_id: string;
  parts: unknown;
}

// Legacy override parts were keyed by "callTypeId:subVersionId". Collapse to
// callTypeId only, merging when multiple sub-versions land on the same
// call type.
function coerceOverrideParts(raw: unknown): Record<string, CardOverridePart> {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: Record<string, CardOverridePart> = {};
  for (const [key, val] of Object.entries(rec)) {
    if (!val || typeof val !== 'object') continue;
    const v = val as {
      deactivated?: unknown;
      addedSteps?: unknown;
      sOrder?: unknown;
    };
    const ctId = key.includes(':') ? key.split(':')[0] : key;
    const part: CardOverridePart = {
      deactivated: Array.isArray(v.deactivated) ? (v.deactivated as string[]) : [],
      addedSteps: Array.isArray(v.addedSteps) ? (v.addedSteps as ProcessCardStep[]) : [],
      sOrder: Array.isArray(v.sOrder) ? (v.sOrder as string[]) : [],
    };
    const existing = out[ctId];
    if (!existing) {
      out[ctId] = part;
    } else {
      out[ctId] = {
        deactivated: Array.from(new Set([...existing.deactivated, ...part.deactivated])),
        addedSteps: [...existing.addedSteps, ...part.addedSteps],
        sOrder: [...existing.sOrder, ...part.sOrder],
      };
    }
  }
  return out;
}

export function ovFromRow(r: CardOverrideRow): CardOverride {
  return {
    id: r.id,
    facilityId: r.facility_id,
    svcId: r.svc_id,
    parts: coerceOverrideParts(r.parts),
  };
}

export function ovToRow(o: CardOverride): CardOverrideRow {
  return {
    id: o.id,
    facility_id: o.facilityId,
    svc_id: o.svcId,
    parts: o.parts,
  };
}

// ---------- Notifications ----------
export interface NotificationRow {
  id: string;
  from_user: string;
  ts: number;
  title: string;
  body: string;
  acked_by: unknown;
  deleted_for: unknown;
}

export function notifFromRow(r: NotificationRow): Notification {
  return {
    id: r.id,
    from: r.from_user,
    ts: Number(r.ts),
    title: r.title,
    body: r.body,
    ackedBy: (r.acked_by as string[]) ?? [],
    deletedFor: (r.deleted_for as string[]) ?? [],
  };
}

export function notifToRow(n: Notification): NotificationRow {
  return {
    id: n.id,
    from_user: n.from,
    ts: n.ts,
    title: n.title,
    body: n.body,
    acked_by: n.ackedBy,
    deleted_for: n.deletedFor,
  };
}

// ---------- Initial call questions ----------
export interface InitialCallQuestionRow {
  id: string;
  text: string;
  type: string;
  options: unknown;
  instructions: string | null;
  position: number;
}

export function icqFromRow(r: InitialCallQuestionRow): InitialCallQuestion {
  const t = (r.type === 'yesno' || r.type === 'dropdown' || r.type === 'text')
    ? r.type
    : 'text';
  return {
    id: r.id,
    type: t,
    text: r.text,
    options: Array.isArray(r.options) ? (r.options as string[]) : undefined,
    instructions: r.instructions ?? undefined,
  };
}

export function icqToRow(q: InitialCallQuestion, position: number): InitialCallQuestionRow {
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    options: q.options ?? [],
    instructions: q.instructions ?? null,
    position,
  };
}

// ---------- Simple ones ----------
export function haFromRow(r: { id: string; name: string }): HealthAuthority {
  return { id: r.id, name: r.name };
}

export function reasonFromRow(r: { id: string; text: string }): OverrideReason {
  return { id: r.id, text: r.text };
}

export interface ReferenceCardRow {
  id: string;
  name: string;
  code: string | null;
  body: string | null;
  steps: unknown;
}

export function refCardFromRow(r: ReferenceCardRow): ReferenceCard {
  return {
    id: r.id,
    name: r.name,
    code: r.code ?? undefined,
    body: r.body ?? undefined,
    steps: (r.steps as ReferenceCard['steps']) ?? [],
  };
}

export function refCardToRow(c: ReferenceCard): ReferenceCardRow {
  return {
    id: c.id,
    name: c.name,
    code: c.code ?? null,
    body: c.body ?? null,
    steps: c.steps,
  };
}
