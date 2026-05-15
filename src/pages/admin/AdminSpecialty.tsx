import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { uid } from '../../utils/id';
import type { SpecialtyService } from '../../types';
import { downloadCsv, fromCsv, toCsv } from '../../utils/csv';

export function AdminSpecialtyPage() {
  const services = useAppStore((s) => s.specialty);
  const setServices = useAppStore((s) => s.setSpecialty);

  function add() {
    const s: SpecialtyService = {
      id: uid('svc'),
      name: 'New service',
      template: {
        llto: { preQuestions: [], exceptionSteps: [] },
        hloc: { preQuestions: [], exceptionSteps: [] },
      },
      transportAdvisor: { enabled: false, cardsByHA: {} },
    };
    setServices([...services, s]);
  }

  function remove(id: string) {
    if (!window.confirm('Delete this service? Existing facility overrides will keep dangling references.')) return;
    setServices(services.filter((s) => s.id !== id));
  }

  function exportCsv() {
    downloadCsv('specialty.csv', toCsv(services.map((s) => ({ id: s.id, name: s.name }))));
  }
  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = fromCsv(String(reader.result ?? ''));
      const byId = new Map(services.map((s) => [s.id, s] as const));
      for (const r of rows) {
        const id = r.id || uid('svc');
        const cur = byId.get(id);
        byId.set(id, cur
          ? { ...cur, name: r.name ?? cur.name }
          : {
              id,
              name: r.name ?? '',
              template: { llto: { preQuestions: [], exceptionSteps: [] }, hloc: { preQuestions: [], exceptionSteps: [] } },
              transportAdvisor: { enabled: false, cardsByHA: {} },
            }
        );
      }
      setServices(Array.from(byId.values()));
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Specialty services</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <label className="inline-flex">
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ''; }} />
            <span className="inline-flex items-center justify-center font-medium text-sm px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer">Import CSV</span>
          </label>
          <Button onClick={add}>+ New service</Button>
        </div>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {services.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <Link to={`/admin/specialty/${s.id}`} className="font-medium text-slate-800 hover:underline">{s.name}</Link>
                <div className="text-xs text-slate-500">
                  LLTO: {s.template.llto.preQuestions.length}q / {s.template.llto.exceptionSteps.length}s ·{' '}
                  HLOC: {s.template.hloc.preQuestions.length}q / {s.template.hloc.exceptionSteps.length}s
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/specialty/${s.id}`}>
                  <Button size="sm" variant="secondary">Edit</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">No services.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
