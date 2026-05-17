import { useTriage } from '../../hooks/useTriage';
import { useAppStore } from '../../store/appStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Input';
import { QuestionRenderer } from './QuestionRenderer';
import type { QuestionType, WorkflowQuestion } from '../../types';

interface Props {
  onDone: () => void;
}

export function PreQuestionsPanel({ onDone }: Props) {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);

  const ptn = t.acStates['ptn'] ?? '';

  function allAnswered(): boolean {
    if (!ptn) return false;
    for (const item of t.acQueue) {
      const qs = t.getActiveCardQs(item.svcId, t.verKey, item.destFacId);
      for (const q of qs) {
        const key = `${item.svcId}:${q.id}`;
        if (!t.acStates[key]) return false;
      }
    }
    return true;
  }

  return (
    <div className="space-y-4">
      <Card
        title="Pre-questions before generating the result"
        description="Answer the service-specific questions, then generate the case summary."
      >
        <div className="space-y-2">
          <Select
            label="Was the patient accepted outside of PTN?"
            value={ptn}
            onChange={(e) => t.setAcAnswer('ptn', e.target.value)}
          >
            <option value="">— select —</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
          <div className="text-xs text-slate-500">
            Used to choose between Standard and Outside-PTN process steps.
          </div>
        </div>
      </Card>

      {t.acQueue.map((item) => {
        const svc = specialty.find((s) => s.id === item.svcId);
        const dest = facilities.find((f) => f.id === item.destFacId);
        if (!svc) return null;
        const qs = t.getActiveCardQs(item.svcId, t.verKey, item.destFacId);
        return (
          <Card
            key={`${item.svcId}:${item.destFacId}`}
            title={
              <span className="flex items-center gap-2">
                <span>{svc.name}</span>
                <Badge tone={t.verKey === 'llto' ? 'green' : 'red'}>{t.verKey.toUpperCase()}</Badge>
              </span>
            }
            description={`Destination: ${dest?.name ?? '—'}`}
          >
            {qs.length === 0 ? (
              <div className="text-sm text-slate-500">No service-specific pre-questions.</div>
            ) : (
              <div className="space-y-4">
                {qs.map((q) => {
                  const key = `${item.svcId}:${q.id}`;
                  // Adapt to QuestionRenderer's signature by wrapping
                  const wf: WorkflowQuestion = {
                    id: q.id,
                    type: q.type as QuestionType,
                    text: q.text,
                    options: q.options?.map((o) => ({ label: o })),
                  };
                  return (
                    <div key={key}>
                      <div className="text-sm font-medium text-slate-700 mb-1">{q.text}</div>
                      <QuestionRenderer
                        question={wf}
                        answers={{ [q.id]: t.acStates[key] ?? '' }}
                        setAnswer={(_qid, value) => t.setAcAnswer(key, value)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => t.goToWorkflow()}>Back</Button>
        <Button onClick={onDone} disabled={!allAnswered()}>Generate result</Button>
      </div>
    </div>
  );
}
