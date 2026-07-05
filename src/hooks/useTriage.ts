import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import type {
  AcQueueItem,
  CardOverridePart,
  Facility,
  ProcessCardStep,
  ProcessStep,
  SpecialtyService,
  TriageContext,
  Workflow,
  WorkflowQuestion,
} from '../types';

// Stable empty reference so reading from a missing active case doesn't
// produce a new object each render (which would thrash memo dependencies).
const EMPTY_STR_REC: Record<string, string> = {};
const EMPTY_BOOL_REC: Record<string, boolean> = {};

function isQuestionVisible(
  q: WorkflowQuestion,
  answers: Record<string, string>
): boolean {
  if (!q.condQid) return true;
  const a = (answers[q.condQid] ?? '').toLowerCase();
  const want = (q.condVal ?? '').toLowerCase();
  if (!want) return true;
  return a === want || a.includes(want);
}

function computeVisible(
  questions: WorkflowQuestion[],
  answers: Record<string, string>
): WorkflowQuestion[] {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

function findContext(
  visible: WorkflowQuestion[],
  answers: Record<string, string>,
  upToIndex?: number
): TriageContext {
  const scan = upToIndex === undefined ? visible : visible.slice(0, upToIndex);

  let facId: string | null = null;
  let facFreeText: string | null = null;
  let svcIds: string[] = [];
  let destFacId: string | null = null;
  let destFreeText: string | null = null;
  let diagnoses: string[] = [];

  for (const q of scan) {
    if (q.type === 'facility') {
      const f = answers[`${q.id}__facid`];
      if (f) facId = f;
      const txt = answers[`${q.id}__freetext`];
      if (txt) facFreeText = txt;
    } else if (q.type === 'receiving_facility') {
      const f = answers[`${q.id}__facid`];
      if (f) destFacId = f;
      const txt = answers[`${q.id}__freetext`];
      if (txt) destFreeText = txt;
    } else if (q.type === 'specialty_multi') {
      const raw = answers[`${q.id}__svcs`];
      if (raw) {
        try { svcIds = JSON.parse(raw) as string[]; } catch { svcIds = []; }
      }
    } else if (q.type === 'diagnosis_multi') {
      const raw = answers[`${q.id}__dxs`];
      if (raw) {
        try { diagnoses = JSON.parse(raw) as string[]; } catch { diagnoses = []; }
      }
    } else if (q.type === 'referral_resolve') {
      const choice = answers[`${q.id}__choice`];
      if (choice === '__custom__') {
        destFacId = answers[`${q.id}__customfacid`] ?? null;
      } else if (choice) {
        destFacId = choice;
      }
    }
  }
  return { facId, facFreeText, svcIds, destFacId, destFreeText, diagnoses };
}

function applyOrder<T extends { id: string }>(all: T[], order: string[]): T[] {
  if (!order.length) return all;
  const map = new Map(all.map((q) => [q.id, q] as const));
  const out: T[] = [];
  for (const id of order) {
    const q = map.get(id);
    if (q) { out.push(q); map.delete(id); }
  }
  for (const q of map.values()) out.push(q);
  return out;
}

// Build the effective Process Card step list for a service + call type,
// applying any per-facility CardOverridePart on top.
function getActiveCardSteps(
  service: SpecialtyService,
  override: CardOverridePart | null,
  callTypeId: string,
): ProcessCardStep[] {
  const tpl = service.templates[callTypeId];
  const baseSteps = tpl?.steps ?? [];
  const base = baseSteps.filter((s) => !override?.deactivated.includes(s.id));
  const all = [...base, ...(override?.addedSteps ?? [])];
  return applyOrder(all, override?.sOrder ?? []);
}

export interface UseTriageResult {
  activeWorkflow: Workflow | null;
  callTypeId: string;
  callTypeName: string;
  hasReferralQuestion: boolean;

  answers: Record<string, string>;
  currentIndex: number;
  taShown: Record<string, boolean>;
  phase: 'workflow' | 'result';
  notifsSent: boolean;
  notes: string;

  visibleQuestions: WorkflowQuestion[];
  currentQuestion: WorkflowQuestion | undefined;
  context: TriageContext;
  acQueue: AcQueueItem[];
  destFacility: Facility | null;
  sendingFacility: Facility | null;
  activeProcessSteps: ProcessStep[];

  caseId: string | null;

  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
  goPrev: () => void;
  goNext: () => void;
  goToIndex: (i: number) => void;
  markTaShown: (key: string) => void;
  goToResult: () => void;
  goToWorkflow: () => void;
  // Closes the active case (cancel / complete) and returns the route to
  // navigate to next: another open case's page, or /triage if none remain.
  closeActiveCase: () => string;
  markNotifsSent: () => void;
  setNotes: (s: string) => void;

  getActiveCardSteps: (
    svcId: string,
    callTypeId: string,
    facId: string,
  ) => ProcessCardStep[];
}

export function useTriage(): UseTriageResult {
  const workflows = useAppStore((s) => s.workflows);
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const overrides = useAppStore((s) => s.overrides);
  const callTypes = useAppStore((s) => s.callTypes);

  // ----- Read state from the ACTIVE case (tabbed triage) -----
  const cases = useTriageStore((s) => s.cases);
  const activeCaseId = useTriageStore((s) => s.activeCaseId);
  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) ?? null,
    [cases, activeCaseId]
  );

  const activeWorkflowId = activeCase?.workflowId ?? '';
  const answers = activeCase?.answers ?? EMPTY_STR_REC;
  const currentIndex = activeCase?.currentIndex ?? 0;
  const taShown = activeCase?.taShown ?? EMPTY_BOOL_REC;
  const phase: 'workflow' | 'result' = activeCase?.phase ?? 'workflow';
  const notifsSent = activeCase?.notifsSent ?? false;
  const notes = activeCase?.notes ?? '';

  const setAnswer = useTriageStore((s) => s.setAnswer);
  const goPrev = useTriageStore((s) => s.goPrev);
  const goNext = useTriageStore((s) => s.goNext);
  const goToIndex = useTriageStore((s) => s.goToIndex);
  const markTaShown = useTriageStore((s) => s.markTaShown);
  const setPhase = useTriageStore((s) => s.setPhase);
  const closeCase = useTriageStore((s) => s.closeCase);
  const markNotifsSent = useTriageStore((s) => s.markNotifsSent);
  const setNotes = useTriageStore((s) => s.setNotes);

  const closeActiveCase = useCallback((): string => {
    if (!activeCaseId) return '/triage';
    closeCase(activeCaseId);
    const next = useTriageStore.getState();
    if (next.activeCaseId) {
      const nc = next.cases.find((c) => c.id === next.activeCaseId);
      return nc?.phase === 'result' ? '/triage/result' : '/triage/run';
    }
    return '/triage';
  }, [activeCaseId, closeCase]);

  const activeWorkflow = useMemo(
    () => workflows.find((w) => w.id === activeWorkflowId) ?? null,
    [workflows, activeWorkflowId]
  );

  const callTypeId = activeWorkflow?.callTypeId ?? '';
  const callType = callTypes.find((c) => c.id === callTypeId);
  const callTypeName = callType?.name ?? '';

  const workflowQuestions = activeWorkflow?.questions ?? [];

  const visibleQuestions = useMemo(
    () => computeVisible(workflowQuestions, answers),
    [workflowQuestions, answers]
  );

  const context = useMemo(
    () => findContext(visibleQuestions, answers),
    [visibleQuestions, answers]
  );

  const acQueue: AcQueueItem[] = useMemo(() => {
    if (!context.destFacId || context.svcIds.length === 0) return [];
    return context.svcIds.map((svcId) => ({
      destFacId: context.destFacId as string,
      svcId,
    }));
  }, [context.destFacId, context.svcIds]);

  const destFacility = facilities.find((f) => f.id === context.destFacId) ?? null;
  const sendingFacility = facilities.find((f) => f.id === context.facId) ?? null;

  // Action Card = the workflow's flat process steps.
  const activeProcessSteps = activeWorkflow?.processSteps ?? [];

  const hasReferralQuestion = workflowQuestions.some((q) => q.type === 'referral_resolve');

  const goToResult = useCallback(() => setPhase('result'), [setPhase]);
  const goToWorkflow = useCallback(() => setPhase('workflow'), [setPhase]);

  const getActiveCardStepsWrapped = useCallback(
    (svcId: string, ctId: string, facId: string): ProcessCardStep[] => {
      const svc = specialty.find((s) => s.id === svcId);
      if (!svc) return [];
      const ov = overrides.find((o) => o.facilityId === facId && o.svcId === svcId);
      return getActiveCardSteps(svc, ov?.parts[ctId] ?? null, ctId);
    },
    [specialty, overrides]
  );

  return {
    activeWorkflow,
    callTypeId,
    callTypeName,
    hasReferralQuestion,
    answers,
    currentIndex,
    taShown,
    phase,
    notifsSent,
    notes,
    caseId: activeCaseId,
    visibleQuestions,
    currentQuestion: visibleQuestions[currentIndex],
    context,
    acQueue,
    destFacility,
    sendingFacility,
    activeProcessSteps,
    setAnswer,
    goPrev,
    goNext,
    goToIndex,
    markTaShown,
    goToResult,
    goToWorkflow,
    closeActiveCase,
    markNotifsSent,
    setNotes,
    getActiveCardSteps: getActiveCardStepsWrapped,
  };
}
