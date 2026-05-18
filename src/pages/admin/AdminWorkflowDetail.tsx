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
  PostTriageQuestion,
  ProcessStep,
  PsKey,
  QuestionType,
  Workflow,
  WorkflowQuestion,
} from '../../types';
import { uid } from '../../utils/id';

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

const PS_TABS: { key: PsKey; label: string }[] = [
  { key: 'lltoNo', label: 'LLTO Standard' },
  { key: 'lltoYes', label: 'LLTO Outside PTN' },
  { key: 'hlocNo', label: 'HLOC Standard' },
  { key: 'hlocYes', label: 'HLOC Outside PTN' },
];

export function AdminWorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const workflows = useAppStore((s) => s.workflows);
  const setWorkflows = useAppStore((s) => s.setWorkflows);
  const nav = useNavigate();

  const wf = workflows.find((w) => w.id === id);
  const [editingQ, setEditingQ] = useState<WorkflowQuestion | null>(null);
  const [addingQ, setAddingQ] = useState(false);
  const [psTab, setPsTab] = useState<PsKey>('lltoNo');

  if (!wf) {
    return (
      <div>
        <Link to="/admin/workflow" className="text-brand-600 hover:underline text-sm">← Workflows</Link>
        <div className="mt-4 text-sm text-slate-500">Workflow not found.</div>
      </div>
    );
  }
  const wfRef: Workflow = wf;

  function patch(p: Partial<Workflow>) {
    setWorkflows(workflows.map((w) => (w.id === wfRef.id ? { ...w, ...p } : w)));
  }

  function patchPostTriage(p: Partial<Workflow['postTriage']>) {
    patch({ postTriage: { ...wfRef.postTriage, ...p } });
  }

  function deleteWorkflow() {
    if (!window.confirm('Delete this workflow?')) return;
    setWorkflows(workflows.filter((w) => w.id !== wfRef.id));
    nav('/admin/workflow');
  }

  // ---------- workflow questions ----------
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

  // ---------- post-triage questions ----------
  function addPostQ() {
    const q: PostTriageQuestion = { id: uid('ptq'), type: 'yesno', text: 'New question' };
    patchPostTriage({ questions: [...wfRef.postTriage.questions, q] });
  }
  function updatePostQ(qid: string, p: Partial<PostTriageQuestion>) {
    patchPostTriage({
      questions: wfRef.postTriage.questions.map((q) => (q.id === qid ? { ...q, ...p } : q)),
    });
  }
  function removePostQ(qid: string) {
    patchPostTriage({
      questions: wfRef.postTriage.questions.filter((q) => q.id !== qid),
    });
  }
  function reorderPostQs(next: PostTriageQuestion[]) {
    patchPostTriage({ questions: next });
  }

  // ---------- process steps ----------
  function addStep() {
    const step: ProcessStep = { id: uid('ps'), text: 'New step' };
    patch({
      processSteps: { ...wfRef.processSteps, [psTab]: [...wfRef.processSteps[psTab], step] },
    });
  }
  function updateStep(sid: string, text: string) {
    patch({
      processSteps: {
        ...wfRef.processSteps,
        [psTab]: wfRef.processSteps[psTab].map((s) => (s.id === sid ? { ...s, text } : s)),
      },
    });
  }
  function removeStep(sid: string) {
    patch({
      processSteps: {
        ...wfRef.processSteps,
        [psTab]: wfRef.processSteps[psTab].filter((s) => s.id !== sid),
      },
    });
  }
  function reorderSteps(next: ProcessStep[]) {
    patch({ processSteps: { ...wfRef.processSteps, [psTab]: next } });
  }

  const newQ = (): WorkflowQuestion => ({ id: uid('q'), type: 'yesno', text: 'New question' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/workflow" className="text-xs text-brand-600 hover:underline">← Workflows</Link>
          <h1 className="text-2xl font-bold text-slate-800">{wf.name}</h1>
        </div>
        <Button variant="ghost" onClick={deleteWorkflow}>Delete workflow</Button>
      </div>

      <Card title="Identity">
        <Input label="Name" value={wf.name} onChange={(e) => patch({ name: e.target.value })} />
      </Card>

      <Card
        title="Workflow questions"
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
                <div className="flex gap-2 mt-1 items-center">
                  <Badge tone="blue">{TYPES.find((t) => t.value === q.type)?.label ?? q.type}</Badge>
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
        title="Post Triage Cards"
        description="The screen shown after triage questions. Has its own admin-defined questions plus an optional per-service pre-question section."
      >
        <div className="space-y-3">
          <Toggle
            checked={wf.postTriage.enabled}
            onChange={(v) => patchPostTriage({ enabled: v })}
            label="Show post-triage screen for this workflow"
          />
          {wf.postTriage.enabled && (
            <>
              <Toggle
                checked={wf.postTriage.showServicePreQuestions}
                onChange={(v) => patchPostTriage({ showServicePreQuestions: v })}
                label="Also show per-service pre-questions (configured on each specialty service)"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-700 text-sm">Post-triage questions</h4>
                  <Button size="sm" variant="secondary" onClick={addPostQ}>+ Add</Button>
                </div>
                <DragList
                  items={wf.postTriage.questions}
                  onReorder={reorderPostQs}
                  renderItem={(q, handle) => (
                    <div className="border rounded-md p-3 bg-white">
                      <div className="flex items-start gap-2">
                        {handle}
                        <div className="flex-1 space-y-2">
                          <Input value={q.text} onChange={(e) => updatePostQ(q.id, { text: e.target.value })} />
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={q.type} onChange={(e) => updatePostQ(q.id, { type: e.target.value as PostTriageQuestion['type'] })}>
                              <option value="yesno">Yes / No</option>
                              <option value="dropdown">Dropdown</option>
                              <option value="text">Free text</option>
                            </Select>
                            {q.type === 'dropdown' && (
                              <Input
                                placeholder="opt1|opt2"
                                value={(q.options ?? []).join('|')}
                                onChange={(e) =>
                                  updatePostQ(q.id, {
                                    options: e.target.value.split('|').map((s) => s.trim()).filter(Boolean),
                                  })
                                }
                              />
                            )}
                          </div>
                          <Toggle
                            checked={!!q.drivesPtnBucket}
                            onChange={(v) => updatePostQ(q.id, { drivesPtnBucket: v })}
                            label="Drives Outside-PTN bucket (a 'Yes' / non-empty answer uses the Outside-PTN process steps)"
                          />
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removePostQ(q.id)}>Delete</Button>
                      </div>
                    </div>
                  )}
                />
                {wf.postTriage.questions.length === 0 && (
                  <div className="text-xs text-slate-400">No questions yet — the post-triage screen will only show service pre-questions (if enabled).</div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      <Card
        title="Generic process steps"
        description="Shown on the result page. Bucket is picked from the triage question (LLTO/HLOC) and the post-triage PTN driver."
      >
        <div className="flex gap-2 border-b border-slate-200 mb-4 flex-wrap">
          {PS_TABS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setPsTab(v.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${psTab === v.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end mb-2">
          <Button size="sm" onClick={addStep}>+ Add step</Button>
        </div>
        <DragList
          items={wf.processSteps[psTab]}
          onReorder={reorderSteps}
          renderItem={(s, handle) => (
            <div className="flex items-start gap-2 border rounded-md p-3 bg-white">
              {handle}
              <div className="flex-1">
                <Textarea value={s.text} onChange={(e) => updateStep(s.id, e.target.value)} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeStep(s.id)}>Delete</Button>
            </div>
          )}
        />
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
