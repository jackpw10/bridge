import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriage } from '../hooks/useTriage';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { NotesLog } from '../components/ui/NotesLog';
import { QuestionRenderer } from '../components/triage/QuestionRenderer';
import { TriageTabs } from '../components/triage/TriageTabs';
import { CaseEventLog } from '../components/triage/CaseEventLog';
import type { TACard } from '../types';

interface TaItem {
  svcId: string;
  svcName: string;
  card: TACard;
}

export function TriagePage() {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const nav = useNavigate();

  // If somebody hits /triage/run without picking a workflow, send them back.
  useEffect(() => {
    if (!t.activeWorkflow && t.phase === 'workflow') {
      nav('/triage', { replace: true });
    }
  }, [t.activeWorkflow, t.phase, nav]);

  const isAtEnd = t.currentIndex >= t.visibleQuestions.length;

  // ---- Audit log: log the question we just left every time currentIndex
  // advances. Fires regardless of whether advance came from a hotkey,
  // button, or child-component autoAdvance.
  const prevIndex = useRef(t.currentIndex);
  useEffect(() => {
    const prev = prevIndex.current;
    if (prev < t.currentIndex && prev < t.visibleQuestions.length) {
      const leaving = t.visibleQuestions[prev];
      if (leaving) {
        const answered = t.answers[leaving.id] ?? '';
        if (answered) {
          t.logAction('workflow_answer', `${leaving.text} → ${answered}`, {
            qid: leaving.id,
          });
        }
      }
    }
    prevIndex.current = t.currentIndex;
  }, [t.currentIndex, t.visibleQuestions, t.answers, t]);

  const referralQuestion = t.visibleQuestions.find((q) => q.type === 'referral_resolve');
  const referralAnswered =
    !!referralQuestion && !!t.answers[`${referralQuestion.id}__choice`];

  const taItems = useMemo<TaItem[]>(() => {
    if (!referralAnswered) return [];
    const destHaId = t.destFacility?.healthAuthorityId ?? '';
    const out: TaItem[] = [];
    for (const svcId of t.context.svcIds) {
      const svc = specialty.find((s) => s.id === svcId);
      if (!svc || !svc.transportAdvisor.enabled) continue;
      for (const card of svc.transportAdvisor.cards) {
        if (!card.callTypeIds.includes(t.callTypeId)) continue;
        if (!card.haIds.includes(destHaId)) continue;
        out.push({ svcId, svcName: svc.name, card });
      }
    }
    return out;
  }, [referralAnswered, t.context.svcIds, t.destFacility?.healthAuthorityId, t.callTypeId, specialty]);

  const unseenTa = useMemo(
    () => taItems.filter((i) => !t.taShown[i.card.id]),
    [taItems, t.taShown]
  );

  // End of questions → straight to the Result page. No post-triage step.
  useEffect(() => {
    if (t.phase !== 'workflow') return;
    if (!t.activeWorkflow) return;
    if (!isAtEnd) return;
    t.goToResult();
    nav('/triage/result');
  }, [t.phase, isAtEnd, t, nav]);

  // ---- Keyboard shortcuts during the workflow phase ----
  // Y / N → select Yes / No on yes/no questions (when no input is focused).
  // Enter → advance, unless focus is in a textarea (allows newlines in the
  // notes textarea) or a child handler already consumed the event (e.g.
  // Combobox committing an open dropdown).
  //
  // Declared above ALL conditional returns below. Otherwise the hook count
  // varies between renders (e.g. when the workflow finishes and we early-
  // return on missing currentQuestion) and React throws "rendered fewer
  // hooks than expected" — which is what crashed the page at end-of-triage.
  // Reads the current question + answers from the store directly so the
  // closure can't go stale between renders.
  useEffect(() => {
    function canAdvanceFresh(cur: NonNullable<typeof t.currentQuestion>): boolean {
      const st = useTriageStore.getState();
      const ac = st.cases.find((c) => c.id === st.activeCaseId);
      const answers = ac?.answers ?? {};
      if (cur.type === 'referral_resolve') {
        const choice = answers[`${cur.id}__choice`];
        if (!choice) return false;
        // An override needs BOTH a destination facility and a reason.
        if (choice === '__custom__') {
          if (!answers[`${cur.id}__customfacid`]) return false;
          if (!answers[`${cur.id}__reasonid`]) return false;
        }
        if (unseenTa.length > 0) return false;
        return true;
      }
      if (cur.type === 'text') {
        return !!(answers[cur.id] && answers[cur.id].trim());
      }
      if (cur.type === 'specialty_multi') {
        const raw = answers[`${cur.id}__svcs`];
        try { return raw ? (JSON.parse(raw) as string[]).length > 0 : false; } catch { return false; }
      }
      if (cur.type === 'diagnosis_multi') {
        const raw = answers[`${cur.id}__dxs`];
        try { return raw ? (JSON.parse(raw) as string[]).length > 0 : false; } catch { return false; }
      }
      if (cur.type === 'facility' || cur.type === 'receiving_facility') {
        return !!(answers[`${cur.id}__facid`] || answers[`${cur.id}__freetext`]);
      }
      return !!answers[cur.id];
    }

    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.defaultPrevented) return;
      if (t.phase !== 'workflow') return;
      const cur = t.currentQuestion;
      if (!cur) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Yes/No: the hotkey picks the answer AND advances to the next question.
      if (cur.type === 'yesno' || cur.type === 'triage') {
        if (!inEditable) {
          if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            t.setAnswer(cur.id, 'Yes');
            t.goNext();
            return;
          }
          if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            t.setAnswer(cur.id, 'No');
            t.goNext();
            return;
          }
        }
      }

      // Button hotkeys (first letter): B = Back, F = Forward, A = acknowledge
      // a Transport Advisor card. Ignored while typing in a field.
      if (!inEditable) {
        if (e.key === 'b' || e.key === 'B') {
          if (t.currentIndex > 0) {
            e.preventDefault();
            t.goPrev();
            return;
          }
        }
        if (e.key === 'f' || e.key === 'F') {
          if (canAdvanceFresh(cur)) {
            e.preventDefault();
            t.goNext();
            return;
          }
        }
        if (e.key === 'a' || e.key === 'A') {
          if (unseenTa.length > 0) {
            e.preventDefault();
            t.markTaShown(unseenTa[0].card.id);
            return;
          }
        }
      }

      if (e.key === 'Enter') {
        if (tag === 'TEXTAREA') return;
        if (canAdvanceFresh(cur)) {
          e.preventDefault();
          (target as HTMLElement | null)?.blur?.();
          t.goNext();
        }
      }

      // Tab advances out of a multi-select question (Enter there only toggles
      // options, so there'd otherwise be no keyboard way forward).
      if (e.key === 'Tab' && !e.shiftKey) {
        if (cur.type === 'specialty_multi' || cur.type === 'diagnosis_multi') {
          if (canAdvanceFresh(cur)) {
            e.preventDefault();
            (target as HTMLElement | null)?.blur?.();
            t.goNext();
          }
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Transitional: a result-phase case is briefly active here while a tab
  // switch navigates to /triage/result. Render nothing rather than flashing
  // stale question UI.
  if (t.phase === 'result') return null;

  if (!t.activeWorkflow) return null;

  if (!t.currentQuestion) {
    return (
      <Card>
        <div className="text-sm text-slate-500">Loading…</div>
      </Card>
    );
  }

  const cur = t.currentQuestion;

  // Mirrors canAdvanceFresh above but reads from the rendered closure so the
  // Next button's disabled state updates on every render (the keydown handler
  // can't use this version because it needs fresh state for in-flight changes).
  function canAdvance(): boolean {
    if (cur.type === 'referral_resolve') {
      const choice = t.answers[`${cur.id}__choice`];
      if (!choice) return false;
      if (choice === '__custom__') {
        if (!t.answers[`${cur.id}__customfacid`]) return false;
        if (!t.answers[`${cur.id}__reasonid`]) return false;
      }
      if (unseenTa.length > 0) return false;
      return true;
    }
    if (cur.type === 'text') return !!(t.answers[cur.id] && t.answers[cur.id].trim());
    if (cur.type === 'specialty_multi') {
      const raw = t.answers[`${cur.id}__svcs`];
      try { return raw ? (JSON.parse(raw) as string[]).length > 0 : false; } catch { return false; }
    }
    if (cur.type === 'diagnosis_multi') {
      const raw = t.answers[`${cur.id}__dxs`];
      try { return raw ? (JSON.parse(raw) as string[]).length > 0 : false; } catch { return false; }
    }
    if (cur.type === 'facility' || cur.type === 'receiving_facility') {
      return !!(t.answers[`${cur.id}__facid`] || t.answers[`${cur.id}__freetext`]);
    }
    return !!t.answers[cur.id];
  }

  return (
    <div className="space-y-4">
      <TriageTabs />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Initial Triage Questions</h1>
          <Badge tone="blue">{t.activeWorkflow.name}</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={() => nav(t.closeActiveCase())}>
          Cancel case
        </Button>
      </div>
      <ProgressBar current={t.currentIndex} total={t.visibleQuestions.length} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: question + answer. Fixed 2/3 width — stays put when the QAI
            box is hidden, rather than stretching to full width. */}
        <div className="lg:col-span-2">
          <Card title={`Question ${t.currentIndex + 1} of ${t.visibleQuestions.length}`}>
            <div className="space-y-4">
              <div>
                <div className="text-lg font-medium text-slate-800">{cur.text}</div>
                {cur.type === 'triage' && (
                  <Badge tone="purple" className="mt-1">Yes → LLTO · No → HLOC</Badge>
                )}
              </div>
              <QuestionRenderer
                key={cur.id}
                question={cur}
                answers={t.answers}
                setAnswer={t.setAnswer}
                callTypeId={t.callTypeId}
                onAdvance={t.goNext}
              />
            </div>
          </Card>
        </div>
        {/* Right: question additional info — only when set. */}
        {cur.additionalInfo && cur.additionalInfo.trim() && (
          <div className="lg:col-span-1">
            <Card title="Additional Info">
              <p className="text-sm whitespace-pre-wrap text-slate-700">{cur.additionalInfo}</p>
            </Card>
          </div>
        )}
      </div>

      {unseenTa.length > 0 && (
        <div className="space-y-3">
          {unseenTa.map((item) => (
            <Card
              key={item.card.id}
              title={`Transport Advisor — ${item.svcName}`}
              description={item.card.name}
            >
              {item.card.steps.length > 0 ? (
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {item.card.steps.map((s) => <li key={s.id}>{s.text}</li>)}
                </ol>
              ) : (
                <div className="text-sm text-slate-500">No steps on this card.</div>
              )}
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => t.markTaShown(item.card.id)}>
                  (A)cknowledge &amp; continue
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={t.goPrev} disabled={t.currentIndex === 0}>(B)ack</Button>
        <Button onClick={t.goNext} disabled={!canAdvance()}>(F)orward</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Progress" description="Click any answered question to jump back.">
            <ol className="text-sm space-y-1">
              {t.visibleQuestions.map((q, i) => {
                const isCur = i === t.currentIndex;
                const answered =
                  !!t.answers[q.id] ||
                  !!t.answers[`${q.id}__choice`] ||
                  !!t.answers[`${q.id}__svcs`] ||
                  !!t.answers[`${q.id}__dxs`] ||
                  !!t.answers[`${q.id}__facid`];
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => answered && t.goToIndex(i)}
                      className={`text-left w-full px-2 py-1 rounded ${isCur ? 'bg-brand-50 text-brand-800 font-medium' : answered ? 'hover:bg-slate-100' : 'text-slate-400'}`}
                    >
                      {i + 1}. {q.text}
                      {answered && t.answers[q.id] && (
                        <span className="text-slate-500 ml-2">— {t.answers[q.id]}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            {t.callTypeName && (
              <div className="text-xs text-slate-500 mt-3 flex gap-2 items-center">
                Call type: <Badge tone="blue">{t.callTypeName}</Badge>
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card
            title="Additional Information"
            description="Enter to save a timestamped note."
          >
            <NotesLog
              value={t.notes}
              onChange={t.setNotes}
              onEntry={(entry) => t.logAction('note', entry)}
            />
          </Card>
        </div>
      </div>

      <CaseEventLog events={t.events} />
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
