import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
import { DragList } from '../../components/ui/DragList';
import { downloadCsv, fromCsv, toCsv } from '../../utils/csv';
import type { ProcessStep, ProcessSteps, PsKey } from '../../types';
import { uid } from '../../utils/id';

const VERSIONS: { key: PsKey; label: string }[] = [
  { key: 'lltoNo', label: 'LLTO Standard' },
  { key: 'lltoYes', label: 'LLTO Outside PTN' },
  { key: 'hlocNo', label: 'HLOC Standard' },
  { key: 'hlocYes', label: 'HLOC Outside PTN' },
];

export function AdminProcessStepsPage() {
  const ps = useAppStore((s) => s.processSteps);
  const setPs = useAppStore((s) => s.setProcessSteps);
  const [tab, setTab] = useState<PsKey>('lltoNo');

  function add() {
    const step: ProcessStep = { id: uid('ps'), text: 'New step' };
    setPs({ ...ps, [tab]: [...ps[tab], step] });
  }
  function upd(id: string, text: string) {
    setPs({ ...ps, [tab]: ps[tab].map((s) => (s.id === id ? { ...s, text } : s)) });
  }
  function remove(id: string) {
    setPs({ ...ps, [tab]: ps[tab].filter((s) => s.id !== id) });
  }
  function reorder(next: ProcessStep[]) {
    setPs({ ...ps, [tab]: next });
  }

  function exportCsv() {
    const rows: Array<{ Version: string; Step: string }> = [];
    for (const v of VERSIONS) {
      for (const s of ps[v.key]) rows.push({ Version: v.label, Step: s.text });
    }
    downloadCsv('process-steps.csv', toCsv(rows));
  }
  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = fromCsv(String(reader.result ?? ''));
      const next: ProcessSteps = { lltoNo: [], lltoYes: [], hlocNo: [], hlocYes: [] };
      const labelToKey = new Map(VERSIONS.map((v) => [v.label.toLowerCase(), v.key] as const));
      for (const r of rows) {
        const key = labelToKey.get((r.Version ?? '').toLowerCase());
        if (!key) continue;
        next[key].push({ id: uid('ps'), text: r.Step ?? '' });
      }
      setPs(next);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Generic process steps</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <label className="inline-flex">
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ''; }} />
            <span className="inline-flex items-center justify-center font-medium text-sm px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer">Import CSV</span>
          </label>
        </div>
      </div>

      <Card>
        <div className="flex gap-2 border-b border-slate-200 mb-4">
          {VERSIONS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setTab(v.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === v.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end mb-2">
          <Button size="sm" onClick={add}>+ Add step</Button>
        </div>
        <DragList
          items={ps[tab]}
          onReorder={reorder}
          renderItem={(s, handle) => (
            <div className="flex items-start gap-2 border rounded-md p-3 bg-white">
              {handle}
              <div className="flex-1">
                <Textarea value={s.text} onChange={(e) => upd(s.id, e.target.value)} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Delete</Button>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
