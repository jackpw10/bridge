import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { Select } from '../ui/Input';
import type { ExceptionStep, TemplateQuestion } from '../../types';

interface Props {
  callTypeId: string;
  getActiveCardQs: (
    svcId: string,
    callTypeId: string,
    subVersionId: string | null,
    facId: string
  ) => TemplateQuestion[];
  getActiveCardSteps: (
    svcId: string,
    callTypeId: string,
    subVersionId: string | null,
    facId: string,
    preAnswers: Record<string, string>
  ) => ExceptionStep[];
}

// Quick process-card lookup, shown on the result page beside the reference
// cards. Pick a facility + service + sub-version (HLOC/LLTO), answer any
// service-specific questions, and the matching process steps appear.
export function ProcessCardLookup({ callTypeId, getActiveCardQs, getActiveCardSteps }: Props) {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const has = useAppStore((s) => s.healthAuthorities);
  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const [facId, setFacId] = useState('');
  const [svcId, setSvcId] = useState('');
  const [subVersionId, setSubVersionId] = useState<'hloc' | 'llto'>('hloc');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const facilityOptions = facilities.map((f) => ({
    value: f.id,
    label: f.name,
    meta: haName(f.healthAuthorityId),
  }));

  function clear() {
    setFacId('');
    setSvcId('');
    setSubVersionId('hloc');
    setAnswers({});
  }

  const ready = !!facId && !!svcId;
  const qs = ready ? getActiveCardQs(svcId, callTypeId, subVersionId, facId) : [];
  const steps = ready
    ? getActiveCardSteps(svcId, callTypeId, subVersionId, facId, answers)
    : [];

  return (
    <Card
      title="Process card lookup"
      description="Look up a process for any facility / service."
      actions={
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      }
    >
      <div className="space-y-2">
        <Combobox
          label="Facility"
          options={facilityOptions}
          value={facId}
          onChange={setFacId}
          allowEmpty
          placeholder="Search facilities…"
        />
        <Select
          label="Service"
          value={svcId}
          onChange={(e) => {
            setSvcId(e.target.value);
            setAnswers({});
          }}
        >
          <option value="">— select —</option>
          {specialty.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Sub-version</label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={subVersionId === 'hloc' ? 'primary' : 'secondary'}
              onClick={() => setSubVersionId('hloc')}
            >
              HLOC
            </Button>
            <Button
              size="sm"
              variant={subVersionId === 'llto' ? 'primary' : 'secondary'}
              onClick={() => setSubVersionId('llto')}
            >
              LLTO
            </Button>
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="text-xs text-slate-400 mt-3">
          Pick a facility and service to see the process.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {qs.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
                Service questions
              </div>
              {qs.map((q) => (
                <div key={q.id} className="mb-2">
                  <div className="text-sm text-slate-700 mb-1">{q.text}</div>
                  {q.type === 'yesno' ? (
                    <div className="flex gap-2">
                      {['Yes', 'No'].map((opt) => (
                        <Button
                          key={opt}
                          size="sm"
                          variant={answers[q.id] === opt ? 'primary' : 'secondary'}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        >
                          {opt}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Select
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    >
                      <option value="">— select —</option>
                      {(q.options ?? []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
              Process
            </div>
            {steps.length === 0 ? (
              <div className="text-xs text-slate-400">No steps apply.</div>
            ) : (
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>{s.text}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
