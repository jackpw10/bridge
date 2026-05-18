import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { uid } from '../../utils/id';
import type { PostTriageConfig, Workflow } from '../../types';

function summarizePostTriage(p: PostTriageConfig): string {
  if (p.mode === 'none') return 'off';
  if (p.mode === 'questions') return `${p.questions.length} Q`;
  return `transport reqs (${p.items.length} items)`;
}

export function AdminWorkflowPage() {
  const workflows = useAppStore((s) => s.workflows);
  const setWorkflows = useAppStore((s) => s.setWorkflows);
  const callTypes = useAppStore((s) => s.callTypes);

  function add() {
    const firstCallType = callTypes[0]?.id ?? '';
    const next: Workflow = {
      id: uid('wf'),
      name: 'New workflow',
      callTypeId: firstCallType,
      subVersionRules: {},
      questions: [],
      postTriage: { mode: 'none' },
      processSteps: {},
    };
    setWorkflows([...workflows, next]);
  }

  function remove(id: string) {
    if (!window.confirm('Delete this workflow?')) return;
    setWorkflows(workflows.filter((w) => w.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Triage workflows</h1>
          <p className="text-sm text-slate-500">
            Each workflow defines its own question list, post-triage cards, and process steps.
          </p>
        </div>
        <Button onClick={add}>+ New workflow</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {workflows.map((w) => (
            <div key={w.id} className="py-3 flex items-center justify-between">
              <div>
                <Link
                  to={`/admin/workflow/${w.id}`}
                  className="font-medium text-slate-800 hover:underline"
                >
                  {w.name}
                </Link>
                <div className="text-xs text-slate-500">
                  {w.questions.length} question{w.questions.length === 1 ? '' : 's'} ·{' '}
                  post-triage: {summarizePostTriage(w.postTriage)} ·{' '}
                  call type: {callTypes.find((c) => c.id === w.callTypeId)?.name ?? '—'}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/workflow/${w.id}`}>
                  <Button size="sm" variant="secondary">Edit</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => remove(w.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {workflows.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">No workflows yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
