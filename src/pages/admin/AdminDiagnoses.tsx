import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import type { Diagnosis } from '../../types';
import { uid } from '../../utils/id';
import { downloadCsv, fromCsv, toCsv } from '../../utils/csv';

export function AdminDiagnosesPage() {
  const diagnoses = useAppStore((s) => s.diagnoses);
  const setDiagnoses = useAppStore((s) => s.setDiagnoses);

  function add() {
    const dx: Diagnosis = { id: uid('dx'), text: 'New diagnosis', notifEnabled: false, notifMessage: '' };
    setDiagnoses([...diagnoses, dx]);
  }

  function patch(id: string, p: Partial<Diagnosis>) {
    setDiagnoses(diagnoses.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }
  function remove(id: string) {
    if (!window.confirm('Delete this diagnosis?')) return;
    setDiagnoses(diagnoses.filter((d) => d.id !== id));
  }

  function exportCsv() {
    downloadCsv('diagnoses.csv', toCsv(diagnoses.map((d) => ({ id: d.id, text: d.text, notifEnabled: d.notifEnabled ? 'true' : 'false', notifMessage: d.notifMessage }))));
  }
  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = fromCsv(String(reader.result ?? ''));
      const byId = new Map(diagnoses.map((d) => [d.id, d] as const));
      for (const r of rows) {
        const id = r.id || uid('dx');
        const cur = byId.get(id);
        byId.set(id, {
          id,
          text: r.text ?? cur?.text ?? '',
          notifEnabled: (r.notifEnabled ?? '').toLowerCase() === 'true' || cur?.notifEnabled === true,
          notifMessage: r.notifMessage ?? cur?.notifMessage ?? '',
        });
      }
      setDiagnoses(Array.from(byId.values()));
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Diagnoses</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <label className="inline-flex">
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ''; }} />
            <span className="inline-flex items-center justify-center font-medium text-sm px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer">Import CSV</span>
          </label>
          <Button onClick={add}>+ New diagnosis</Button>
        </div>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {diagnoses.map((d) => (
            <div key={d.id} className="py-3 grid grid-cols-1 md:grid-cols-[2fr_auto_3fr_auto] gap-3 items-start">
              <Input value={d.text} onChange={(e) => patch(d.id, { text: e.target.value })} />
              <Toggle checked={d.notifEnabled} onChange={(v) => patch(d.id, { notifEnabled: v })} label="Notify" />
              <Textarea
                placeholder="Notification message"
                value={d.notifMessage}
                onChange={(e) => patch(d.id, { notifMessage: e.target.value })}
                disabled={!d.notifEnabled}
              />
              <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>Delete</Button>
            </div>
          ))}
          {diagnoses.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No diagnoses.</div>}
        </div>
      </Card>
    </div>
  );
}
