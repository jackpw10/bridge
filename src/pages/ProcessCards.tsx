import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Combobox } from '../components/ui/Combobox';
import { MultiSelect } from '../components/ui/MultiSelect';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import type {
  CardOverride,
  CardOverridePart,
  ExceptionStep,
  SpecialtyService,
  TemplateQuestion,
} from '../types';

function applyOrder<T extends { id: string }>(all: T[], order: string[]): T[] {
  if (!order.length) return all;
  const map = new Map(all.map((q) => [q.id, q] as const));
  const out: T[] = [];
  for (const id of order) {
    const q = map.get(id);
    if (q) { out.push(q); map.delete(id); }
  }
  for (const q of map.values()) out.push(q);
  return out;
}

interface MergedCard {
  qs: TemplateQuestion[];
  steps: ExceptionStep[];
}

function mergeForCallType(
  svc: SpecialtyService,
  override: CardOverride | null,
  callTypeId: string,
  subVersionId: string
): MergedCard {
  const byCt = svc.templates[callTypeId] ?? {};
  const tpl = byCt[subVersionId];
  const partKey = `${callTypeId}:${subVersionId}`;
  const part: CardOverridePart | null = override?.parts[partKey] ?? null;
  const baseQs = (tpl?.preQuestions ?? []).filter((q) => !part?.deactivated.includes(q.id));
  const allQs = [...baseQs, ...(part?.addedQuestions ?? [])];
  const qs = applyOrder(allQs, part?.qOrder ?? []);

  const baseSteps = (tpl?.exceptionSteps ?? []).filter((s) => !part?.deactivated.includes(s.id));
  const allSteps = [...baseSteps, ...(part?.addedSteps ?? [])];
  const steps = applyOrder(allSteps, part?.sOrder ?? []);

  return { qs, steps };
}

export function ProcessCardsPage() {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const overrides = useAppStore((s) => s.overrides);
  const has = useAppStore((s) => s.healthAuthorities);
  const callTypes = useAppStore((s) => s.callTypes);

  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const [facId, setFacId] = useState('');
  const [svcIds, setSvcIds] = useState<string[]>([]);
  const [callTypeId, setCallTypeId] = useState<string>('');
  const [subVersionId, setSubVersionId] = useState<string>('default');

  useEffect(() => {
    if (!callTypeId && callTypes.length > 0) setCallTypeId(callTypes[0].id);
  }, [callTypes, callTypeId]);

  useEffect(() => {
    const ct = callTypes.find((c) => c.id === callTypeId);
    setSubVersionId(ct?.subVersions[0]?.id ?? 'default');
  }, [callTypeId, callTypes]);

  const facility = facilities.find((f) => f.id === facId) ?? null;
  const services = useMemo(
    () =>
      svcIds
        .map((id) => specialty.find((s) => s.id === id))
        .filter((s): s is SpecialtyService => !!s),
    [svcIds, specialty]
  );

  const notifReqs = useMemo(() => {
    if (!facility) return [];
    return facility.notificationRequirements.filter((nr) => {
      if (nr.callTypeIds.length > 0 && !nr.callTypeIds.includes(callTypeId)) return false;
      if (nr.svcIds.length > 0) {
        return svcIds.some((svc) => nr.svcIds.includes(svc));
      }
      if (nr.excludeSvcIds.length > 0) {
        return !svcIds.some((svc) => nr.excludeSvcIds.includes(svc));
      }
      return true;
    });
  }, [facility, callTypeId, svcIds]);

  const facilityOptions = facilities.map((f) => ({
    value: f.id,
    label: f.name,
    meta: haName(f.healthAuthorityId),
  }));
  const serviceOptions = specialty.map((s) => ({ value: s.id, label: s.name }));

  function clear() {
    setFacId('');
    setSvcIds([]);
    setCallTypeId(callTypes[0]?.id ?? '');
  }

  const activeCallType = callTypes.find((c) => c.id === callTypeId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Process card lookup</h1>
          <p className="text-sm text-slate-500">
            Preview the action card content and notification requirements for a specific
            facility / service / call type, without running a triage case.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
      </div>

      <Card title="Pick a combination">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Combobox
            label="Receiving facility"
            options={facilityOptions}
            value={facId}
            onChange={setFacId}
            allowEmpty
            placeholder="Search facilities…"
          />
          <MultiSelect
            label="Service(s)"
            options={serviceOptions}
            value={svcIds}
            onChange={setSvcIds}
            placeholder="Pick one or more…"
          />
          <Select label="Call type" value={callTypeId} onChange={(e) => setCallTypeId(e.target.value)}>
            {callTypes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {(activeCallType?.subVersions.length ?? 0) > 0 && (
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Sub-version</label>
            <div className="flex flex-wrap gap-2">
              {activeCallType?.subVersions.map((sv) => (
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
      </Card>

      {!facId || svcIds.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-500">
            Pick a receiving facility <strong>and</strong> at least one service to see
            the notification requirements and action card content.
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="Receiving-facility notification requirements"
            description={`${facility?.name ?? ''}${activeCallType ? ` · ${activeCallType.name}` : ''}`}
          >
            {notifReqs.length === 0 ? (
              <div className="text-sm text-slate-400">No matching requirements.</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {notifReqs.map((nr) => (
                  <li key={nr.id}>
                    {nr.text}
                    {nr.svcIds.length > 0 && (
                      <span className="text-xs text-slate-400 ml-2">
                        (limited to: {nr.svcIds.map((id) => specialty.find((s) => s.id === id)?.name ?? id).join(', ')})
                      </span>
                    )}
                    {nr.svcIds.length === 0 && nr.excludeSvcIds.length > 0 && (
                      <span className="text-xs text-slate-400 ml-2">
                        (excluded for: {nr.excludeSvcIds.map((id) => specialty.find((s) => s.id === id)?.name ?? id).join(', ')})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div
            className={`grid grid-cols-1 ${
              services.length > 1 ? 'md:grid-cols-2' : ''
            } gap-4`}
          >
            {services.map((svc) => {
              const ov = facility
                ? overrides.find((o) => o.facilityId === facility.id && o.svcId === svc.id) ?? null
                : null;
              const merged = mergeForCallType(svc, ov, callTypeId, subVersionId);
              const hasOverride = !!ov?.parts[`${callTypeId}:${subVersionId}`];
              return (
                <Card
                  key={svc.id}
                  title={
                    <span className="flex items-center gap-2">
                      <span>{svc.name}</span>
                      {activeCallType && <Badge tone="blue">{activeCallType.name}</Badge>}
                      {activeCallType && activeCallType.subVersions.length > 0 && (
                        <Badge tone="green">{activeCallType.subVersions.find((s) => s.id === subVersionId)?.name ?? subVersionId}</Badge>
                      )}
                      {hasOverride && <Badge tone="amber">facility override</Badge>}
                    </span>
                  }
                  description={facility ? `at ${facility.name}` : 'no facility selected'}
                >
                  <div className="space-y-3">
                    <section>
                      <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
                        Pre-questions
                      </div>
                      {merged.qs.length === 0 ? (
                        <div className="text-xs text-slate-400">None.</div>
                      ) : (
                        <ul className="text-sm space-y-1">
                          {merged.qs.map((q) => (
                            <li key={q.id} className="text-slate-700">
                              <span className="font-medium">{q.text}</span>{' '}
                              <span className="text-xs text-slate-400">
                                ({q.type === 'dropdown' ? `dropdown: ${(q.options ?? []).join(', ')}` : 'Yes / No'})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section>
                      <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
                        Exception steps
                      </div>
                      {merged.steps.length === 0 ? (
                        <div className="text-xs text-slate-400">None.</div>
                      ) : (
                        <ol className="list-decimal pl-5 text-sm space-y-1">
                          {merged.steps.map((s) => (
                            <li key={s.id}>
                              {s.text}
                              {s.condQid && (
                                <span className="text-xs text-slate-400 ml-1">
                                  (only when "{merged.qs.find((q) => q.id === s.condQid)?.text ?? s.condQid}" = "{s.condVal}")
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
