import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { DragList } from '../../components/ui/DragList';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import type { QuestionType, WorkflowQuestion } from '../../types';
import { uid } from '../../utils/id';
import { Link } from 'react-router-dom';

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'yesno', label: 'Yes / No' },
  { value: 'triage', label: 'Triage (Yes=LLTO, No=HLOC)' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Free text' },
  { value: 'facility', label: 'Sending facility' },
  { value: 'specialty_multi', label: 'Specialty services (multi)' },
  { value: 'diagnosis_multi', label: 'Diagnoses (multi)' },
  { value: 'referral_resolve', label: 'Referral resolve' },
];

export function AdminWorkflowPage() {
  const workflow = useAppStore((s) => s.workflow);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

  const [editing, setEditing] = useState<WorkflowQuestion | null>(null);
  const [adding, setAdding] = useState(false);

  function newQuestion(): WorkflowQuestion {
    return { id: uid('q'), type: 'yesno', text: 'New question' };
  }

  function save(q: WorkflowQuestion) {
    const exists = workflow.questions.some((x) => x.id === q.id);
    const next = exists
      ? workflow.questions.map((x) => (x.id === q.id ? q : x))
      : [...workflow.questions, q];
    setWorkflow({ questions: next });
  }

  function remove(id: string) {
    if (!window.confirm('Delete this question?')) return;
    setWorkflow({ questions: workflow.questions.filter((q) => q.id !== id) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">
            ← Admin
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Triage workflow</h1>
        </div>
        <Button onClick={() => setAdding(true)}>+ Add question</Button>
      </div>

      <Card>
        <DragList
          items={workflow.questions}
          onReorder={(next) => setWorkflow({ questions: next })}
          renderItem={(q, handle) => (
            <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-md bg-white">
              {handle}
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{q.text}</div>
                <div className="flex gap-2 mt-1 items-center">
                  <Badge tone="blue">{TYPES.find((t) => t.value === q.type)?.label ?? q.type}</Badge>
                  {q.condQid && (
                    <Badge tone="amber">
                      shows when {q.condQid} = "{q.condVal}"
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(q.id)}>
                Delete
              </Button>
            </div>
          )}
        />
      </Card>

      {(editing || adding) && (
        <QuestionEditor
          all={workflow.questions}
          initial={editing ?? newQuestion()}
          onCancel={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSave={(q) => {
            save(q);
            setEditing(null);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function QuestionEditor({
  initial,
  all,
  onSave,
  onCancel,
}: {
  initial: WorkflowQuestion;
  all: WorkflowQuestion[];
  onSave: (q: WorkflowQuestion) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState<WorkflowQuestion>(initial);

  function update<K extends keyof WorkflowQuestion>(k: K, v: WorkflowQuestion[K]) {
    setQ((cur) => ({ ...cur, [k]: v }));
  }

  return (
    <Modal open onClose={onCancel} title="Question" size="lg" footer={
      <>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(q)}>Save</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Question text" value={q.text} onChange={(e) => update('text', e.target.value)} />
        <Select label="Type" value={q.type} onChange={(e) => update('type', e.target.value as QuestionType)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        {q.type === 'dropdown' && (
          <Textarea
            label="Options (one per line)"
            value={(q.options ?? []).map((o) => o.label).join('\n')}
            onChange={(e) =>
              update(
                'options',
                e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((label) => ({ label }))
              )
            }
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Conditional on (optional)" value={q.condQid ?? ''} onChange={(e) => update('condQid', e.target.value || undefined)}>
            <option value="">— always show —</option>
            {all.filter((x) => x.id !== q.id).map((x) => (
              <option key={x.id} value={x.id}>{x.text}</option>
            ))}
          </Select>
          <Input label="Show when answer equals" value={q.condVal ?? ''} onChange={(e) => update('condVal', e.target.value || undefined)} />
        </div>
      </div>
    </Modal>
  );
}
