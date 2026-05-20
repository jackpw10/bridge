// Maps between the app-facing camelCase types and the Postgres snake_case rows.

import type {
  CallType,
  Diagnosis,
  Facility,
  HealthAuthority,
  Notification,
  OverrideReason,
  CardOverride,
  ReferenceCard,
  SpecialtyService,
  Workflow,
} from '../types';

// ---------- Call types ----------
export interface CallTypeRow {
  id: string;
  name: string;
  sub_versions: unknown;
}

export function callTypeFromRow(r: CallTypeRow): CallType {
  return {
    id: r.id,
    name: r.name,
    subVersions: (r.sub_versions as CallType['subVersions']) ?? [],
  };
}

export function callTypeToRow(c: CallType): CallTypeRow {
  return { id: c.id, name: c.name, sub_versions: c.subVersions };
}

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
  templates: unknown;
  transport_advisor: unknown;
  enabled_call_type_ids: unknown;
}

export function svcFromRow(r: SpecialtyServiceRow): SpecialtyService {
  return {
    id: r.id,
    name: r.name,
    templates: (r.templates as SpecialtyService['templates']) ?? {},
    transportAdvisor: r.transport_advisor as SpecialtyService['transportAdvisor'],
    enabledCallTypeIds: (r.enabled_call_type_ids as string[]) ?? [],
  };
}

export function svcToRow(s: SpecialtyService): SpecialtyServiceRow {
  return {
    id: s.id,
    name: s.name,
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
  sub_version_rules: unknown;
  questions: unknown;
  post_triage: unknown;
  process_steps: unknown;
  position: number;
}

export function workflowFromRow(r: WorkflowRow): Workflow {
  const pt = (r.post_triage as Workflow['postTriage'] | null) ?? { mode: 'none' };
  return {
    id: r.id,
    name: r.name,
    callTypeId: r.call_type_id ?? '',
    subVersionRules: (r.sub_version_rules as Workflow['subVersionRules']) ?? {},
    questions: (r.questions as Workflow['questions']) ?? [],
    postTriage: pt,
    processSteps: (r.process_steps as Workflow['processSteps']) ?? {},
  };
}

export function workflowToRow(w: Workflow, position: number): WorkflowRow {
  return {
    id: w.id,
    name: w.name,
    call_type_id: w.callTypeId,
    sub_version_rules: w.subVersionRules,
    questions: w.questions,
    post_triage: w.postTriage,
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

export function ovFromRow(r: CardOverrideRow): CardOverride {
  return {
    id: r.id,
    facilityId: r.facility_id,
    svcId: r.svc_id,
    parts: (r.parts as CardOverride['parts']) ?? {},
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
