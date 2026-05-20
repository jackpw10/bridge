import { useTriage } from '../../hooks/useTriage';
import { useAppStore } from '../../store/appStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select, Textarea } from '../ui/Input';
import { MultiSelect } from '../ui/MultiSelect';
import { QuestionRenderer } from './QuestionRenderer';
import type {
  PostTriageQuestion,
  QuestionType,
  TransportReqItem,
  WorkflowQuestion,
} from '../../types';

interface Props {
  onDone: () => void;
}

export function PreQuestionsPanel({ onDone }: Props) {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);

  const cfg = t.activeWorkflow?.postTriage;

  const isQuestions = cfg?.mode === 'questions';
  const isTransport = cfg?.mode === 'transport_requirements';

  const postQs: PostTriageQuestion[] = isQuestions ? cfg.questions : [];
  const showServicePreQs = isQuestions ? cfg.showServicePreQuestions : false;
  const transportItems: TransportReqItem[] = isTransport ? cfg.items : [];

  function postAnswered(q: PostTriageQuestion): boolean {
    const v = t.postTriageAnswers[q.id] ?? '';
    return v.trim().length > 0;
  }

  function trItemAnswered(item: TransportReqItem): boolean {
    if (item.type === 'multiselect') {
      const raw = t.postTriageAnswers[`${item.id}__sel`] ?? '';
      try {
        return (JSON.parse(raw) as string[]).length > 0;
      } catch {
        return false;
      }
    }
    return (t.postTriageAnswers[item.id] ?? '').trim().length > 0;
  }

  function allAnswered(): boolean {
    if (isQuestions) {
      for (const q of postQs) if (!postAnswered(q)) return false;
      if (showServicePreQs) {
        for (const item of t.acQueue) {
          const qs = t.getActiveCardQs(item.svcId, t.callTypeId, t.subVersionId, item.destFacId);
          for (const q of qs) {
            const key = `${item.svcId}:${q.id}`;
            if (!t.acStates[key]) return false;
          }
        }
      }
      return true;
    }
    if (isTransport) {
      for (const item of transportItems) {
        if (item.type === 'multiselect' && !trItemAnswered(item)) return false;
        // text fields are optional
      }
      return true;
    }
    return true;
  }

  // Returning to the question list: land on the LAST question, not past the
  // end. Otherwise `isAtEnd` stays true and the Triage page immediately
  // bounces back into post-triage.
  function backToQuestions() {
    t.goToIndex(Math.max(0, t.visibleQuestions.length - 1));
    t.goToWorkflow();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Post Triage Questions</h1>
          <Badge tone="blue">{t.activeWorkflow?.name}</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={backToQuestions}>Back to questions</Button>
      </div>

      {isQuestions && postQs.length > 0 && (
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

      {isTransport && (
        <Card title="Transport requirements">
          <div className="space-y-4">
            {transportItems.map((item) => (
              <TransportReqRow
                key={item.id}
                item={item}
                answers={t.postTriageAnswers}
                setAnswer={(qid, value, sub) => {
                  t.setPostTriageAnswer(qid, value);
                  if (sub) {
                    for (const [k, v] of Object.entries(sub)) {
                      t.setPostTriageAnswer(`${qid}__${k}`, v);
                    }
                  }
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {isQuestions && showServicePreQs && t.acQueue.map((item) => {
        const svc = specialty.find((s) => s.id === item.svcId);
        const dest = facilities.find((f) => f.id === item.destFacId);
        if (!svc) return null;
        const qs = t.getActiveCardQs(item.svcId, t.callTypeId, t.subVersionId, item.destFacId);
        return (
          <Card
            key={`${item.svcId}:${item.destFacId}`}
            title={
              <span className="flex items-center gap-2">
                <span>{svc.name}</span>
                {t.callTypeName && <Badge tone="blue">{t.callTypeName}</Badge>}
                {t.subVersionName && <Badge tone="green">{t.subVersionName}</Badge>}
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
        <Button variant="secondary" onClick={backToQuestions}>Back</Button>
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

function TransportReqRow({
  item,
  answers,
  setAnswer,
}: {
  item: TransportReqItem;
  answers: Record<string, string>;
  setAnswer: (qid: string, value: string, sub?: Record<string, string>) => void;
}) {
  if (item.type === 'multiselect') {
    const raw = answers[`${item.id}__sel`] ?? '';
    let sel: string[] = [];
    try { sel = raw ? (JSON.parse(raw) as string[]) : []; } catch { sel = []; }
    const opts = (item.options ?? []).map((o) => ({ value: o.id, label: o.label }));
    return (
      <div>
        <div className="text-sm font-medium text-slate-700 mb-1">{item.label}</div>
        <MultiSelect
          options={opts}
          value={sel}
          onChange={(v) => {
            const labels = v
              .map((id) => item.options?.find((o) => o.id === id)?.label ?? id)
              .join(', ');
            setAnswer(item.id, labels, { sel: JSON.stringify(v) });
          }}
        />
      </div>
    );
  }
  return (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-1">{item.label}</div>
      <Textarea
        value={answers[item.id] ?? ''}
        onChange={(e) => setAnswer(item.id, e.target.value)}
      />
    </div>
  );
}
