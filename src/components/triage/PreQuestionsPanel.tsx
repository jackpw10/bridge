import { useTriage } from '../../hooks/useTriage';
import { useAppStore } from '../../store/appStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select, Textarea } from '../ui/Input';
import { QuestionRenderer } from './QuestionRenderer';
import type { PostTriageQuestion, QuestionType, WorkflowQuestion } from '../../types';

interface Props {
  onDone: () => void;
}

export function PreQuestionsPanel({ onDone }: Props) {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);

  const cfg = t.activeWorkflow?.postTriage;
  const postQs: PostTriageQuestion[] = cfg?.questions ?? [];
  const showServicePreQs = !!cfg?.showServicePreQuestions;

  function postAnswered(q: PostTriageQuestion): boolean {
    const v = t.postTriageAnswers[q.id] ?? '';
    return v.trim().length > 0;
  }

  function allAnswered(): boolean {
    for (const q of postQs) {
      if (!postAnswered(q)) return false;
    }
    if (showServicePreQs) {
      for (const item of t.acQueue) {
        const qs = t.getActiveCardQs(item.svcId, t.verKey, item.destFacId);
        for (const q of qs) {
          const key = `${item.svcId}:${q.id}`;
          if (!t.acStates[key]) return false;
        }
      }
    }
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge tone="blue">{t.activeWorkflow?.name}</Badge>
        <Button size="sm" variant="ghost" onClick={t.goToWorkflow}>Back to questions</Button>
      </div>

      {postQs.length > 0 && (
        <Card title="Post Triage Cards" description="Answer these before generating the case summary.">
          <div className="space-y-4">
            {postQs.map((q) => (
              <PostTriageRow
                key={q.id}
                q={q}
                value={t.postTriageAnswers[q.id] ?? ''}
                onChange={(v) => t.setPostTriageAnswer(q.id, v)}
              />
            ))}
          </div>
        </Card>
      )}

      {showServicePreQs && t.acQueue.map((item) => {
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
                {t.hasTriageQuestion && (
                  <Badge tone={t.verKey === 'llto' ? 'green' : 'red'}>{t.verKey.toUpperCase()}</Badge>
                )}
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

function PostTriageRow({
  q,
  value,
  onChange,
}: {
  q: PostTriageQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-1">{q.text}</div>
      {q.type === 'yesno' && (
        <div className="flex gap-2">
          {['Yes', 'No'].map((opt) => (
            <Button
              key={opt}
              variant={value === opt ? 'primary' : 'secondary'}
              onClick={() => onChange(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}
      {q.type === 'dropdown' && (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
      )}
      {q.type === 'text' && (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
