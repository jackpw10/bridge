import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '../utils/id';

type Phase = 'workflow' | 'result';

// One in-progress triage call. The app keeps several of these open at once
// (tabbed triage); a case is removed only when cancelled or completed.
export interface TriageCase {
  id: string;
  workflowId: string;
  // Answers collected on the "New Case" screen BEFORE a call type is picked
  // (see admin: Initial Call Questions). Frozen once the case starts.
  initialAnswers: Record<string, string>;
  answers: Record<string, string>;
  currentIndex: number;
  taShown: Record<string, boolean>;
  phase: Phase;
  notifsSent: boolean;
  notes: string;
}

interface TriageRuntime {
  cases: TriageCase[];
  activeCaseId: string | null;

  // ----- case lifecycle -----
  startCase: (
    workflowId: string,
    initialAnswers?: Record<string, string>,
    initialNotes?: string,
  ) => string; // returns the new case id
  switchCase: (caseId: string) => void;
  closeCase: (caseId: string) => void;

  // ----- mutations on the ACTIVE case -----
  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
  goPrev: () => void;
  goNext: () => void;
  goToIndex: (i: number) => void;
  markTaShown: (key: string) => void;
  setPhase: (p: Phase) => void;
  markNotifsSent: () => void;
  setNotes: (s: string) => void;
}

function newCase(
  workflowId: string,
  initialAnswers: Record<string, string> = {},
  initialNotes = '',
): TriageCase {
  return {
    id: uid('case'),
    workflowId,
    initialAnswers,
    answers: {},
    currentIndex: 0,
    taShown: {},
    phase: 'workflow',
    notifsSent: false,
    notes: initialNotes,
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

      startCase: (workflowId, initialAnswers, initialNotes) => {
        const c = newCase(workflowId, initialAnswers, initialNotes);
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
      markNotifsSent: () => set((s) => patchActive(s, () => ({ notifsSent: true }))),
      setNotes: (str) => set((s) => patchActive(s, () => ({ notes: str }))),
    }),
    {
      name: 'bridge-triage-cases',
      storage: createJSONStorage(() => sessionStorage),
      // Persist only the case data — action functions are recreated each load.
      partialize: (s) => ({ cases: s.cases, activeCaseId: s.activeCaseId }),
      // Normalize legacy persisted cases: coerce any `pre-questions` phase to
      // `workflow`, and strip the fields that no longer exist. Non-destructive
      // to answers / current index.
      migrate: (raw) => {
        const r = (raw as { cases?: unknown; activeCaseId?: unknown }) ?? {};
        const cases = Array.isArray(r.cases) ? r.cases : [];
        return {
          cases: cases.map((c) => {
            const cc = c as Record<string, unknown>;
            const phase =
              cc.phase === 'result' ? 'result' : 'workflow'; // 'pre-questions' → 'workflow'
            return {
              id: String(cc.id ?? uid('case')),
              workflowId: String(cc.workflowId ?? ''),
              initialAnswers: (cc.initialAnswers as Record<string, string>) ?? {},
              answers: (cc.answers as Record<string, string>) ?? {},
              currentIndex: typeof cc.currentIndex === 'number' ? cc.currentIndex : 0,
              taShown: (cc.taShown as Record<string, boolean>) ?? {},
              phase,
              notifsSent: !!cc.notifsSent,
              notes: typeof cc.notes === 'string' ? cc.notes : '',
            } satisfies TriageCase;
          }),
          activeCaseId: (r.activeCaseId as string | null) ?? null,
        };
      },
      version: 3,
    }
  )
);
