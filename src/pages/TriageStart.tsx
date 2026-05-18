import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';

export function TriageStartPage() {
  const workflows = useAppStore((s) => s.workflows);
  const startCase = useTriageStore((s) => s.startCase);
  const nav = useNavigate();

  const [picked, setPicked] = useState('');

  useEffect(() => {
    if (!picked && workflows.length > 0) setPicked(workflows[0].id);
  }, [workflows, picked]);

  function start() {
    if (!picked) return;
    startCase(picked);
    nav('/triage/run');
  }

  return (
    <div className="max-w-xl mx-auto mt-10 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Start a triage case</h1>
        <p className="text-sm text-slate-500">
          Pick the workflow that matches the call type, then click Start Case.
        </p>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-500">
            No workflows configured yet. Ask an admin to set one up in Admin → Triage workflow.
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <Select
              label="Workflow"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
            <Button onClick={start} className="w-full" size="lg" disabled={!picked}>
              Start Case
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
