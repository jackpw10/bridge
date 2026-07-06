import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '../utils/id';
import { supabase } from '../lib/supabase';
import { useAppStore } from './appStore';
import type { CaseEvent } from '../types';

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
  // Local action log for this case. Also persisted to Supabase so admins
  // can audit / watch active cases.
  events: CaseEvent[];
}

interface TriageRuntime {
  cases: TriageCase[];
  activeCaseId: string | null;

  // ----- case lifecycle -----
  startCase: (
    workflowId: string,
    workflowName: string,
    callTypeId: string,
    callTypeName: string,
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

  // Append an event to the ACTIVE case and fire-and-forget an insert to
  // Supabase (public.case_events). Detail is optional structured metadata.
  logAction: (eventType: string, summary: string, detail?: Record<string, unknown>) => void;
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
    events: [],
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

function currentActor(): string | null {
  return useAppStore.getState().session?.userId ?? null;
}

// Fire-and-forget Supabase insert. Failures are swallowed so a network hiccup
// never breaks the UI — the local log still has the entry either way.
function insertEventRow(ev: CaseEvent) {
  void supabase
    .from('case_events')
    .insert({
      id: ev.id,
      case_id: ev.caseId,
      actor: ev.actor,
      ts: ev.ts,
      event_type: ev.eventType,
      summary: ev.summary,
      detail: ev.detail,
    })
    .then(({ error }) => {
      if (error) console.warn('case_events insert failed:', error.message);
    });
}

// Open cases are persisted to sessionStorage so a page refresh keeps every
// tab. They clear when the browser tab is closed (transient working state).
export const useTriageStore = create<TriageRuntime>()(
  persist(
    (set) => ({
      cases: [],
      activeCaseId: null,

      startCase: (
        workflowId,
        workflowName,
        callTypeId,
        callTypeName,
        initialAnswers,
        initialNotes,
      ) => {
        const c = newCase(workflowId, initialAnswers, initialNotes);
        const actor = currentActor();
        const startedAt = Date.now();

        // Seed a case_started event locally.
        const startEv: CaseEvent = {
          id: uid('ev'),
          caseId: c.id,
          actor: actor ?? '',
          ts: startedAt,
          eventType: 'case_started',
          summary: `Case started — ${callTypeName || 'unknown call type'}`,
          detail: {
            workflowId,
            callTypeId,
            initialAnswers: initialAnswers ?? {},
          },
        };
        c.events = [startEv];

        set((s) => ({ cases: [...s.cases, c], activeCaseId: c.id }));

        // Persist to Supabase: cases row + first event. Best-effort.
        if (actor) {
          void supabase
            .from('cases')
            .insert({
              id: c.id,
              actor,
              workflow_id: workflowId,
              workflow_name: workflowName,
              call_type_id: callTypeId,
              call_type_name: callTypeName,
              started_at: startedAt,
              ended_at: null,
            })
            .then(({ error }) => {
              if (error) console.warn('cases insert failed:', error.message);
            });
          insertEventRow(startEv);
        }
        return c.id;
      },
      switchCase: (caseId) => set({ activeCaseId: caseId }),
      closeCase: (caseId) =>
        set((s) => {
          const closing = s.cases.find((c) => c.id === caseId);
          const remaining = s.cases.filter((c) => c.id !== caseId);
          let activeCaseId = s.activeCaseId;
          if (activeCaseId === caseId) {
            activeCaseId =
              remaining.length > 0 ? remaining[remaining.length - 1].id : null;
          }
          // Best-effort audit trail. Only touch the DB when the closing case
          // actually had a persisted row (i.e. was startCase-created).
          const actor = currentActor();
          if (closing && actor) {
            const endedAt = Date.now();
            const endEv: CaseEvent = {
              id: uid('ev'),
              caseId,
              actor,
              ts: endedAt,
              eventType: 'case_ended',
              summary: 'Case closed',
              detail: {},
            };
            insertEventRow(endEv);
            void supabase
              .from('cases')
              .update({ ended_at: endedAt })
              .eq('id', caseId)
              .then(({ error }) => {
                if (error) console.warn('cases update failed:', error.message);
              });
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

      logAction: (eventType, summary, detail) => {
        const actor = currentActor() ?? '';
        set((s) => {
          if (!s.activeCaseId) return {};
          const ev: CaseEvent = {
            id: uid('ev'),
            caseId: s.activeCaseId,
            actor,
            ts: Date.now(),
            eventType,
            summary,
            detail: detail ?? {},
          };
          if (actor) insertEventRow(ev);
          return {
            cases: s.cases.map((c) =>
              c.id === s.activeCaseId ? { ...c, events: [...c.events, ev] } : c,
            ),
          };
        });
      },
    }),
    {
      name: 'bridge-triage-cases',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ cases: s.cases, activeCaseId: s.activeCaseId }),
      // Normalize legacy persisted cases.
      migrate: (raw) => {
        const r = (raw as { cases?: unknown; activeCaseId?: unknown }) ?? {};
        const cases = Array.isArray(r.cases) ? r.cases : [];
        return {
          cases: cases.map((c) => {
            const cc = c as Record<string, unknown>;
            const phase =
              cc.phase === 'result' ? 'result' : 'workflow';
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
              events: Array.isArray(cc.events) ? (cc.events as CaseEvent[]) : [],
            } satisfies TriageCase;
          }),
          activeCaseId: (r.activeCaseId as string | null) ?? null,
        };
      },
      version: 4,
    }
  )
);
