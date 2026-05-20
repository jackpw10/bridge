import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriage } from '../hooks/useTriage';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Input';
import { QuestionRenderer } from '../components/triage/QuestionRenderer';
import { PreQuestionsPanel } from '../components/triage/PreQuestionsPanel';
import { TriageTabs } from '../components/triage/TriageTabs';
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

  // Decide whether the post-triage screen is needed for this workflow.
  const postTriageNeeded = useMemo(() => {
    const cfg = t.activeWorkflow?.postTriage;
    if (!cfg || cfg.mode === 'none') return false;
    if (cfg.mode === 'questions') {
      if (cfg.questions.length > 0) return true;
      if (cfg.showServicePreQuestions && t.acQueue.length > 0) return true;
      return false;
    }
    if (cfg.mode === 'transport_requirements') {
      return cfg.items.length > 0;
    }
    return false;
  }, [t.activeWorkflow, t.acQueue.length]);

  useEffect(() => {
    if (t.phase !== 'workflow') return;
    if (!t.activeWorkflow) return;
    if (!isAtEnd) return;
    if (postTriageNeeded) {
      t.goToPreQuestions();
    } else {
      t.goToResult();
      nav('/triage/result');
    }
  }, [t.phase, isAtEnd, postTriageNeeded, t, nav]);

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

      if (cur.type === 'yesno' || cur.type === 'triage') {
        if (!inEditable) {
          if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            t.setAnswer(cur.id, 'Yes');
            return;
          }
          if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            t.setAnswer(cur.id, 'No');
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

  if (t.phase === 'pre-questions') {
    return (
      <div className="space-y-4">
        <TriageTabs />
        <PreQuestionsPanel
          onDone={() => {
            t.goToResult();
            nav('/triage/result');
          }}
        />
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        <Badge tone="blue">{t.activeWorkflow.name}</Badge>
        <Button size="sm" variant="ghost" onClick={() => nav(t.closeActiveCase())}>
          Cancel case
        </Button>
      </div>
      <ProgressBar current={t.currentIndex} total={t.visibleQuestions.length} />
      <Card
        title={`Question ${t.currentIndex + 1} of ${t.visibleQuestions.length}`}
      >
        <div className="space-y-4">
          <div>
            <div className="text-lg font-medium text-slate-800">{cur.text}</div>
            {cur.type === 'triage' && (
              <Badge tone="purple" className="mt-1">Yes → LLTO · No → HLOC</Badge>
            )}
          </div>
          <QuestionRenderer key={cur.id} question={cur} answers={t.answers} setAnswer={t.setAnswer} />
        </div>
      </Card>

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
                  Acknowledge & continue
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={t.goPrev} disabled={t.currentIndex === 0}>Back</Button>
        <Button onClick={t.goNext} disabled={!canAdvance()}>Next</Button>
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
            description="Notes can be added or updated any time during triage."
          >
            <Textarea
              value={t.notes}
              onChange={(e) => t.setNotes(e.target.value)}
              placeholder="Type any extra context, clinical notes, or handoff details…"
              rows={8}
            />
          </Card>
        </div>
      </div>
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
