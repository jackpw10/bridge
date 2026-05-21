import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { Input, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { ExceptionStep, TemplateQuestion } from '../../types';
import { processCardCode, parseProcessCardCode } from '../../utils/processCardCode';

interface Props {
  callTypeId: string;
  getActiveCardQs: (
    svcId: string,
    callTypeId: string,
    subVersionId: string | null,
    facId: string,
  ) => TemplateQuestion[];
  getActiveCardSteps: (
    svcId: string,
    callTypeId: string,
    subVersionId: string | null,
    facId: string,
    preAnswers: Record<string, string>,
  ) => ExceptionStep[];
}

// Quick Process Card lookup on the result page. Pick a facility + service +
// sub-version, or type a Process Card code (NN-L-NNN) to jump straight there.
export function ProcessCardLookup({ callTypeId, getActiveCardQs, getActiveCardSteps }: Props) {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const callTypes = useAppStore((s) => s.callTypes);
  const has = useAppStore((s) => s.healthAuthorities);
  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const [facId, setFacId] = useState('');
  const [svcId, setSvcId] = useState('');
  // Defaults to the case's call type; a code search can switch it.
  const [ctId, setCtId] = useState(callTypeId);
  const [subVersionId, setSubVersionId] = useState<'hloc' | 'llto'>('hloc');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [codeInput, setCodeInput] = useState('');

  const facilityOptions = facilities.map((f) => ({
    value: f.id,
    label: f.code ? `${f.name} (${f.code})` : f.name,
    meta: haName(f.healthAuthorityId),
  }));

  function clear() {
    setFacId('');
    setSvcId('');
    setCtId(callTypeId);
    setSubVersionId('hloc');
    setAnswers({});
    setCodeInput('');
  }

  // Resolve a typed code (NN-L-NNN) into a facility / service / call type.
  function applyCode(raw: string) {
    setCodeInput(raw);
    const parsed = parseProcessCardCode(raw);
    if (!parsed) return;
    const fac = facilities.find((f) => f.code === parsed.facilityCode);
    const svc = specialty.find((s) => s.number === parsed.serviceNumber);
    const ct = callTypes.find((c) => c.letter.toUpperCase() === parsed.letter);
    if (fac) setFacId(fac.id);
    if (svc) setSvcId(svc.id);
    if (ct) setCtId(ct.id);
    if (fac || svc) setAnswers({});
  }

  const ready = !!facId && !!svcId;
  const qs = ready ? getActiveCardQs(svcId, ctId, subVersionId, facId) : [];
  const steps = ready ? getActiveCardSteps(svcId, ctId, subVersionId, facId, answers) : [];

  const currentCode = useMemo(() => {
    if (!ready) return '';
    return processCardCode(
      specialty.find((s) => s.id === svcId),
      callTypes.find((c) => c.id === ctId),
      facilities.find((f) => f.id === facId),
    );
  }, [ready, specialty, callTypes, facilities, svcId, ctId, facId]);

  return (
    <Card
      title="Process card lookup"
      description="Pick a facility / service, or type a Process Card code."
      actions={
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      }
    >
      <div className="space-y-2">
        <Input
          label="Process Card code"
          placeholder="e.g. 10-A-303"
          value={codeInput}
          onChange={(e) => applyCode(e.target.value)}
        />
        <Combobox
          label="Facility"
          options={facilityOptions}
          value={facId}
          onChange={(v) => {
            setFacId(v);
            setAnswers({});
          }}
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
          Pick a facility and service, or type a code, to see the process.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {currentCode && (
            <div>
              <Badge tone="blue">Code: {currentCode}</Badge>
            </div>
          )}
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
              Process Card
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
