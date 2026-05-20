import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '../utils/id';

type Phase = 'workflow' | 'pre-questions' | 'result';

// One in-progress triage call. The app keeps several of these open at once
// (tabbed triage); a case is removed only when cancelled or completed.
export interface TriageCase {
  id: string;
  workflowId: string;
  answers: Record<string, string>;
  currentIndex: number;
  taShown: Record<string, boolean>;
  phase: Phase;
  acStates: Record<string, string>;
  postTriageAnswers: Record<string, string>;
  notifsSent: boolean;
  notes: string;
}

interface TriageRuntime {
  cases: TriageCase[];
  activeCaseId: string | null;

  // ----- case lifecycle -----
  startCase: (workflowId: string) => string; // returns the new case id
  switchCase: (caseId: string) => void;
  closeCase: (caseId: string) => void;

  // ----- mutations on the ACTIVE case -----
  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
  goPrev: () => void;
  goNext: () => void;
  goToIndex: (i: number) => void;
  markTaShown: (key: string) => void;
  setPhase: (p: Phase) => void;
  setAcAnswer: (key: string, value: string) => void;
  setPostTriageAnswer: (key: string, value: string) => void;
  markNotifsSent: () => void;
  setNotes: (s: string) => void;
}

function newCase(workflowId: string): TriageCase {
  return {
    id: uid('case'),
    workflowId,
    answers: {},
    currentIndex: 0,
    taShown: {},
    phase: 'workflow',
    acStates: {},
    postTriageAnswers: {},
    notifsSent: false,
    notes: '',
  };
}

// Update whichever case is active. No-op if there is no active case.
function patchActive(
  s: TriageRuntime,
  patch: (c: TriageCase) => Partial<TriageCase>
): Partial<TriageRuntime> {
  if (!s.activeCaseId) return {};
  return {
    cases: s.cases.map((c) =>
      c.id === s.activeCaseId ? { ...c, ...patch(c) } : c
    ),
  };
}

// Open cases are persisted to sessionStorage so a page refresh keeps every
// tab. They clear when the browser tab is closed (transient working state).
export const useTriageStore = create<TriageRuntime>()(
  persist(
    (set) => ({
  cases: [],
  activeCaseId: null,

  startCase: (workflowId) => {
    const c = newCase(workflowId);
    set((s) => ({ cases: [...s.cases, c], activeCaseId: c.id }));
    return c.id;
  },
  switchCase: (caseId) => set({ activeCaseId: caseId }),
  closeCase: (caseId) =>
    set((s) => {
      const remaining = s.cases.filter((c) => c.id !== caseId);
      let activeCaseId = s.activeCaseId;
      if (activeCaseId === caseId) {
        activeCaseId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return { cases: remaining, activeCaseId };
    }),

  setAnswer: (qid, value, subKeys) =>
    set((s) =>
      patchActive(s, (c) => {
        const answers = { ...c.answers, [qid]: value };
        if (subKeys) {
          for (const [k, v] of Object.entries(subKeys)) {
            answers[`${qid}__${k}`] = v;
          }
        }
        return { answers };
      })
    ),
  goPrev: () =>
    set((s) => patchActive(s, (c) => ({ currentIndex: Math.max(0, c.currentIndex - 1) }))),
  goNext: () =>
    set((s) => patchActive(s, (c) => ({ currentIndex: c.currentIndex + 1 }))),
  goToIndex: (i) =>
    set((s) => patchActive(s, () => ({ currentIndex: Math.max(0, i) }))),
  markTaShown: (key) =>
    set((s) => patchActive(s, (c) => ({ taShown: { ...c.taShown, [key]: true } }))),
  setPhase: (p) => set((s) => patchActive(s, () => ({ phase: p }))),
  setAcAnswer: (key, value) =>
    set((s) => patchActive(s, (c) => ({ acStates: { ...c.acStates, [key]: value } }))),
  setPostTriageAnswer: (key, value) =>
    set((s) =>
      patchActive(s, (c) => ({
        postTriageAnswers: { ...c.postTriageAnswers, [key]: value },
      }))
    ),
  markNotifsSent: () => set((s) => patchActive(s, () => ({ notifsSent: true }))),
  setNotes: (str) => set((s) => patchActive(s, () => ({ notes: str }))),
    }),
    {
      name: 'bridge-triage-cases',
      storage: createJSONStorage(() => sessionStorage),
      // Persist only the case data — action functions are recreated each load.
      partialize: (s) => ({ cases: s.cases, activeCaseId: s.activeCaseId }),
    }
  )
);
