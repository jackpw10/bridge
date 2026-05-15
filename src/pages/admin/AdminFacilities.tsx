import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { uid } from '../../utils/id';
import type { Facility } from '../../types';
import { downloadCsv, fromCsv, toCsv } from '../../utils/csv';

export function AdminFacilitiesPage() {
  const facilities = useAppStore((s) => s.facilities);
  const setFacilities = useAppStore((s) => s.setFacilities);
  const services = useAppStore((s) => s.specialty);

  const [q, setQ] = useState('');

  function add() {
    const f: Facility = {
      id: uid('f'),
      name: 'New facility',
      healthAuthority: '',
      onSiteServiceIds: [],
      referralPatterns: {},
      notificationRequirements: [],
      serviceNotifs: {},
    };
    setFacilities([...facilities, f]);
  }

  function remove(id: string) {
    if (!window.confirm('Delete this facility?')) return;
    setFacilities(facilities.filter((f) => f.id !== id));
  }

  function exportCsv() {
    const rows = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      healthAuthority: f.healthAuthority,
      onSiteServiceIds: f.onSiteServiceIds.join('|'),
    }));
    downloadCsv('facilities.csv', toCsv(rows));
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = fromCsv(String(reader.result ?? ''));
      const byId = new Map(facilities.map((f) => [f.id, f] as const));
      for (const r of rows) {
        const id = r.id || uid('f');
        const cur = byId.get(id);
        const next: Facility = {
          id,
          name: r.name ?? cur?.name ?? '',
          healthAuthority: r.healthAuthority ?? cur?.healthAuthority ?? '',
          onSiteServiceIds: (r.onSiteServiceIds ?? '').split('|').filter(Boolean),
          referralPatterns: cur?.referralPatterns ?? {},
          notificationRequirements: cur?.notificationRequirements ?? [],
          serviceNotifs: cur?.serviceNotifs ?? {},
        };
        byId.set(id, next);
      }
      setFacilities(Array.from(byId.values()));
    };
    reader.readAsText(file);
  }

  const filtered = facilities.filter((f) =>
    !q.trim() ||
    f.name.toLowerCase().includes(q.toLowerCase()) ||
    f.healthAuthority.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Facilities</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.currentTarget.value = '';
              }}
            />
            <span className="inline-flex items-center justify-center font-medium text-sm px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer">
              Import CSV
            </span>
          </label>
          <Button onClick={add}>+ New facility</Button>
        </div>
      </div>

      <Card>
        <Input placeholder="Search facilities…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-4 divide-y divide-slate-100">
          {filtered.map((f) => (
            <div key={f.id} className="py-3 flex items-center justify-between">
              <div>
                <Link to={`/admin/facilities/${f.id}`} className="font-medium text-slate-800 hover:underline">
                  {f.name}
                </Link>
                <div className="text-xs text-slate-500">
                  {f.healthAuthority || '—'} ·{' '}
                  {f.onSiteServiceIds.length === 0
                    ? 'no on-site services'
                    : f.onSiteServiceIds
                        .map((id) => services.find((s) => s.id === id)?.name ?? id)
                        .join(', ')}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/facilities/${f.id}`}>
                  <Button size="sm" variant="secondary">Edit</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">No facilities.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
