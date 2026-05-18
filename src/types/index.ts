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
// Admin-defined call types: LLTO, HLOC, REPATE, Scheduled, Discharge, Advice, etc.
// Each workflow is fixed to a single call type, which controls which version
// of service-template content and overrides apply.
export interface CallType {
  id: string;
  name: string;
}

// ---------- Workflow ----------
export type QuestionType =
  | 'yesno'
  | 'triage'     // legacy — behaves like yesno now
  | 'dropdown'
  | 'text'
  | 'facility'
  | 'specialty_multi'
  | 'diagnosis_multi'
  | 'referral_resolve';

export interface WorkflowQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: { label: string }[];
  condQid?: string;
  condVal?: string;
}

// A question shown on the Post-Triage screen.
export interface PostTriageQuestion {
  id: string;
  type: 'yesno' | 'dropdown' | 'text';
  text: string;
  options?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  callTypeId: string;            // FK → CallType.id
  questions: WorkflowQuestion[];
  postTriage: {
    enabled: boolean;
    showServicePreQuestions: boolean;
    questions: PostTriageQuestion[];
  };
  processSteps: ProcessStep[];   // flat list with optional per-step conditions
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
  condQid?: string;
  condVal?: string;
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
  // Template content keyed by call type ID.
  templates: Record<string, ServiceTemplate>;
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

export interface CardOverride {
  id: string;
  facilityId: string;
  svcId: string;
  parts: Record<string, CardOverridePart>;   // keyed by call type ID
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
  // Optional condition: only show this step when the post-triage answer for
  // `condQid` equals `condVal`. Both must be set for the condition to apply.
  condQid?: string;
  condVal?: string;
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
  svcIds: string[];
  destFacId: string | null;
  diagnoses: string[];
}
