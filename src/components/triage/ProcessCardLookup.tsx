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

// Process Card lookup on the result page. Locked to the case's call type —
// you can only look up cards for this call type's sub-versions.
export function ProcessCardLookup({ callTypeId, getActiveCardQs, getActiveCardSteps }: Props) {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const callTypes = useAppStore((s) => s.callTypes);
  const has = useAppStore((s) => s.healthAuthorities);
  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const callType = callTypes.find((c) => c.id === callTypeId);
  const subVersions = callType?.subVersions ?? [];

  const [facId, setFacId] = useState('');
  const [svcId, setSvcId] = useState('');
  const [subVersionId, setSubVersionId] = useState(subVersions[0]?.id ?? 'default');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const facilityOptions = facilities.map((f) => ({
    value: f.id,
    label: f.code ? `${f.name} (${f.code})` : f.name,
    meta: haName(f.healthAuthorityId),
  }));

  function clear() {
    setFacId('');
    setSvcId('');
    setSubVersionId(subVersions[0]?.id ?? 'default');
    setAnswers({});
    setCodeInput('');
    setCodeError('');
  }

  // Resolve a typed code (NN-L-NNN) — but only within THIS call type.
  function applyCode(raw: string) {
    setCodeInput(raw);
    setCodeError('');
    const parsed = parseProcessCardCode(raw);
    if (!parsed) return;
    // The letter must belong to this call type (one of its sub-versions, or
    // the call type itself when it has none).
    let resolvedSv: string | null = null;
    if (subVersions.length === 0) {
      if ((callType?.letter || '').toUpperCase() === parsed.letter) resolvedSv = 'default';
    } else {
      const sv = subVersions.find((s) => (s.letter || '').toUpperCase() === parsed.letter);
      if (sv) resolvedSv = sv.id;
    }
    if (!resolvedSv) {
      setCodeError(`Code ${raw} is not part of this call type.`);
      return;
    }
    const fac = facilities.find((f) => f.code === parsed.facilityCode);
    const svc = specialty.find((s) => s.number === parsed.serviceNumber);
    if (fac) setFacId(fac.id);
    if (svc) setSvcId(svc.id);
    setSubVersionId(resolvedSv);
    if (fac || svc) setAnswers({});
  }

  const ready = !!facId && !!svcId;
  const qs = ready ? getActiveCardQs(svcId, callTypeId, subVersionId, facId) : [];
  const steps = ready ? getActiveCardSteps(svcId, callTypeId, subVersionId, facId, answers) : [];

  const currentCode = useMemo(() => {
    if (!ready) return '';
    return processCardCode(
      specialty.find((s) => s.id === svcId),
      callType,
      subVersionId,
      facilities.find((f) => f.id === facId),
    );
  }, [ready, specialty, callType, subVersionId, facilities, svcId, facId]);

  return (
    <Card
      title="Process card lookup"
      description={`Cards for the ${callType?.name ?? 'current'} call type.`}
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
        {codeError && <div className="text-xs text-amber-700">{codeError}</div>}
        <Combobox
          label="Facility"
          numbered
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
        {subVersions.length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Sub-version</label>
            <div className="flex flex-wrap gap-2">
              {subVersions.map((sv) => (
                <Button
                  key={sv.id}
                  size="sm"
                  variant={subVersionId === sv.id ? 'primary' : 'secondary'}
                  onClick={() => setSubVersionId(sv.id)}
                >
                  {sv.name}
                </Button>
              ))}
            </div>
          </div>
        )}
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
