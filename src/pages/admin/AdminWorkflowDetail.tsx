import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DragList } from '../../components/ui/DragList';
import type {
  ProcessStep,
  QuestionType,
  Workflow,
  WorkflowQuestion,
} from '../../types';
import { uid } from '../../utils/id';

// Workflows are paired 1:1 with call types. The list page at /admin/workflow
// creates / renames / deletes the pair. This detail page edits the workflow
// itself (questions + the Action Card process steps).

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'yesno', label: 'Yes / No' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Free text' },
  { value: 'facility', label: 'Sending facility' },
  { value: 'receiving_facility', label: 'Receiving facility (direct)' },
  { value: 'specialty_multi', label: 'Specialty services (multi)' },
  { value: 'diagnosis_multi', label: 'Diagnoses (multi)' },
  { value: 'referral_resolve', label: 'Referral resolve (uses patterns)' },
];

export function AdminWorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const workflows = useAppStore((s) => s.workflows);
  const setWorkflows = useAppStore((s) => s.setWorkflows);
  const callTypes = useAppStore((s) => s.callTypes);
  const setCallTypes = useAppStore((s) => s.setCallTypes);
  const nav = useNavigate();

  const wf = workflows.find((w) => w.id === id);
  const [editingQ, setEditingQ] = useState<WorkflowQuestion | null>(null);
  const [addingQ, setAddingQ] = useState(false);

  if (!wf) {
    return (
      <div>
        <Link to="/admin/workflow" className="text-brand-600 hover:underline text-sm">← Call Types</Link>
        <div className="mt-4 text-sm text-slate-500">Call type not found.</div>
      </div>
    );
  }
  const wfRef: Workflow = wf;
  const activeCallType = callTypes.find((c) => c.id === wfRef.callTypeId);

  function patch(p: Partial<Workflow>) {
    setWorkflows(workflows.map((w) => (w.id === wfRef.id ? { ...w, ...p } : w)));
  }

  // Keep workflow name in sync with the paired call type name.
  function renamePair(name: string) {
    patch({ name });
    if (activeCallType) {
      setCallTypes(callTypes.map((c) => (c.id === activeCallType.id ? { ...c, name } : c)));
    }
  }

  function deleteWorkflow() {
    if (!window.confirm('Delete this call type?')) return;
    setWorkflows(workflows.filter((w) => w.id !== wfRef.id));
    if (activeCallType) {
      setCallTypes(callTypes.filter((c) => c.id !== activeCallType.id));
    }
    nav('/admin/workflow');
  }

  function saveQ(q: WorkflowQuestion) {
    const exists = wfRef.questions.some((x) => x.id === q.id);
    const next = exists
      ? wfRef.questions.map((x) => (x.id === q.id ? q : x))
      : [...wfRef.questions, q];
    patch({ questions: next });
  }
  function removeQ(qid: string) {
    if (!window.confirm('Delete this question?')) return;
    patch({ questions: wfRef.questions.filter((q) => q.id !== qid) });
  }
  function reorderQs(next: WorkflowQuestion[]) {
    patch({ questions: next });
  }

  // Process steps: flat list, one Action Card per workflow.
  function addStep() {
    patch({ processSteps: [...wfRef.processSteps, { id: uid('ps'), text: 'New step' }] });
  }
  function updateStep(sid: string, text: string) {
    patch({ processSteps: wfRef.processSteps.map((s) => (s.id === sid ? { ...s, text } : s)) });
  }
  function removeStep(sid: string) {
    patch({ processSteps: wfRef.processSteps.filter((s) => s.id !== sid) });
  }
  function reorderSteps(next: ProcessStep[]) {
    patch({ processSteps: next });
  }

  const newQ = (): WorkflowQuestion => ({ id: uid('q'), type: 'yesno', text: 'New question' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/workflow" className="text-xs text-brand-600 hover:underline">← Call Types</Link>
          <h1 className="text-2xl font-bold text-slate-800">{wf.name}</h1>
        </div>
        <Button variant="ghost" onClick={deleteWorkflow}>Delete call type</Button>
      </div>

      <Card title="Identity" description="The code letter is managed on the Call Types list.">
        <Input label="Name" value={wf.name} onChange={(e) => renamePair(e.target.value)} />
      </Card>

      <Card
        title="Initial Triage Questions"
        description="Questions the user answers during triage."
        actions={<Button size="sm" onClick={() => setAddingQ(true)}>+ Add question</Button>}
      >
        <DragList
          items={wf.questions}
          onReorder={reorderQs}
          renderItem={(q, handle) => (
            <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-md bg-white">
              {handle}
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{q.text}</div>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  <Badge tone="blue">{TYPES.find((t) => t.value === q.type)?.label ?? q.type}</Badge>
                  {q.allowFreeText && <Badge tone="amber">free text allowed</Badge>}
                  {q.condQid && (
                    <Badge tone="amber">
                      shows when {q.condQid} = "{q.condVal}"
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditingQ(q)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => removeQ(q.id)}>Delete</Button>
            </div>
          )}
        />
      </Card>

      <Card
        title="Action Card"
        description="A single ordered list of process steps shown on the result page."
        actions={<Button size="sm" onClick={addStep}>+ Add step</Button>}
      >
        <DragList
          items={wfRef.processSteps}
          onReorder={reorderSteps}
          renderItem={(s, handle) => (
            <div className="flex items-start gap-2 border rounded-md p-3 bg-white">
              {handle}
              <Textarea
                value={s.text}
                onChange={(e) => updateStep(s.id, e.target.value)}
                className="flex-1"
              />
              <Button size="sm" variant="ghost" onClick={() => removeStep(s.id)}>
                Delete
              </Button>
            </div>
          )}
        />
        {wfRef.processSteps.length === 0 && (
          <div className="text-xs text-slate-400 mt-2">No steps yet.</div>
        )}
      </Card>

      {(editingQ || addingQ) && (
        <QuestionEditor
          all={wf.questions}
          initial={editingQ ?? newQ()}
          onCancel={() => { setEditingQ(null); setAddingQ(false); }}
          onSave={(q) => { saveQ(q); setEditingQ(null); setAddingQ(false); }}
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

  const allowsFreeText = q.type === 'facility' || q.type === 'receiving_facility';

  return (
    <Modal open onClose={onCancel} title="Question" size="lg" footer={
      <>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(q)}>Save</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Question text" value={q.text} onChange={(e) => update('text', e.target.value)} />
        <Textarea
          label="Question Additional Info (optional reference text shown beside the question)"
          value={q.additionalInfo ?? ''}
          onChange={(e) => update('additionalInfo', e.target.value || undefined)}
        />
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
        {allowsFreeText && (
          <Toggle
            checked={!!q.allowFreeText}
            onChange={(v) => update('allowFreeText', v)}
            label="Allow free-text entry (in addition to facility picker)"
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
