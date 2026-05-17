import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { uid } from '../../utils/id';
import type { HealthAuthority } from '../../types';

export function AdminHealthAuthoritiesPage() {
  const has = useAppStore((s) => s.healthAuthorities);
  const setHas = useAppStore((s) => s.setHealthAuthorities);
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);

  // For delete-guard: which HAs are in use by what?
  const usage = useMemo(() => {
    const m = new Map<string, { facilities: string[]; services: string[] }>();
    for (const ha of has) m.set(ha.id, { facilities: [], services: [] });
    for (const f of facilities) {
      const entry = m.get(f.healthAuthorityId);
      if (entry) entry.facilities.push(f.name);
    }
    for (const s of specialty) {
      for (const c of s.transportAdvisor.cards) {
        for (const haId of c.haIds) {
          const entry = m.get(haId);
          if (entry && !entry.services.includes(s.name)) entry.services.push(s.name);
        }
      }
    }
    return m;
  }, [has, facilities, specialty]);

  function add() {
    setHas([...has, { id: uid('ha'), name: 'New health authority' }]);
  }
  function rename(id: string, name: string) {
    setHas(has.map((h) => (h.id === id ? { ...h, name } : h)));
  }
  function remove(ha: HealthAuthority) {
    const u = usage.get(ha.id);
    const refs: string[] = [];
    if (u?.facilities.length) refs.push(`${u.facilities.length} facility/ies (${u.facilities.join(', ')})`);
    if (u?.services.length) refs.push(`Transport Advisor cards on ${u.services.length} service(s) (${u.services.join(', ')})`);
    if (refs.length) {
      window.alert(`Cannot delete "${ha.name}" — still used by:\n• ${refs.join('\n• ')}`);
      return;
    }
    if (!window.confirm(`Delete health authority "${ha.name}"?`)) return;
    setHas(has.filter((h) => h.id !== ha.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Health Authorities</h1>
        </div>
        <Button onClick={add}>+ Add</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {has.map((ha) => {
            const u = usage.get(ha.id);
            const inUse = (u?.facilities.length ?? 0) + (u?.services.length ?? 0) > 0;
            return (
              <div key={ha.id} className="py-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <Input value={ha.name} onChange={(e) => rename(ha.id, e.target.value)} />
                <div className="text-xs text-slate-500">
                  {inUse ? (
                    <>used by {u?.facilities.length ?? 0} fac · {u?.services.length ?? 0} svc</>
                  ) : (
                    <>not in use</>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(ha)}>Delete</Button>
              </div>
            );
          })}
          {has.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">
              No health authorities yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
