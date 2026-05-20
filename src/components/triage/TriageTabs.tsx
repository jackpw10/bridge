import { useNavigate } from 'react-router-dom';
import { useTriageStore, type TriageCase } from '../../store/triageStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../utils/cn';

// A case's phase determines which page shows it.
function routeForPhase(phase: TriageCase['phase']): string {
  return phase === 'result' ? '/triage/result' : '/triage/run';
}

// Tab strip for the tabbed triage flow. Each open case is a tab; the heading
// is the case's sending-facility name. Shown on the Triage and Result pages.
export function TriageTabs() {
  const cases = useTriageStore((s) => s.cases);
  const activeCaseId = useTriageStore((s) => s.activeCaseId);
  const switchCase = useTriageStore((s) => s.switchCase);
  const workflows = useAppStore((s) => s.workflows);
  const facilities = useAppStore((s) => s.facilities);
  const nav = useNavigate();

  if (cases.length === 0) return null;

  function labelFor(c: TriageCase): string {
    const wf = workflows.find((w) => w.id === c.workflowId);
    if (wf) {
      const facQ = wf.questions.find((q) => q.type === 'facility');
      if (facQ) {
        const facId = c.answers[`${facQ.id}__facid`];
        if (facId) {
          const fac = facilities.find((f) => f.id === facId);
          if (fac) return fac.name;
        }
        const freeText = c.answers[`${facQ.id}__freetext`];
        if (freeText) return freeText;
      }
    }
    return wf ? `${wf.name} — new` : 'New case';
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
      {cases.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            switchCase(c.id);
            nav(routeForPhase(c.phase));
          }}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            c.id === activeCaseId
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          {labelFor(c)}
          {c.phase === 'result' && (
            <span className="ml-1.5 text-xs text-slate-400">(result)</span>
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={() => nav('/triage')}
        className="px-3 py-2 text-sm text-brand-600 hover:bg-slate-100 rounded"
        title="Start another case"
      >
        + New case
      </button>
    </div>
  );
}
