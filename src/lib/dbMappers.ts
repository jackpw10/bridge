// Maps between the app-facing camelCase types and the Postgres snake_case rows.
// Centralizing these keeps the rest of the app unaware of the DB shape.

import type {
  Diagnosis,
  Facility,
  HealthAuthority,
  Notification,
  OverrideReason,
  CardOverride,
  ProcessSteps,
  ReferenceCard,
  SpecialtyService,
  Workflow,
} from '../types';

// ---------- Facilities ----------
export interface FacilityRow {
  id: string;
  name: string;
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
  template: unknown;
  transport_advisor: unknown;
}

export function svcFromRow(r: SpecialtyServiceRow): SpecialtyService {
  return {
    id: r.id,
    name: r.name,
    template: r.template as SpecialtyService['template'],
    transportAdvisor: r.transport_advisor as SpecialtyService['transportAdvisor'],
  };
}

export function svcToRow(s: SpecialtyService): SpecialtyServiceRow {
  return {
    id: s.id,
    name: s.name,
    template: s.template,
    transport_advisor: s.transportAdvisor,
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

// ---------- Workflow ----------
export interface WorkflowRow {
  id: string;
  questions: unknown;
}

export function workflowFromRow(r: WorkflowRow): Workflow {
  return { questions: (r.questions as Workflow['questions']) ?? [] };
}

// ---------- Process steps ----------
export interface ProcessStepsRow {
  id: string;
  llto_no: unknown;
  llto_yes: unknown;
  hloc_no: unknown;
  hloc_yes: unknown;
}

export function psFromRow(r: ProcessStepsRow): ProcessSteps {
  return {
    lltoNo: (r.llto_no as ProcessSteps['lltoNo']) ?? [],
    lltoYes: (r.llto_yes as ProcessSteps['lltoYes']) ?? [],
    hlocNo: (r.hloc_no as ProcessSteps['hlocNo']) ?? [],
    hlocYes: (r.hloc_yes as ProcessSteps['hlocYes']) ?? [],
  };
}

export function psToRow(p: ProcessSteps): Omit<ProcessStepsRow, 'id'> {
  return {
    llto_no: p.lltoNo,
    llto_yes: p.lltoYes,
    hloc_no: p.hlocNo,
    hloc_yes: p.hlocYes,
  };
}

// ---------- Card overrides ----------
export interface CardOverrideRow {
  id: string;
  facility_id: string;
  svc_id: string;
  llto: unknown;
  hloc: unknown;
}

export function ovFromRow(r: CardOverrideRow): CardOverride {
  return {
    id: r.id,
    facilityId: r.facility_id,
    svcId: r.svc_id,
    llto: r.llto as CardOverride['llto'],
    hloc: r.hloc as CardOverride['hloc'],
  };
}

export function ovToRow(o: CardOverride): CardOverrideRow {
  return {
    id: o.id,
    facility_id: o.facilityId,
    svc_id: o.svcId,
    llto: o.llto,
    hloc: o.hloc,
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

// ---------- Simple ones (just rename casing or pass through) ----------
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
