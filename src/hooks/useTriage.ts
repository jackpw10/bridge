import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import type {
  AcQueueItem,
  CardOverridePart,
  ExceptionStep,
  Facility,
  ProcessStep,
  SpecialtyService,
  TemplateQuestion,
  TriageContext,
  Workflow,
  WorkflowQuestion,
} from '../types';

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
  let svcIds: string[] = [];
  let destFacId: string | null = null;
  let diagnoses: string[] = [];

  for (const q of scan) {
    if (q.type === 'facility') {
      const f = answers[`${q.id}__facid`];
      if (f) facId = f;
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
  return { facId, svcIds, destFacId, diagnoses };
}

function applyOrder<T extends { id: string }>(all: T[], order: string[]): T[] {
  if (!order.length) return all;
  const map = new Map(all.map((q) => [q.id, q] as const));
  const out: T[] = [];
  for (const id of order) {
    const q = map.get(id);
    if (q) {
      out.push(q);
      map.delete(id);
    }
  }
  for (const q of map.values()) out.push(q);
  return out;
}

function getActiveCardQs(
  service: SpecialtyService,
  override: CardOverridePart | null,
  callTypeId: string
): TemplateQuestion[] {
  const tpl = service.templates[callTypeId];
  const baseQs = tpl?.preQuestions ?? [];
  const base = baseQs.filter((q) => !override?.deactivated.includes(q.id));
  const all = [...base, ...(override?.addedQuestions ?? [])];
  return applyOrder(all, override?.qOrder ?? []);
}

function getActiveCardSteps(
  service: SpecialtyService,
  override: CardOverridePart | null,
  callTypeId: string,
  preAnswers: Record<string, string>
): ExceptionStep[] {
  const tpl = service.templates[callTypeId];
  const baseSteps = tpl?.exceptionSteps ?? [];
  const base = baseSteps.filter((s) => !override?.deactivated.includes(s.id));
  const all = [...base, ...(override?.addedSteps ?? [])];
  const ordered = applyOrder(all, override?.sOrder ?? []);
  return ordered.filter((s) => {
    if (!s.condQid) return true;
    const a = (preAnswers[s.condQid] ?? '').toLowerCase();
    const want = (s.condVal ?? '').toLowerCase();
    return a === want;
  });
}

export interface UseTriageResult {
  activeWorkflow: Workflow | null;
  callTypeId: string;
  callTypeName: string;
  hasReferralQuestion: boolean;

  answers: Record<string, string>;
  currentIndex: number;
  taShown: Record<string, boolean>;
  phase: 'workflow' | 'pre-questions' | 'result';
  acStates: Record<string, string>;
  postTriageAnswers: Record<string, string>;
  notifsSent: boolean;
  notes: string;

  visibleQuestions: WorkflowQuestion[];
  currentQuestion: WorkflowQuestion | undefined;
  context: TriageContext;
  acQueue: AcQueueItem[];
  destFacility: Facility | null;
  sendingFacility: Facility | null;
  activeProcessSteps: ProcessStep[];

  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
  goPrev: () => void;
  goNext: () => void;
  goToIndex: (i: number) => void;
  markTaShown: (key: string) => void;
  goToPreQuestions: () => void;
  goToResult: () => void;
  goToWorkflow: () => void;
  reset: () => void;
  setAcAnswer: (key: string, value: string) => void;
  setPostTriageAnswer: (key: string, value: string) => void;
  markNotifsSent: () => void;
  setNotes: (s: string) => void;

  getActiveCardQs: (svcId: string, callTypeId: string, facId: string) => TemplateQuestion[];
  getActiveCardSteps: (
    svcId: string,
    callTypeId: string,
    facId: string,
    preAnswers: Record<string, string>
  ) => ExceptionStep[];
}

export function useTriage(): UseTriageResult {
  const workflows = useAppStore((s) => s.workflows);
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const overrides = useAppStore((s) => s.overrides);
  const callTypes = useAppStore((s) => s.callTypes);

  const activeWorkflowId = useTriageStore((s) => s.activeWorkflowId);
  const answers = useTriageStore((s) => s.answers);
  const currentIndex = useTriageStore((s) => s.currentIndex);
  const taShown = useTriageStore((s) => s.taShown);
  const phase = useTriageStore((s) => s.phase);
  const acStates = useTriageStore((s) => s.acStates);
  const postTriageAnswers = useTriageStore((s) => s.postTriageAnswers);
  const notifsSent = useTriageStore((s) => s.notifsSent);
  const notes = useTriageStore((s) => s.notes);

  const setAnswer = useTriageStore((s) => s.setAnswer);
  const goPrev = useTriageStore((s) => s.goPrev);
  const goNext = useTriageStore((s) => s.goNext);
  const goToIndex = useTriageStore((s) => s.goToIndex);
  const markTaShown = useTriageStore((s) => s.markTaShown);
  const setPhase = useTriageStore((s) => s.setPhase);
  const reset = useTriageStore((s) => s.reset);
  const setAcAnswer = useTriageStore((s) => s.setAcAnswer);
  const setPostTriageAnswer = useTriageStore((s) => s.setPostTriageAnswer);
  const markNotifsSent = useTriageStore((s) => s.markNotifsSent);
  const setNotes = useTriageStore((s) => s.setNotes);

  const activeWorkflow = useMemo(
    () => workflows.find((w) => w.id === activeWorkflowId) ?? null,
    [workflows, activeWorkflowId]
  );

  const callTypeId = activeWorkflow?.callTypeId ?? '';
  const callTypeName = callTypes.find((c) => c.id === callTypeId)?.name ?? '';

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

  const activeProcessSteps = useMemo(() => {
    if (!activeWorkflow) return [];
    return activeWorkflow.processSteps.filter((s) => {
      if (!s.condQid) return true;
      const a = (postTriageAnswers[s.condQid] ?? '').toLowerCase();
      const want = (s.condVal ?? '').toLowerCase();
      return a === want;
    });
  }, [activeWorkflow, postTriageAnswers]);

  const hasReferralQuestion = workflowQuestions.some((q) => q.type === 'referral_resolve');

  const goToPreQuestions = useCallback(() => setPhase('pre-questions'), [setPhase]);
  const goToResult = useCallback(() => setPhase('result'), [setPhase]);
  const goToWorkflow = useCallback(() => setPhase('workflow'), [setPhase]);

  const getActiveCardQsWrapped = useCallback(
    (svcId: string, ctId: string, facId: string): TemplateQuestion[] => {
      const svc = specialty.find((s) => s.id === svcId);
      if (!svc) return [];
      const ov = overrides.find((o) => o.facilityId === facId && o.svcId === svcId);
      return getActiveCardQs(svc, ov?.parts[ctId] ?? null, ctId);
    },
    [specialty, overrides]
  );

  const getActiveCardStepsWrapped = useCallback(
    (svcId: string, ctId: string, facId: string, preAnswers: Record<string, string>): ExceptionStep[] => {
      const svc = specialty.find((s) => s.id === svcId);
      if (!svc) return [];
      const ov = overrides.find((o) => o.facilityId === facId && o.svcId === svcId);
      return getActiveCardSteps(svc, ov?.parts[ctId] ?? null, ctId, preAnswers);
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
    acStates,
    postTriageAnswers,
    notifsSent,
    notes,
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
    goToPreQuestions,
    goToResult,
    goToWorkflow,
    reset,
    setAcAnswer,
    setPostTriageAnswer,
    markNotifsSent,
    setNotes,
    getActiveCardQs: getActiveCardQsWrapped,
    getActiveCardSteps: getActiveCardStepsWrapped,
  };
}
