import { create } from 'zustand';

type Phase = 'workflow' | 'pre-questions' | 'result';

interface TriageRuntime {
  answers: Record<string, string>;
  currentIndex: number;
  taShown: Record<string, boolean>;
  phase: Phase;
  acStates: Record<string, string>;
  notifsSent: boolean;

  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
  goPrev: () => void;
  goNext: () => void;
  goToIndex: (i: number) => void;
  markTaShown: (key: string) => void;
  setPhase: (p: Phase) => void;
  reset: () => void;
  setAcAnswer: (key: string, value: string) => void;
  markNotifsSent: () => void;
}

const initial = {
  answers: {} as Record<string, string>,
  currentIndex: 0,
  taShown: {} as Record<string, boolean>,
  phase: 'workflow' as Phase,
  acStates: {} as Record<string, string>,
  notifsSent: false,
};

export const useTriageStore = create<TriageRuntime>((set) => ({
  ...initial,
  setAnswer: (qid, value, subKeys) =>
    set((s) => {
      const answers = { ...s.answers, [qid]: value };
      if (subKeys) {
        for (const [k, v] of Object.entries(subKeys)) {
          answers[`${qid}__${k}`] = v;
        }
      }
      return { answers };
    }),
  goPrev: () => set((s) => ({ currentIndex: Math.max(0, s.currentIndex - 1) })),
  goNext: () => set((s) => ({ currentIndex: s.currentIndex + 1 })),
  goToIndex: (i) => set({ currentIndex: Math.max(0, i) }),
  markTaShown: (key) => set((s) => ({ taShown: { ...s.taShown, [key]: true } })),
  setPhase: (p) => set({ phase: p }),
  reset: () => set({ ...initial }),
  setAcAnswer: (key, value) => set((s) => ({ acStates: { ...s.acStates, [key]: value } })),
  markNotifsSent: () => set({ notifsSent: true }),
}));
