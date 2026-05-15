import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriage } from '../hooks/useTriage';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { QuestionRenderer } from '../components/triage/QuestionRenderer';
import { PreQuestionsPanel } from '../components/triage/PreQuestionsPanel';
import type { SpecialtyService } from '../types';

export function TriagePage() {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const nav = useNavigate();

  const isAtEnd = t.currentIndex >= t.visibleQuestions.length;
  const referralQuestion = t.visibleQuestions.find((q) => q.type === 'referral_resolve');
  const referralAnswered =
    !!referralQuestion && !!t.answers[`${referralQuestion.id}__choice`];

  const taItems = useMemo<SpecialtyService[]>(() => {
    if (!referralAnswered) return [];
    return t.context.svcIds
      .map((id) => specialty.find((s) => s.id === id))
      .filter((s): s is SpecialtyService => !!s && s.transportAdvisor.enabled);
  }, [t.context.svcIds, specialty, referralAnswered]);

  const unseenTa = useMemo(
    () => taItems.filter((s) => !t.taShown[s.id]),
    [taItems, t.taShown]
  );

  useEffect(() => {
    if (t.phase !== 'workflow') return;
    if (!isAtEnd) return;
    if (t.acQueue.length === 0) {
      t.goToResult();
      nav('/triage/result');
      return;
    }
    t.goToPreQuestions();
  }, [t.phase, isAtEnd, t.acQueue.length, t, nav]);

  if (t.phase === 'pre-questions') {
    return <PreQuestionsPanel onDone={() => { t.goToResult(); nav('/triage/result'); }} />;
  }

  if (!t.currentQuestion) {
    return (
      <Card>
        <div className="text-sm text-slate-500">Loading…</div>
      </Card>
    );
  }

  const cur = t.currentQuestion;

  function canAdvance(): boolean {
    if (cur.type === 'referral_resolve') {
      const choice = t.answers[`${cur.id}__choice`];
      if (!choice) return false;
      if (unseenTa.length > 0) return false;
      return true;
    }
    if (cur.type === 'text') return true;
    if (cur.type === 'specialty_multi') {
      const raw = t.answers[`${cur.id}__svcs`];
      try { return raw ? (JSON.parse(raw) as string[]).length > 0 : false; } catch { return false; }
    }
    if (cur.type === 'diagnosis_multi') {
      const raw = t.answers[`${cur.id}__dxs`];
      try { return raw ? (JSON.parse(raw) as string[]).length > 0 : false; } catch { return false; }
    }
    if (cur.type === 'facility') {
      return !!t.answers[`${cur.id}__facid`];
    }
    return !!t.answers[cur.id];
  }

  return (
    <div className="space-y-4">
      <ProgressBar current={t.currentIndex} total={t.visibleQuestions.length} />
      <Card
        title={`Question ${t.currentIndex + 1} of ${t.visibleQuestions.length}`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => t.reset()}>Start over</Button>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-lg font-medium text-slate-800">{cur.text}</div>
            {cur.type === 'triage' && (
              <Badge tone="purple" className="mt-1">Yes → LLTO · No → HLOC</Badge>
            )}
          </div>
          <QuestionRenderer question={cur} answers={t.answers} setAnswer={t.setAnswer} />
        </div>
      </Card>

      {unseenTa.length > 0 && (
        <div className="space-y-3">
          {unseenTa.map((svc) => {
            const dest = t.destFacility;
            const ha = dest?.healthAuthority ?? '';
            const card = svc.transportAdvisor.cardsByHA[ha];
            return (
              <Card key={svc.id} title={`Transport Advisor — ${svc.name}`} description={`HA: ${ha || 'unspecified'}`}>
                {card && card.steps.length > 0 ? (
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {card.steps.map((s) => <li key={s.id}>{s.text}</li>)}
                  </ol>
                ) : (
                  <div className="text-sm text-slate-500">No card configured for this HA.</div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => t.markTaShown(svc.id)}>Acknowledge & continue</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={t.goPrev} disabled={t.currentIndex === 0}>Back</Button>
        <Button onClick={t.goNext} disabled={!canAdvance()}>Next</Button>
      </div>

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
        <div className="text-xs text-slate-500 mt-3 flex gap-2 items-center">
          Version:{' '}
          <Badge tone={t.verKey === 'llto' ? 'green' : 'red'}>{t.verKey.toUpperCase()}</Badge>
        </div>
      </Card>
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
