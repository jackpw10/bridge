import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Combobox } from '../components/ui/Combobox';
import { TriageTabs } from '../components/triage/TriageTabs';
import type { InitialCallQuestion } from '../types';

// Two-step "New Case" flow:
//   1. Initial Call Questions (collected before a call type is chosen).
//      If none are configured, this step is skipped.
//   2. Call-type picker → Start Case.
export function TriageStartPage() {
  const workflows = useAppStore((s) => s.workflows);
  const callTypes = useAppStore((s) => s.callTypes);
  const initialQs = useAppStore((s) => s.initialCallQuestions);
  const startCase = useTriageStore((s) => s.startCase);
  const nav = useNavigate();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'initial' | 'callType'>(
    initialQs.length > 0 ? 'initial' : 'callType',
  );
  const [picked, setPicked] = useState('');

  // If the initial-questions list changes while the picker is open (e.g.
  // realtime), and there are now unanswered ones, bounce back to step 1.
  useEffect(() => {
    if (step === 'callType' && initialQs.some((q) => !answers[q.id]?.trim())) {
      setStep('initial');
    }
  }, [initialQs, answers, step]);

  const ctById = useMemo(() => new Map(callTypes.map((c) => [c.id, c])), [callTypes]);
  const visibleWorkflows = useMemo(
    () => workflows.filter((w) => ctById.has(w.callTypeId)),
    [workflows, ctById],
  );

  useEffect(() => {
    if (!picked && visibleWorkflows.length > 0) setPicked(visibleWorkflows[0].id);
  }, [visibleWorkflows, picked]);

  const allInitialAnswered = initialQs.every((q) => (answers[q.id] ?? '').trim());

  function setAnswer(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: v }));
  }

  function start() {
    if (!picked) return;
    startCase(picked, answers);
    nav('/triage/run');
  }

  return (
    <div className="space-y-4">
      <TriageTabs />
      <div className="max-w-xl mx-auto mt-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Start a New Case</h1>
          <p className="text-sm text-slate-500">
            {step === 'initial'
              ? 'Answer the initial call questions, then pick the call type.'
              : 'Pick the call type for this case, then click Start Case. Each case you start opens its own tab.'}
          </p>
        </div>

        {step === 'initial' ? (
          <>
            <Card
              title="Initial Call Questions"
              description="Captured for every case regardless of call type."
            >
              <div className="space-y-4">
                {initialQs.map((q) => (
                  <InitialQuestionRow
                    key={q.id}
                    q={q}
                    value={answers[q.id] ?? ''}
                    onChange={(v) => setAnswer(q.id, v)}
                  />
                ))}
              </div>
            </Card>
            <div className="flex justify-end">
              <Button onClick={() => setStep('callType')} disabled={!allInitialAnswered}>
                Next — pick call type →
              </Button>
            </div>
          </>
        ) : visibleWorkflows.length === 0 ? (
          <Card>
            <div className="text-sm text-slate-500">
              No call types configured yet. Ask an admin to set one up in Admin → Call Types.
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="space-y-4">
                <Select
                  label="Call Type"
                  autoFocus
                  value={picked}
                  onChange={(e) => setPicked(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      start();
                    }
                  }}
                >
                  {visibleWorkflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {ctById.get(w.callTypeId)?.name ?? w.name}
                    </option>
                  ))}
                </Select>
                <Button onClick={start} className="w-full" size="lg" disabled={!picked}>
                  Start Case
                </Button>
              </div>
            </Card>
            {initialQs.length > 0 && (
              <div className="flex justify-start">
                <Button size="sm" variant="ghost" onClick={() => setStep('initial')}>
                  ← Back to initial questions
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InitialQuestionRow({
  q,
  value,
  onChange,
}: {
  q: InitialCallQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-1">{q.text}</div>
      {q.type === 'yesno' && (
        <div className="flex gap-2">
          {(
            [
              { value: 'Yes', label: '(Y)es' },
              { value: 'No', label: '(N)o' },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.value}
              variant={value === opt.value ? 'primary' : 'secondary'}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}
      {q.type === 'dropdown' && (
        <Combobox
          numbered
          value={value}
          options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
          placeholder="Type to filter…"
          onChange={onChange}
        />
      )}
      {q.type === 'text' && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type here…"
        />
      )}
      {q.type !== 'yesno' && q.type !== 'dropdown' && q.type !== 'text' && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
