import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { Input, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { ProcessCardStep } from '../../types';
import { processCardCode, parseProcessCardCode } from '../../utils/processCardCode';

interface Props {
  callTypeId: string;
  getActiveCardSteps: (
    svcId: string,
    callTypeId: string,
    facId: string,
  ) => ProcessCardStep[];
}

// Process Card lookup on the result page. Locked to the case's call type —
// you can only look up cards for this call type.
export function ProcessCardLookup({ callTypeId, getActiveCardSteps }: Props) {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const callTypes = useAppStore((s) => s.callTypes);
  const has = useAppStore((s) => s.healthAuthorities);
  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const callType = callTypes.find((c) => c.id === callTypeId);

  const [facId, setFacId] = useState('');
  const [svcId, setSvcId] = useState('');
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
    setCodeInput('');
    setCodeError('');
  }

  // Resolve a typed code (NN-L-NNN) — but only within THIS call type.
  function applyCode(raw: string) {
    setCodeInput(raw);
    setCodeError('');
    const parsed = parseProcessCardCode(raw);
    if (!parsed) return;
    if ((callType?.letter || '').toUpperCase() !== parsed.letter) {
      setCodeError(`Code ${raw} is not part of this call type.`);
      return;
    }
    const fac = facilities.find((f) => f.code === parsed.facilityCode);
    const svc = specialty.find((s) => s.number === parsed.serviceNumber);
    if (fac) setFacId(fac.id);
    if (svc) setSvcId(svc.id);
  }

  const ready = !!facId && !!svcId;
  const steps = ready ? getActiveCardSteps(svcId, callTypeId, facId) : [];

  const currentCode = useMemo(() => {
    if (!ready) return '';
    return processCardCode(
      specialty.find((s) => s.id === svcId),
      callType,
      facilities.find((f) => f.id === facId),
    );
  }, [ready, specialty, callType, facilities, svcId, facId]);

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
          onChange={(v) => setFacId(v)}
          placeholder="Search facilities…"
        />
        <Select
          label="Service"
          value={svcId}
          onChange={(e) => setSvcId(e.target.value)}
        >
          <option value="">— select —</option>
          {specialty.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
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
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
              Process Card
            </div>
            {steps.length === 0 ? (
              <div className="text-xs text-slate-400">No steps configured.</div>
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
