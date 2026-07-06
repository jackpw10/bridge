// ---------- Identity ----------
export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

export interface Session {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}

// ---------- Call Types ----------
// A call type is a single, flat classification (e.g. High Acuity, Advice,
// Repatriation, Scheduled, Discharge). Each carries a one-character `letter`
// used in Process Card codes.
export interface CallType {
  id: string;
  name: string;
  letter: string;
}

// ---------- Conditions ----------
// A list of conditions that all must match. Empty/missing = always-on.
// Still used by workflow-question visibility (condQid/condVal below).
export interface Condition {
  qid: string;
  equals: string;
}

// ---------- Workflow ----------
export type QuestionType =
  | 'yesno'
  | 'triage'             // legacy — yes/no with no special behavior
  | 'dropdown'
  | 'text'
  | 'facility'           // sending facility (with optional allowFreeText)
  | 'receiving_facility' // direct receiving fac pick (no referral patterns; with optional allowFreeText)
  | 'specialty_multi'
  | 'diagnosis_multi'
  | 'referral_resolve';  // receiving via referral patterns

export interface WorkflowQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: { label: string }[];
  condQid?: string;
  condVal?: string;
  // For facility / receiving_facility: also allow a free-text entry (e.g. an address)
  allowFreeText?: boolean;
  // Optional reference text shown beside the question during triage.
  additionalInfo?: string;
}

export interface Workflow {
  id: string;
  name: string;
  callTypeId: string;                // FK → CallType.id
  questions: WorkflowQuestion[];
  // Flat, ordered list of generic process steps (the "Action Card") for this
  // workflow. No sub-versions, no PTN variants.
  processSteps: ProcessStep[];
}

// ---------- Initial Call Questions ----------
// Questions the user answers on the "New Case" screen BEFORE picking a call
// type. Collected regardless of call type; the answers ride with the case
// and appear on the Result summary.
export interface InitialCallQuestion {
  id: string;
  type: 'yesno' | 'dropdown' | 'text';
  text: string;
  options?: string[];
  // Free-form reference text shown to the caller in the side panel when
  // this question is the one they're currently answering.
  instructions?: string;
}

// ---------- Health Authorities ----------
export interface HealthAuthority {
  id: string;
  name: string;
}

// ---------- Facilities ----------
export interface ReferralPattern {
  d1: string;
  d2: string;
  d3: string;
}

export interface NotificationRequirement {
  id: string;
  text: string;
  callTypeIds: string[];   // include list of call types this applies to. Empty = all.
  svcIds: string[];        // include list — empty = match any
  excludeSvcIds: string[]; // exclude list — only consulted when svcIds is empty
}

export interface Facility {
  id: string;
  name: string;
  // Short abbreviation (e.g. 'VGH').
  abbreviation: string;
  // 3-digit facility code used in Process Card codes (e.g. '303').
  code: string;
  healthAuthorityId: string;
  onSiteServiceIds: string[];
  referralPatterns: Record<string, ReferralPattern>;
  notificationRequirements: NotificationRequirement[];
  serviceNotifs: Record<string, { enabled: boolean; message: string }>;
}

// ---------- Specialty Services ----------
// A Process Card step. Flat: no per-step conditions.
export interface ProcessCardStep {
  id: string;
  text: string;
}

// One Process Card's content for a (specialty × call-type) pair.
export interface ServiceTemplate {
  steps: ProcessCardStep[];
}

export interface TACard {
  id: string;
  name: string;
  callTypeIds: string[];   // applies when the case's call type is in this set
  haIds: string[];         // applies when destination facility's HA is in this set
  steps: { id: string; text: string }[];
}

export interface SpecialtyService {
  id: string;
  name: string;
  // Numeric id used (2-digit, zero-padded) in Process Card codes.
  number: number;
  // Flat: one Process Card template per call type.
  templates: Record<string, ServiceTemplate>;
  transportAdvisor: {
    enabled: boolean;
    cards: TACard[];
  };
  // Call types (≈ workflows) this service is offered for. The specialty-
  // service question during triage only lists services whose list includes
  // the case's call type.
  enabledCallTypeIds: string[];
}

// ---------- Card Overrides ----------
export interface CardOverridePart {
  deactivated: string[];
  addedSteps: ProcessCardStep[];
  sOrder: string[];
}

// Override is keyed by callTypeId only (no sub-version dimension anymore).
export interface CardOverride {
  id: string;
  facilityId: string;
  svcId: string;
  parts: Record<string, CardOverridePart>;
}

// ---------- Diagnoses ----------
export interface Diagnosis {
  id: string;
  text: string;
  notifEnabled: boolean;
  notifMessage: string;
}

// ---------- Process steps ----------
// Generic action-card step. Same shape as ProcessCardStep; kept as a distinct
// name because they represent different content (workflow-level vs
// service-level).
export interface ProcessStep {
  id: string;
  text: string;
}

// ---------- Reference cards ----------
export interface ReferenceCard {
  id: string;
  name: string;
  code?: string;
  body?: string;
  steps: { id: string; text: string }[];
}

// ---------- Override reasons ----------
export interface OverrideReason {
  id: string;
  text: string;
}

// ---------- Notifications ----------
export interface Notification {
  id: string;
  from: string;
  ts: number;
  title: string;
  body: string;
  ackedBy: string[];
  deletedFor: string[];
}

// ---------- Case audit log ----------
// One row per action a user takes inside a case, for audit + admin
// active-case monitoring. Stored server-side in public.case_events.
export interface CaseEvent {
  id: string;
  caseId: string;
  actor: string;              // auth.users.id (uuid) of the actor
  ts: number;                 // Date.now() ms
  eventType: string;          // 'case_started' | 'initial_answer' | 'workflow_answer' | 'note' | 'phase_change' | 'case_ended' | ...
  summary: string;            // human-readable one-line description
  detail: Record<string, unknown>;
}

// Case metadata for admin case-history views. One row per case in
// public.cases.
export interface CaseSummary {
  id: string;
  actor: string;
  workflowId: string | null;
  workflowName: string;       // denormalized for admin display
  callTypeId: string | null;
  callTypeName: string;       // denormalized for admin display
  startedAt: number;
  endedAt: number | null;
}

// ---------- Triage runtime ----------
export interface AcQueueItem {
  destFacId: string;
  svcId: string;
}

export interface TriageContext {
  facId: string | null;
  facFreeText: string | null;
  svcIds: string[];
  destFacId: string | null;
  destFreeText: string | null;
  diagnoses: string[];
}
