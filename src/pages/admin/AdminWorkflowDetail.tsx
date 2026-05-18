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
  CallType,
  Condition,
  PostTriageConfig,
  PostTriageQuestion,
  ProcessStep,
  QuestionType,
  TransportReqItem,
  Workflow,
  WorkflowQuestion,
} from '../../types';
import { uid } from '../../utils/id';

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
  const nav = useNavigate();

  const wf = workflows.find((w) => w.id === id);
  const [editingQ, setEditingQ] = useState<WorkflowQuestion | null>(null);
  const [addingQ, setAddingQ] = useState(false);
  const [psTabSvId, setPsTabSvId] = useState<string>('');
  const [psTabPtn, setPsTabPtn] = useState<'std' | 'outside'>('std');

  if (!wf) {
    return (
      <div>
        <Link to="/admin/workflow" className="text-brand-600 hover:underline text-sm">← Workflows</Link>
        <div className="mt-4 text-sm text-slate-500">Workflow not found.</div>
      </div>
    );
  }
  const wfRef: Workflow = wf;
  const activeCallType: CallType | undefined = callTypes.find((c) => c.id === wfRef.callTypeId);

  function patch(p: Partial<Workflow>) {
    setWorkflows(workflows.map((w) => (w.id === wfRef.id ? { ...w, ...p } : w)));
  }

  function deleteWorkflow() {
    if (!window.confirm('Delete this workflow?')) return;
    setWorkflows(workflows.filter((w) => w.id !== wfRef.id));
    nav('/admin/workflow');
  }

  // ---- workflow questions ----
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

  // ---- process steps (per sub-version) ----
  function stepsFor(svId: string): ProcessStep[] {
    return wfRef.processSteps[svId] ?? [];
  }
  function patchStepsFor(svId: string, steps: ProcessStep[]) {
    patch({ processSteps: { ...wfRef.processSteps, [svId]: steps } });
  }
  function addStepFor(svId: string) {
    patchStepsFor(svId, [...stepsFor(svId), { id: uid('ps'), text: 'New step' }]);
  }
  function updateStepFor(svId: string, sid: string, text: string) {
    patchStepsFor(svId, stepsFor(svId).map((s) => (s.id === sid ? { ...s, text } : s)));
  }
  function removeStepFor(svId: string, sid: string) {
    patchStepsFor(svId, stepsFor(svId).filter((s) => s.id !== sid));
  }

  // ---- sub-version rules ----
  function patchSubVersionRule(svId: string, rules: Condition[]) {
    patch({ subVersionRules: { ...wfRef.subVersionRules, [svId]: rules } });
  }

  // ---- post-triage helpers ----
  function setPostTriageMode(mode: PostTriageConfig['mode']) {
    if (mode === 'none') {
      patch({ postTriage: { mode: 'none' } });
    } else if (mode === 'questions') {
      patch({
        postTriage: {
          mode: 'questions',
          showServicePreQuestions: true,
          questions:
            wfRef.postTriage.mode === 'questions' ? wfRef.postTriage.questions : [],
        },
      });
    } else {
      patch({
        postTriage: {
          mode: 'transport_requirements',
          items:
            wfRef.postTriage.mode === 'transport_requirements'
              ? wfRef.postTriage.items
              : [],
        },
      });
    }
  }

  const newQ = (): WorkflowQuestion => ({ id: uid('q'), type: 'yesno', text: 'New question' });

  // ---- conditions list available for step / question gating ----
  // Conditions can reference workflow Qs and (for steps) post-triage Qs.
  const workflowCondRefs = wfRef.questions.map((q) => ({ id: q.id, label: q.text }));
  const postTriageCondRefs = wfRef.postTriage.mode === 'questions'
    ? wfRef.postTriage.questions.map((q) => ({ id: q.id, label: `(post) ${q.text}` }))
    : [];
  const allCondRefs = [...workflowCondRefs, ...postTriageCondRefs];

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
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={wf.name} onChange={(e) => patch({ name: e.target.value })} />
          <Select
            label="Call type"
            value={wf.callTypeId}
            onChange={(e) => patch({ callTypeId: e.target.value })}
          >
            <option value="">— pick one —</option>
            {callTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>{ct.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      {activeCallType && activeCallType.subVersions.length > 0 && (
        <Card
          title="Sub-version selection rules"
          description={`${activeCallType.name} has these sub-versions: ${activeCallType.subVersions.map((s) => s.name).join(', ')}. For each one, list the conditions that must ALL be true for a case to be that sub-version. First matching wins.`}
        >
          <div className="space-y-4">
            {activeCallType.subVersions.map((sv) => (
              <div key={sv.id} className="border rounded-md p-3 bg-slate-50">
                <div className="font-semibold text-sm mb-2">{sv.name}</div>
                <ConditionEditor
                  value={wfRef.subVersionRules[sv.id] ?? []}
                  onChange={(r) => patchSubVersionRule(sv.id, r)}
                  references={allCondRefs}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

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

      <Card title="Post-triage screen">
        <div className="space-y-3">
          <Select
            label="Mode"
            value={wf.postTriage.mode}
            onChange={(e) => setPostTriageMode(e.target.value as PostTriageConfig['mode'])}
          >
            <option value="none">None (skip the post-triage screen entirely)</option>
            <option value="questions">Questions (yes/no, dropdown, text + optional per-service pre-questions)</option>
            <option value="transport_requirements">Transport requirements (multi-select groups + free text)</option>
          </Select>

          {wf.postTriage.mode === 'questions' && (
            <PostTriageQuestionsEditor
              cfg={wf.postTriage}
              onChange={(next) => patch({ postTriage: next })}
            />
          )}

          {wf.postTriage.mode === 'transport_requirements' && (
            <TransportReqEditor
              cfg={wf.postTriage}
              onChange={(next) => patch({ postTriage: next })}
            />
          )}
        </div>
      </Card>

      <ProcessStepsEditor
        wf={wfRef}
        callType={activeCallType}
        activeSvId={psTabSvId}
        setActiveSvId={setPsTabSvId}
        activePtn={psTabPtn}
        setActivePtn={setPsTabPtn}
        stepsFor={stepsFor}
        addStepFor={addStepFor}
        updateStepFor={updateStepFor}
        removeStepFor={removeStepFor}
        reorder={(svId, next) => patchStepsFor(svId, next)}
      />

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

function ProcessStepsEditor({
  wf,
  callType,
  activeSvId,
  setActiveSvId,
  activePtn,
  setActivePtn,
  stepsFor,
  addStepFor,
  updateStepFor,
  removeStepFor,
  reorder,
}: {
  wf: Workflow;
  callType: CallType | undefined;
  activeSvId: string;
  setActiveSvId: (id: string) => void;
  activePtn: 'std' | 'outside';
  setActivePtn: (v: 'std' | 'outside') => void;
  stepsFor: (svId: string) => ProcessStep[];
  addStepFor: (svId: string) => void;
  updateStepFor: (svId: string, sid: string, text: string) => void;
  removeStepFor: (svId: string, sid: string) => void;
  reorder: (svId: string, next: ProcessStep[]) => void;
}) {
  const subVersions = callType?.subVersions ?? [];
  const effectiveSvId = activeSvId || subVersions[0]?.id || '';

  // PTN-aware: if the workflow's post-triage has an isPtnQuestion, process
  // steps are stored under `${svId}:${'std'|'outside'}`. Otherwise just `${svId}`.
  const hasPtn = wf.postTriage.mode === 'questions'
    && wf.postTriage.questions.some((q) => q.isPtnQuestion);

  const composedKey = effectiveSvId
    ? (hasPtn ? `${effectiveSvId}:${activePtn}` : effectiveSvId)
    : '';
  const steps = composedKey ? stepsFor(composedKey) : [];

  if (subVersions.length === 0) {
    return (
      <Card title="Generic process steps">
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          This workflow's call type has no sub-versions. Add at least one in Admin → Call Types
          before configuring process steps.
        </div>
      </Card>
    );
  }

  const ptnTabs: Array<{ id: 'std' | 'outside'; label: string }> = [
    { id: 'std', label: 'Standard' },
    { id: 'outside', label: 'Outside PTN' },
  ];

  return (
    <Card
      title="Generic process steps"
      description={
        hasPtn
          ? 'One ordered list per sub-version × PTN variant. The active PTN question (in post-triage) decides which variant is shown on the result page.'
          : 'One ordered list per sub-version. Whichever sub-version the case resolves to, those steps show on the result page.'
      }
      actions={
        composedKey ? (
          <Button size="sm" onClick={() => addStepFor(composedKey)}>+ Add step</Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-2">
        {subVersions.map((sv) => (
          <button
            key={sv.id}
            type="button"
            onClick={() => setActiveSvId(sv.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              effectiveSvId === sv.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'
            }`}
          >
            {sv.name}
            <span className="ml-2 text-xs text-slate-400">
              ({hasPtn
                ? stepsFor(`${sv.id}:std`).length + stepsFor(`${sv.id}:outside`).length
                : stepsFor(sv.id).length})
            </span>
          </button>
        ))}
      </div>
      {hasPtn && (
        <div className="flex flex-wrap gap-2 mb-4">
          {ptnTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActivePtn(t.id)}
              className={`px-2.5 py-1 text-xs rounded ${
                activePtn === t.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 ${activePtn === t.id ? 'text-white/70' : 'text-slate-400'}`}>
                ({stepsFor(`${effectiveSvId}:${t.id}`).length})
              </span>
            </button>
          ))}
        </div>
      )}
      <DragList
        items={steps}
        onReorder={(next) => reorder(composedKey, next)}
        renderItem={(s, handle) => (
          <div className="flex items-start gap-2 border rounded-md p-3 bg-white">
            {handle}
            <Textarea
              value={s.text}
              onChange={(e) => updateStepFor(composedKey, s.id, e.target.value)}
              className="flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => removeStepFor(composedKey, s.id)}>
              Delete
            </Button>
          </div>
        )}
      />
      {steps.length === 0 && (
        <div className="text-xs text-slate-400 mt-2">No steps yet for this variant.</div>
      )}
    </Card>
  );
}

function ConditionEditor({
  value,
  onChange,
  references,
}: {
  value: Condition[];
  onChange: (next: Condition[]) => void;
  references: Array<{ id: string; label: string }>;
}) {
  function add() {
    onChange([...value, { qid: '', equals: '' }]);
  }
  function update(i: number, patch: Partial<Condition>) {
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Show only when…</span>
        <Button size="sm" variant="secondary" onClick={add}>+ Add condition</Button>
      </div>
      {value.length === 0 ? (
        <div className="text-xs text-slate-400">— always shown —</div>
      ) : (
        value.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <Select value={c.qid} onChange={(e) => update(i, { qid: e.target.value })}>
              <option value="">— question —</option>
              {references.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
            <Input
              placeholder="equals"
              value={c.equals}
              onChange={(e) => update(i, { equals: e.target.value })}
            />
            <Button size="sm" variant="ghost" onClick={() => remove(i)}>×</Button>
          </div>
        ))
      )}
    </div>
  );
}

function PostTriageQuestionsEditor({
  cfg,
  onChange,
}: {
  cfg: Extract<PostTriageConfig, { mode: 'questions' }>;
  onChange: (next: PostTriageConfig) => void;
}) {
  function patch(p: Partial<Extract<PostTriageConfig, { mode: 'questions' }>>) {
    onChange({ ...cfg, ...p });
  }
  function addQ() {
    const q: PostTriageQuestion = { id: uid('ptq'), type: 'yesno', text: 'New question' };
    patch({ questions: [...cfg.questions, q] });
  }
  function updQ(qid: string, p: Partial<PostTriageQuestion>) {
    patch({
      questions: cfg.questions.map((q) => (q.id === qid ? { ...q, ...p } : q)),
    });
  }
  function removeQ(qid: string) {
    patch({ questions: cfg.questions.filter((q) => q.id !== qid) });
  }
  function reorder(next: PostTriageQuestion[]) {
    patch({ questions: next });
  }

  return (
    <>
      <Toggle
        checked={cfg.showServicePreQuestions}
        onChange={(v) => patch({ showServicePreQuestions: v })}
        label="Also show per-service pre-questions (configured on each specialty service)"
      />
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Post-triage questions</span>
          <Button size="sm" variant="secondary" onClick={addQ}>+ Add</Button>
        </div>
        <DragList
          items={cfg.questions}
          onReorder={reorder}
          renderItem={(q, handle) => (
            <div className="border rounded-md p-3 bg-white">
              <div className="flex items-start gap-2">
                {handle}
                <div className="flex-1 space-y-2">
                  <Input value={q.text} onChange={(e) => updQ(q.id, { text: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={q.type} onChange={(e) => updQ(q.id, { type: e.target.value as PostTriageQuestion['type'] })}>
                      <option value="yesno">Yes / No</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="text">Free text</option>
                    </Select>
                    {q.type === 'dropdown' && (
                      <Input
                        placeholder="opt1|opt2"
                        value={(q.options ?? []).join('|')}
                        onChange={(e) =>
                          updQ(q.id, {
                            options: e.target.value.split('|').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    )}
                  </div>
                  {q.type === 'yesno' && (
                    <Toggle
                      checked={!!q.isPtnQuestion}
                      onChange={(v) => {
                        // Only one PTN question per workflow — clear flag on any others.
                        const next = cfg.questions.map((other) =>
                          other.id === q.id
                            ? { ...other, isPtnQuestion: v }
                            : { ...other, isPtnQuestion: v ? false : other.isPtnQuestion }
                        );
                        patch({ questions: next });
                      }}
                      label="Mark as PTN question (Yes/No answer splits generic process steps into Standard / Outside PTN variants)"
                    />
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeQ(q.id)}>Delete</Button>
              </div>
            </div>
          )}
        />
      </div>
    </>
  );
}

function TransportReqEditor({
  cfg,
  onChange,
}: {
  cfg: Extract<PostTriageConfig, { mode: 'transport_requirements' }>;
  onChange: (next: PostTriageConfig) => void;
}) {
  function patch(items: TransportReqItem[]) {
    onChange({ ...cfg, items });
  }
  function addMulti() {
    patch([
      ...cfg.items,
      { id: uid('tri'), type: 'multiselect', label: 'New group', options: [] },
    ]);
  }
  function addText() {
    patch([...cfg.items, { id: uid('tri'), type: 'text', label: 'New text field' }]);
  }
  function updItem(itemId: string, p: Partial<TransportReqItem>) {
    patch(cfg.items.map((i) => (i.id === itemId ? ({ ...i, ...p } as TransportReqItem) : i)));
  }
  function removeItem(itemId: string) {
    patch(cfg.items.filter((i) => i.id !== itemId));
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={addMulti}>+ Add multi-select group</Button>
        <Button size="sm" variant="secondary" onClick={addText}>+ Add text field</Button>
      </div>
      <DragList
        items={cfg.items}
        onReorder={(next) => patch(next)}
        renderItem={(item, handle) => (
          <div className="border rounded-md p-3 bg-white space-y-2">
            <div className="flex items-start gap-2">
              {handle}
              <Badge tone="slate">{item.type}</Badge>
              <Input
                value={item.label}
                onChange={(e) => updItem(item.id, { label: e.target.value })}
                className="flex-1"
              />
              <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>Delete</Button>
            </div>
            {item.type === 'multiselect' && (
              <MultiSelectOptionsEditor
                options={item.options ?? []}
                onChange={(opts) => updItem(item.id, { options: opts })}
              />
            )}
          </div>
        )}
      />
    </>
  );
}

function MultiSelectOptionsEditor({
  options,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  onChange: (next: Array<{ id: string; label: string }>) => void;
}) {
  function add() {
    onChange([...options, { id: uid('opt'), label: 'New option' }]);
  }
  function upd(oid: string, label: string) {
    onChange(options.map((o) => (o.id === oid ? { ...o, label } : o)));
  }
  function remove(oid: string) {
    onChange(options.filter((o) => o.id !== oid));
  }
  return (
    <div className="ml-6 pl-3 border-l-2 border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Options</span>
        <Button size="sm" variant="secondary" onClick={add}>+ Add</Button>
      </div>
      {options.map((o) => (
        <div key={o.id} className="flex gap-2 items-center">
          <Input value={o.label} onChange={(e) => upd(o.id, e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => remove(o.id)}>×</Button>
        </div>
      ))}
      {options.length === 0 && <div className="text-xs text-slate-400">No options yet.</div>}
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
