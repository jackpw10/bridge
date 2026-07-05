import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { uid } from '../../utils/id';
import type { CallType, Workflow } from '../../types';

// Merged Call Types + Workflows admin. Each call type is paired 1:1 with a
// workflow that shares its name. The list page is where you create / rename /
// delete the pair. Click "Edit workflow" to jump into the workflow detail
// (questions, process steps).

export function AdminWorkflowPage() {
  const callTypes = useAppStore((s) => s.callTypes);
  const setCallTypes = useAppStore((s) => s.setCallTypes);
  const workflows = useAppStore((s) => s.workflows);
  const setWorkflows = useAppStore((s) => s.setWorkflows);
  const services = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);

  // For each call type, the paired workflow (if any) and where it's referenced.
  const workflowByCt = useMemo(() => {
    const m = new Map<string, Workflow>();
    for (const w of workflows) {
      if (!m.has(w.callTypeId)) m.set(w.callTypeId, w);
    }
    return m;
  }, [workflows]);

  const orphanWorkflows = useMemo(() => {
    const ctIds = new Set(callTypes.map((c) => c.id));
    return workflows.filter((w) => !ctIds.has(w.callTypeId));
  }, [workflows, callTypes]);

  async function deleteOrphanWorkflow(wfId: string) {
    if (!window.confirm('Delete this orphan config? It has no paired call type.')) return;
    await setWorkflows(workflows.filter((w) => w.id !== wfId));
  }

  const usage = useMemo(() => {
    const m = new Map<string, { serviceTemplates: string[]; taCards: string[]; notifReqs: number }>();
    for (const ct of callTypes) m.set(ct.id, { serviceTemplates: [], taCards: [], notifReqs: 0 });
    for (const s of services) {
      for (const ctId of Object.keys(s.templates)) {
        const u = m.get(ctId);
        if (u && !u.serviceTemplates.includes(s.name)) u.serviceTemplates.push(s.name);
      }
      for (const c of s.transportAdvisor.cards) {
        for (const ctId of c.callTypeIds) {
          const u = m.get(ctId);
          if (u && !u.taCards.includes(s.name)) u.taCards.push(s.name);
        }
      }
    }
    for (const f of facilities) {
      for (const nr of f.notificationRequirements) {
        for (const ctId of nr.callTypeIds) {
          const u = m.get(ctId);
          if (u) u.notifReqs++;
        }
      }
    }
    return m;
  }, [callTypes, services, facilities]);

  async function add() {
    const ctId = uid('ct');
    const wfId = uid('wf');
    const nextCt: CallType = { id: ctId, name: 'New call type', letter: '' };
    const nextWf: Workflow = {
      id: wfId,
      name: 'New call type',
      callTypeId: ctId,
      questions: [],
      processSteps: [],
    };
    await Promise.all([
      setCallTypes([...callTypes, nextCt]),
      setWorkflows([...workflows, nextWf]),
    ]);
  }

  async function renamePair(ctId: string, name: string) {
    const nextCts = callTypes.map((c) => (c.id === ctId ? { ...c, name } : c));
    const nextWfs = workflows.map((w) => (w.callTypeId === ctId ? { ...w, name } : w));
    await Promise.all([setCallTypes(nextCts), setWorkflows(nextWfs)]);
  }

  async function removePair(ct: CallType) {
    const u = usage.get(ct.id);
    const refs: string[] = [];
    if (u?.serviceTemplates.length) refs.push(`service template(s): ${u.serviceTemplates.join(', ')}`);
    if (u?.taCards.length) refs.push(`Transport Advisor card(s) on: ${u.taCards.join(', ')}`);
    if ((u?.notifReqs ?? 0) > 0) refs.push(`${u?.notifReqs} facility notification requirement(s)`);
    if (refs.length) {
      window.alert(`Cannot delete "${ct.name}" — still used by:\n• ${refs.join('\n• ')}`);
      return;
    }
    if (!window.confirm(`Delete call type "${ct.name}"?`)) return;
    await Promise.all([
      setCallTypes(callTypes.filter((c) => c.id !== ct.id)),
      setWorkflows(workflows.filter((w) => w.callTypeId !== ct.id)),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Call Types</h1>
          <p className="text-sm text-slate-500">
            One letter per call type, used in Process Card codes. Click
            "Edit" for triage questions and the Action Card.
          </p>
        </div>
        <Button onClick={add}>+ New call type</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {callTypes.map((ct) => {
            const wf = workflowByCt.get(ct.id);
            const u = usage.get(ct.id);
            function patchCt(p: Partial<CallType>) {
              setCallTypes(callTypes.map((c) => (c.id === ct.id ? { ...c, ...p } : c)));
            }
            return (
              <div key={ct.id} className="py-3">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
                  <Input value={ct.name} onChange={(e) => renamePair(ct.id, e.target.value)} />
                  <Input
                    className="w-16 text-center uppercase"
                    maxLength={1}
                    placeholder="A"
                    title="Code letter"
                    value={ct.letter}
                    onChange={(e) => patchCt({ letter: e.target.value.toUpperCase().slice(0, 1) })}
                  />
                  <div className="text-xs text-slate-500">
                    {u && (u.serviceTemplates.length + u.taCards.length + u.notifReqs > 0)
                      ? `${u.serviceTemplates.length} svc · ${u.taCards.length} TA · ${u.notifReqs} notif`
                      : 'not yet referenced'}
                  </div>
                  {wf ? (
                    <Link to={`/admin/workflow/${wf.id}`}>
                      <Button size="sm" variant="secondary">Edit →</Button>
                    </Link>
                  ) : (
                    <span className="text-xs text-amber-600">not configured</span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removePair(ct)}>Delete</Button>
                </div>
              </div>
            );
          })}
          {callTypes.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">No call types yet.</div>
          )}
        </div>
      </Card>

      {orphanWorkflows.length > 0 && (
        <Card
          title="Orphan call type configs"
          description="Configurations whose call type no longer exists. Delete them here to clean up."
        >
          <div className="divide-y divide-slate-100">
            {orphanWorkflows.map((w) => (
              <div key={w.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">{w.name}</div>
                  <div className="text-xs text-slate-400">missing call type: {w.callTypeId || '(none)'}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteOrphanWorkflow(w.id)}>Delete</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
