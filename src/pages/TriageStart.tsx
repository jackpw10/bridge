import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useTriageStore } from '../store/triageStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Combobox } from '../components/ui/Combobox';
import { NotesLog } from '../components/ui/NotesLog';
import { TriageTabs } from '../components/triage/TriageTabs';
import type { InitialCallQuestion } from '../types';

// Three-step "New Case" flow:
//   1. idle          — big Start Case button, nothing else.
//   2. answering     — initial call questions on the left, right column has
//                      Instructions (based on the first-unanswered question)
//                      and the Additional Information note log.
//   3. pickCallType  — call-type picker + final Begin triage button.
type Phase = 'idle' | 'answering' | 'pickCallType';

export function TriageStartPage() {
  const workflows = useAppStore((s) => s.workflows);
  const callTypes = useAppStore((s) => s.callTypes);
  const initialQs = useAppStore((s) => s.initialCallQuestions);
  const startCase = useTriageStore((s) => s.startCase);
  const nav = useNavigate();

  const [phase, setPhase] = useState<Phase>('idle');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>('');
  const [picked, setPicked] = useState('');

  const ctById = useMemo(() => new Map(callTypes.map((c) => [c.id, c])), [callTypes]);
  const visibleWorkflows = useMemo(
    () => workflows.filter((w) => ctById.has(w.callTypeId)),
    [workflows, ctById],
  );

  useEffect(() => {
    if (!picked && visibleWorkflows.length > 0) setPicked(visibleWorkflows[0].id);
  }, [visibleWorkflows, picked]);

  const firstUnanswered = initialQs.find((q) => !(answers[q.id] ?? '').trim());
  const activeInstructions =
    firstUnanswered?.instructions ??
    (initialQs.length > 0
      ? initialQs[initialQs.length - 1].instructions
      : undefined);
  const allInitialAnswered = initialQs.every((q) => (answers[q.id] ?? '').trim());

  function setAnswer(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: v }));
  }

  function begin() {
    if (initialQs.length === 0) {
      // No questions configured — jump straight to the call-type picker but
      // still show the notes column so the caller can log context.
      setPhase('pickCallType');
    } else {
      setPhase('answering');
    }
  }

  function start() {
    if (!picked) return;
    const wf = workflows.find((w) => w.id === picked);
    const ct = wf ? ctById.get(wf.callTypeId) : undefined;
    startCase(
      picked,
      wf?.name ?? '',
      wf?.callTypeId ?? '',
      ct?.name ?? '',
      answers,
      notes,
    );
    // Immediately after startCase the new case is active, so any additional
    // logging (e.g. per-answer summaries) can go through logAction. We seed
    // per-initial-answer events here so the audit trail includes each one
    // with its own timestamp.
    const store = useTriageStore.getState();
    for (const q of initialQs) {
      const a = (answers[q.id] ?? '').trim();
      if (!a) continue;
      store.logAction('initial_answer', `${q.text} → ${a}`, { qid: q.id, answer: a });
    }
    nav('/triage/run');
  }

  // -------- phase: idle --------
  if (phase === 'idle') {
    return (
      <div className="space-y-4">
        <TriageTabs />
        <div className="max-w-xl mx-auto mt-16 space-y-4 text-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Start a New Case</h1>
            <p className="text-sm text-slate-500 mt-1">
              Click the button below to open the case and start capturing information.
            </p>
          </div>
          <Button size="lg" className="w-full py-6 text-lg" onClick={begin}>
            Start Case
          </Button>
        </div>
      </div>
    );
  }

  // -------- phase: answering or pickCallType (both use the two-column layout) --------
  return (
    <div className="space-y-4">
      <TriageTabs />

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Start a New Case</h1>
        <p className="text-sm text-slate-500">
          {phase === 'answering'
            ? 'Answer the initial call questions. Notes can be logged on the right at any time.'
            : 'Pick the call type for this case, then click Begin triage.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: initial questions OR call-type picker */}
        <div className="lg:col-span-2 space-y-4">
          {phase === 'answering' ? (
            <>
              <Card
                title="Initial Call Questions"
                description="Captured for every case regardless of call type."
              >
                <div className="space-y-4">
                  {initialQs.map((q, i) => {
                    const activeIdx = firstUnanswered
                      ? initialQs.findIndex((x) => x.id === firstUnanswered.id)
                      : initialQs.length; // all answered
                    const active = firstUnanswered?.id === q.id;
                    const locked = i > activeIdx; // future questions disabled
                    return (
                      <InitialQuestionRow
                        key={q.id}
                        q={q}
                        active={active}
                        disabled={locked}
                        value={answers[q.id] ?? ''}
                        onChange={(v) => setAnswer(q.id, v)}
                      />
                    );
                  })}
                </div>
              </Card>
              <div className="flex justify-end">
                <Button
                  onClick={() => setPhase('pickCallType')}
                  disabled={!allInitialAnswered}
                >
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
              <Card title="Call type">
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
                  <Button
                    onClick={start}
                    className="w-full"
                    size="lg"
                    disabled={!picked}
                  >
                    Begin triage
                  </Button>
                </div>
              </Card>
              {initialQs.length > 0 && (
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPhase('answering')}
                  >
                    ← Back to initial questions
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: instructions + notes log */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Instructions">
            {activeInstructions ? (
              <p className="text-sm whitespace-pre-wrap text-slate-700">
                {activeInstructions}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                {phase === 'answering' && firstUnanswered
                  ? 'No instructions configured for this question.'
                  : 'No instructions to show right now.'}
              </p>
            )}
          </Card>
          <Card
            title="Additional Information"
            description="Enter to save a timestamped note."
          >
            <NotesLog value={notes} onChange={setNotes} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function InitialQuestionRow({
  q,
  value,
  onChange,
  active,
  disabled,
}: {
  q: InitialCallQuestion;
  value: string;
  onChange: (v: string) => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={
        active
          ? 'ring-2 ring-brand-400 rounded-md p-2 -m-2'
          : disabled
            ? 'opacity-40 pointer-events-none select-none'
            : ''
      }
      aria-disabled={disabled || undefined}
    >
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
              disabled={disabled}
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
          disabled={disabled}
        />
      )}
      {q.type === 'text' && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type here…"
          disabled={disabled}
        />
      )}
      {q.type !== 'yesno' && q.type !== 'dropdown' && q.type !== 'text' && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
