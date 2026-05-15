import type { WorkflowQuestion } from '../../types';
import { useAppStore } from '../../store/appStore';
import { Input, Select, Textarea } from '../ui/Input';
import { Combobox } from '../ui/Combobox';
import { MultiSelect } from '../ui/MultiSelect';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface Props {
  question: WorkflowQuestion;
  answers: Record<string, string>;
  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
}

export function QuestionRenderer({ question, answers, setAnswer }: Props) {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const diagnoses = useAppStore((s) => s.diagnoses);
  const reasons = useAppStore((s) => s.reasons);

  const value = answers[question.id] ?? '';

  if (question.type === 'yesno' || question.type === 'triage') {
    return (
      <div className="flex gap-2">
        {['Yes', 'No'].map((opt) => (
          <Button
            key={opt}
            variant={value === opt ? 'primary' : 'secondary'}
            onClick={() => setAnswer(question.id, opt)}
          >
            {opt}
          </Button>
        ))}
        {question.type === 'triage' && (
          <span className="text-xs text-slate-500 self-center ml-2">
            Yes → LLTO · No → HLOC
          </span>
        )}
      </div>
    );
  }

  if (question.type === 'dropdown') {
    return (
      <Select value={value} onChange={(e) => setAnswer(question.id, e.target.value)}>
        <option value="">— select —</option>
        {(question.options ?? []).map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  }

  if (question.type === 'text') {
    return (
      <Textarea
        value={value}
        onChange={(e) => setAnswer(question.id, e.target.value)}
        placeholder="Type here…"
      />
    );
  }

  if (question.type === 'facility') {
    const opts = facilities.map((f) => ({ value: f.id, label: f.name, meta: f.healthAuthority }));
    const facId = answers[`${question.id}__facid`] ?? '';
    return (
      <Combobox
        options={opts}
        value={facId}
        onChange={(v) => {
          const lbl = facilities.find((f) => f.id === v)?.name ?? '';
          setAnswer(question.id, lbl, { facid: v });
        }}
        placeholder="Search facilities…"
      />
    );
  }

  if (question.type === 'specialty_multi') {
    const opts = specialty.map((s) => ({ value: s.id, label: s.name }));
    const svcs: string[] = (() => {
      const raw = answers[`${question.id}__svcs`];
      try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
    })();
    return (
      <MultiSelect
        options={opts}
        value={svcs}
        onChange={(v) => {
          const lbl = v
            .map((id) => specialty.find((s) => s.id === id)?.name ?? id)
            .join(', ');
          setAnswer(question.id, lbl, { svcs: JSON.stringify(v) });
        }}
      />
    );
  }

  if (question.type === 'diagnosis_multi') {
    const opts = diagnoses.map((d) => ({ value: d.id, label: d.text }));
    const dxs: string[] = (() => {
      const raw = answers[`${question.id}__dxs`];
      try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
    })();
    return (
      <MultiSelect
        options={opts}
        value={dxs}
        onChange={(v) => {
          const lbl = v.map((id) => diagnoses.find((d) => d.id === id)?.text ?? id).join(', ');
          setAnswer(question.id, lbl, { dxs: JSON.stringify(v) });
        }}
      />
    );
  }

  if (question.type === 'referral_resolve') {
    // Find the most recent facility + specialty answers from the answers map.
    const facAnsKey = Object.keys(answers).find((k) => k.endsWith('__facid'));
    const facId = facAnsKey ? answers[facAnsKey] : '';
    const fac = facilities.find((f) => f.id === facId) ?? null;
    const svcKey = Object.keys(answers).find((k) => k.endsWith('__svcs'));
    let svcIds: string[] = [];
    try {
      svcIds = svcKey ? (JSON.parse(answers[svcKey]) as string[]) : [];
    } catch {
      svcIds = [];
    }
    const primarySvcId = svcIds[0];
    const pattern = fac && primarySvcId ? fac.referralPatterns[primarySvcId] : undefined;

    const choice = answers[`${question.id}__choice`] ?? '';
    const customId = answers[`${question.id}__customfacid`] ?? '';
    const reasonId = answers[`${question.id}__reasonid`] ?? '';

    const onChooseDefault = (destId: string, idx: number) => {
      const destName = facilities.find((f) => f.id === destId)?.name ?? '';
      setAnswer(question.id, `Default destination ${idx + 1}: ${destName}`, {
        choice: destId,
        customfacid: '',
        reasonid: '',
      });
    };

    const filteredCandidates = primarySvcId
      ? facilities
          .filter((f) => f.id !== facId && f.onSiteServiceIds.includes(primarySvcId))
          .map((f) => ({ value: f.id, label: f.name, meta: f.healthAuthority }))
      : facilities.map((f) => ({ value: f.id, label: f.name, meta: f.healthAuthority }));

    return (
      <div className="space-y-3">
        {!pattern && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            No referral pattern defined for this sending facility / primary service. Choose a destination manually.
          </div>
        )}
        {pattern && (
          <div className="flex flex-col gap-2">
            {(['d1','d2','d3'] as const).map((k, idx) => {
              const destId = pattern[k];
              if (!destId) return null;
              const destName = facilities.find((f) => f.id === destId)?.name ?? '—';
              const isChosen = choice === destId;
              return (
                <Button
                  key={k}
                  variant={isChosen ? 'primary' : 'secondary'}
                  onClick={() => onChooseDefault(destId, idx)}
                >
                  Use destination {idx + 1}: {destName}
                </Button>
              );
            })}
          </div>
        )}

        <div className="border-t pt-3 space-y-2">
          <Button
            variant={choice === '__custom__' ? 'primary' : 'secondary'}
            onClick={() => {
              setAnswer(question.id, 'Custom destination', {
                choice: '__custom__',
                customfacid: customId,
                reasonid: reasonId,
              });
            }}
          >
            Override / choose another facility
          </Button>
          {choice === '__custom__' && (
            <div className="space-y-2">
              <Combobox
                label="Custom destination"
                options={filteredCandidates}
                value={customId}
                onChange={(v) => {
                  const destName = facilities.find((f) => f.id === v)?.name ?? '';
                  setAnswer(question.id, `Custom: ${destName}`, {
                    choice: '__custom__',
                    customfacid: v,
                    reasonid: reasonId,
                  });
                }}
              />
              <Select
                label="Reason for override"
                value={reasonId}
                onChange={(e) => {
                  setAnswer(question.id, `Custom (override)`, {
                    choice: '__custom__',
                    customfacid: customId,
                    reasonid: e.target.value,
                  });
                }}
              >
                <option value="">— pick a reason —</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.text}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
        {value && <Badge tone="blue">{value}</Badge>}
      </div>
    );
  }

  return <Input value={value} onChange={(e) => setAnswer(question.id, e.target.value)} />;
}
