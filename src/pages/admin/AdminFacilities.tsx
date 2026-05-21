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
  const has = useAppStore((s) => s.healthAuthorities);

  const [q, setQ] = useState('');

  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  function add() {
    const f: Facility = {
      id: uid('f'),
      name: 'New facility',
      abbreviation: '',
      code: '',
      healthAuthorityId: '',
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
      abbreviation: f.abbreviation,
      code: f.code,
      healthAuthorityId: f.healthAuthorityId,
      healthAuthorityName: haName(f.healthAuthorityId),
      onSiteServiceIds: f.onSiteServiceIds.join('|'),
    }));
    downloadCsv('facilities.csv', toCsv(rows));
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = fromCsv(String(reader.result ?? ''));
      if (rows.length === 0) {
        window.alert('Couldn\'t parse any rows from that CSV.');
        return;
      }
      // Headers we recognize
      const expected = ['name', 'abbreviation', 'code', 'healthAuthorityName', 'healthAuthorityId', 'onSiteServiceIds', 'id'];
      const headers = Object.keys(rows[0]);
      const recognized = headers.filter((h) => expected.includes(h));
      if (recognized.length === 0) {
        window.alert(
          `Couldn't find any expected columns in this CSV.\n\n` +
          `Found columns: ${headers.join(', ')}\n\n` +
          `Expected at least one of: ${expected.join(', ')}\n\n` +
          `Tip: click "Export CSV" first to get a template with the right headers.`
        );
        return;
      }
      const byId = new Map(facilities.map((f) => [f.id, f] as const));
      const haByName = new Map(has.map((h) => [h.name.toLowerCase(), h] as const));
      let skipped = 0;
      let added = 0;
      let updated = 0;
      for (const r of rows) {
        const name = (r.name ?? '').trim();
        if (!name) { skipped++; continue; }
        const id = r.id || uid('f');
        const cur = byId.get(id);
        // Resolve HA: prefer explicit id, then look up by name.
        let haId = r.healthAuthorityId ?? cur?.healthAuthorityId ?? '';
        if (!haId && r.healthAuthorityName) {
          haId = haByName.get(r.healthAuthorityName.toLowerCase())?.id ?? '';
        }
        const next: Facility = {
          id,
          name,
          abbreviation: r.abbreviation ?? cur?.abbreviation ?? '',
          code: r.code ?? cur?.code ?? '',
          healthAuthorityId: haId,
          onSiteServiceIds: (r.onSiteServiceIds ?? '').split('|').map((s) => s.trim()).filter(Boolean),
          referralPatterns: cur?.referralPatterns ?? {},
          notificationRequirements: cur?.notificationRequirements ?? [],
          serviceNotifs: cur?.serviceNotifs ?? {},
        };
        if (cur) updated++; else added++;
        byId.set(id, next);
      }
      setFacilities(Array.from(byId.values()));
      window.alert(
        `Import complete.\n\n` +
        `Added: ${added}\nUpdated: ${updated}\nSkipped (no name): ${skipped}`
      );
    };
    reader.readAsText(file);
  }

  const filtered = facilities.filter((f) => {
    if (!q.trim()) return true;
    const ql = q.toLowerCase();
    return (
      f.name.toLowerCase().includes(ql) ||
      haName(f.healthAuthorityId).toLowerCase().includes(ql)
    );
  });

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
                  {haName(f.healthAuthorityId) || '—'} ·{' '}
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
