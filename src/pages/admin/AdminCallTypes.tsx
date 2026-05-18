import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { uid } from '../../utils/id';
import type { CallType } from '../../types';

export function AdminCallTypesPage() {
  const callTypes = useAppStore((s) => s.callTypes);
  const setCallTypes = useAppStore((s) => s.setCallTypes);
  const workflows = useAppStore((s) => s.workflows);
  const services = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);

  // Where is each call type used?
  const usage = useMemo(() => {
    const m = new Map<string, { workflows: string[]; serviceTemplates: string[]; taCards: string[]; notifReqs: number }>();
    for (const ct of callTypes) m.set(ct.id, { workflows: [], serviceTemplates: [], taCards: [], notifReqs: 0 });
    for (const w of workflows) {
      const u = m.get(w.callTypeId);
      if (u) u.workflows.push(w.name);
    }
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
  }, [callTypes, workflows, services, facilities]);

  function add() {
    setCallTypes([...callTypes, { id: uid('ct'), name: 'New call type', subVersions: [] }]);
  }
  function rename(id: string, name: string) {
    setCallTypes(callTypes.map((c) => (c.id === id ? { ...c, name } : c)));
  }
  function remove(ct: CallType) {
    const u = usage.get(ct.id);
    const refs: string[] = [];
    if (u?.workflows.length) refs.push(`workflow(s): ${u.workflows.join(', ')}`);
    if (u?.serviceTemplates.length) refs.push(`service template(s): ${u.serviceTemplates.join(', ')}`);
    if (u?.taCards.length) refs.push(`Transport Advisor card(s) on: ${u.taCards.join(', ')}`);
    if ((u?.notifReqs ?? 0) > 0) refs.push(`${u?.notifReqs} facility notification requirement(s)`);
    if (refs.length) {
      window.alert(`Cannot delete "${ct.name}" — still used by:\n• ${refs.join('\n• ')}`);
      return;
    }
    if (!window.confirm(`Delete call type "${ct.name}"?`)) return;
    setCallTypes(callTypes.filter((c) => c.id !== ct.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Call Types</h1>
          <p className="text-sm text-slate-500">
            E.g. High Acuity, Advice, Repate, Scheduled, Discharge. Each workflow picks one.
            A call type may declare sub-versions (e.g. High Acuity has LLTO and HLOC) which
            service templates and overrides can store separately.
          </p>
        </div>
        <Button onClick={add}>+ Add</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {callTypes.map((ct) => {
            const u = usage.get(ct.id);
            const total = (u?.workflows.length ?? 0) + (u?.serviceTemplates.length ?? 0) + (u?.taCards.length ?? 0) + (u?.notifReqs ?? 0);
            function patchCt(p: Partial<CallType>) {
              setCallTypes(callTypes.map((c) => (c.id === ct.id ? { ...c, ...p } : c)));
            }
            function addSv() {
              patchCt({ subVersions: [...ct.subVersions, { id: uid('sv'), name: 'New sub-version' }] });
            }
            function updSv(svId: string, name: string) {
              patchCt({
                subVersions: ct.subVersions.map((s) => (s.id === svId ? { ...s, name } : s)),
              });
            }
            function removeSv(svId: string) {
              if (!window.confirm(`Remove sub-version? Service template content saved under this sub-version will become orphaned.`)) return;
              patchCt({ subVersions: ct.subVersions.filter((s) => s.id !== svId) });
            }
            return (
              <div key={ct.id} className="py-3 space-y-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <Input value={ct.name} onChange={(e) => rename(ct.id, e.target.value)} />
                  <div className="text-xs text-slate-500">
                    {total === 0 ? 'not in use' : `${u?.workflows.length ?? 0} wf · ${u?.serviceTemplates.length ?? 0} svc · ${u?.taCards.length ?? 0} TA · ${u?.notifReqs ?? 0} notif`}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(ct)}>Delete</Button>
                </div>
                <div className="ml-4 pl-3 border-l-2 border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Sub-versions ({ct.subVersions.length}):{' '}
                      {ct.subVersions.length === 0 ? <em>none</em> : ct.subVersions.map((s) => s.name).join(', ')}
                    </span>
                    <Button size="sm" variant="secondary" onClick={addSv}>+ Add sub-version</Button>
                  </div>
                  {ct.subVersions.map((sv) => (
                    <div key={sv.id} className="flex gap-2 items-center">
                      <Input value={sv.name} onChange={(e) => updSv(sv.id, e.target.value)} />
                      <Button size="sm" variant="ghost" onClick={() => removeSv(sv.id)}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {callTypes.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">No call types yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
