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

// ---------- Workflow ----------
export type QuestionType =
  | 'yesno'
  | 'triage'
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

export interface Workflow {
  questions: WorkflowQuestion[];
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
  llto: boolean;
  hloc: boolean;
  svcIds: string[];        // include list — empty = match any
  excludeSvcIds: string[]; // exclude list — only consulted when svcIds is empty
}

export interface Facility {
  id: string;
  name: string;
  healthAuthorityId: string;          // FK → HealthAuthority.id, '' if unset
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
  name: string;          // free-text label for the card (e.g. "VCH/FH protocol")
  llto: boolean;         // applies to LLTO cases?
  hloc: boolean;         // applies to HLOC cases?
  haIds: string[];       // applies when destination facility's HA is in this set
  steps: { id: string; text: string }[];
}

export interface SpecialtyService {
  id: string;
  name: string;
  template: {
    llto: ServiceTemplate;
    hloc: ServiceTemplate;
  };
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
  llto: CardOverridePart;
  hloc: CardOverridePart;
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

export interface ProcessSteps {
  lltoNo: ProcessStep[];
  lltoYes: ProcessStep[];
  hlocNo: ProcessStep[];
  hlocYes: ProcessStep[];
}

export type PsKey = keyof ProcessSteps;

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

export type VerKey = 'llto' | 'hloc';

export interface TriageContext {
  facId: string | null;
  svcIds: string[];
  llto: boolean | null;
  destFacId: string | null;
  diagnoses: string[];
}
