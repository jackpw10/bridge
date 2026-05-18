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
// Call types correspond to workflow types (High Acuity, Advice, Repate,
// Scheduled, Discharge). Each call type may declare sub-versions (e.g.
// LLTO/HLOC for High Acuity); service templates store content per
// (callType, subVersion) pair. Use the literal 'default' as the sub-version
// id when a call type has no sub-versions.
export interface CallTypeSubVersion {
  id: string;
  name: string;
}
export interface CallType {
  id: string;
  name: string;
  subVersions: CallTypeSubVersion[];
}

// ---------- Conditions ----------
// A list of conditions that all must match. Empty/missing = always-on.
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
}

// A question shown on the Post-Triage screen (questions mode).
export interface PostTriageQuestion {
  id: string;
  type: 'yesno' | 'dropdown' | 'text';
  text: string;
  options?: string[];
}

export interface TransportReqItem {
  id: string;
  type: 'multiselect' | 'text';
  label: string;
  options?: Array<{ id: string; label: string }>;
}

export type PostTriageConfig =
  | { mode: 'none' }
  | {
      mode: 'questions';
      showServicePreQuestions: boolean;
      questions: PostTriageQuestion[];
    }
  | {
      mode: 'transport_requirements';
      items: TransportReqItem[];
    };

export interface Workflow {
  id: string;
  name: string;
  callTypeId: string;                // FK → CallType.id
  // For each sub-version of the call type, the conditions that select it
  // (AND-ed). First sub-version whose rules ALL match is the chosen one.
  // Conditions may reference workflow questions OR post-triage questions.
  subVersionRules: Record<string, Condition[]>;
  questions: WorkflowQuestion[];
  postTriage: PostTriageConfig;
  // Process steps now keyed by sub-version id. Workflows whose call type has
  // a single sub-version use the literal 'default' key.
  processSteps: Record<string, ProcessStep[]>;
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
  healthAuthorityId: string;
  onSiteServiceIds: string[];
  referralPatterns: Record<string, ReferralPattern>;
  notificationRequirements: NotificationRequirement[];
  serviceNotifs: Record<string, { enabled: boolean; message: string }>;
}

// ---------- Specialty Services ----------
export interface TemplateQuestion {
  id: string;
  type: 'yesno' | 'dropdown';
  text: string;
  options?: string[];
}

export interface ExceptionStep {
  id: string;
  text: string;
  condQid?: string;        // legacy single-condition (kept for back-compat)
  condVal?: string;
  conditions?: Condition[]; // new multi-condition (AND-ed). If present, takes precedence.
}

export interface ServiceTemplate {
  preQuestions: TemplateQuestion[];
  exceptionSteps: ExceptionStep[];
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
  // Nested: templates[callTypeId][subVersionId] = ServiceTemplate.
  // For call types with no sub-versions, the inner key is 'default'.
  templates: Record<string, Record<string, ServiceTemplate>>;
  transportAdvisor: {
    enabled: boolean;
    cards: TACard[];
  };
}

// ---------- Card Overrides ----------
export interface CardOverridePart {
  deactivated: string[];
  addedQuestions: TemplateQuestion[];
  addedSteps: ExceptionStep[];
  qOrder: string[];
  sOrder: string[];
}

// Override is keyed by `${callTypeId}:${subVersionId}` so it tracks the same
// dimensionality as service templates.
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
