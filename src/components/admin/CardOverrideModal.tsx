import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type {
  CardOverride,
  CardOverridePart,
  ProcessCardStep,
  ServiceTemplate,
  SpecialtyService,
} from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import { DragList } from '../ui/DragList';
import { uid } from '../../utils/id';
import { processCardCode } from '../../utils/processCardCode';

interface Props {
  facilityId: string;
  facilityName: string;
  service: SpecialtyService;
  override: CardOverride | null;
  onClose: () => void;
  onSave: (override: CardOverride) => void;
}

function emptyPart(): CardOverridePart {
  return {
    deactivated: [],
    addedSteps: [],
    sOrder: [],
  };
}

function emptyTpl(): ServiceTemplate {
  return { steps: [] };
}

export function CardOverrideModal({
  facilityId,
  facilityName,
  service,
  override,
  onClose,
  onSave,
}: Props) {
  const callTypes = useAppStore((s) => s.callTypes);
  const facilities = useAppStore((s) => s.facilities);
  const facility = facilities.find((f) => f.id === facilityId);

  const [tabCtId, setTabCtId] = useState<string>('');
  const [draft, setDraft] = useState<CardOverride>(
    override ?? {
      id: uid('ov'),
      facilityId,
      svcId: service.id,
      parts: {},
    }
  );

  useEffect(() => {
    if (!tabCtId && callTypes.length > 0) setTabCtId(callTypes[0].id);
  }, [callTypes, tabCtId]);

  const activeCallType = callTypes.find((c) => c.id === tabCtId);
  const part: CardOverridePart = draft.parts[tabCtId] ?? emptyPart();
  const tpl: ServiceTemplate = service.templates[tabCtId] ?? emptyTpl();
  const templateSteps = tpl.steps;

  function patchPart(p: Partial<CardOverridePart>) {
    setDraft((d) => ({
      ...d,
      parts: { ...d.parts, [tabCtId]: { ...part, ...p } },
    }));
  }

  const orderedSteps: Array<ProcessCardStep & { isCustom: boolean }> = useMemo(() => {
    const all: Array<ProcessCardStep & { isCustom: boolean }> = [
      ...templateSteps.map((s) => ({ ...s, isCustom: false })),
      ...part.addedSteps.map((s) => ({ ...s, isCustom: true })),
    ];
    if (!part.sOrder.length) return all;
    const map = new Map(all.map((s) => [s.id, s] as const));
    const out: typeof all = [];
    for (const id of part.sOrder) {
      const s = map.get(id);
      if (s) { out.push(s); map.delete(id); }
    }
    for (const s of map.values()) out.push(s);
    return out;
  }, [templateSteps, part.addedSteps, part.sOrder]);

  function toggleDeactivated(id: string) {
    const next = part.deactivated.includes(id)
      ? part.deactivated.filter((x) => x !== id)
      : [...part.deactivated, id];
    patchPart({ deactivated: next });
  }

  function updateAddedS(sid: string, patch: Partial<ProcessCardStep>) {
    patchPart({
      addedSteps: part.addedSteps.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
    });
  }
  function removeAddedS(sid: string) {
    patchPart({
      addedSteps: part.addedSteps.filter((s) => s.id !== sid),
      sOrder: part.sOrder.filter((id) => id !== sid),
    });
  }
  function addCustomS() {
    const s: ProcessCardStep = { id: uid('cs'), text: 'New step' };
    patchPart({ addedSteps: [...part.addedSteps, s] });
  }

  function reorderSteps(next: Array<{ id: string }>) {
    patchPart({ sOrder: next.map((n) => n.id) });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Process Card · ${facilityName} · ${service.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </>
      }
    >
      {callTypes.length === 0 ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          No call types defined. Add at least one in Admin → Call Types.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-2">
            {callTypes.map((ct) => (
              <button
                key={ct.id}
                type="button"
                className={`px-3 py-2 text-sm font-medium border-b-2 ${
                  tabCtId === ct.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'
                }`}
                onClick={() => setTabCtId(ct.id)}
              >
                {ct.name}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <Badge tone="blue">
              Code: {processCardCode(service, activeCallType, facility)}
            </Badge>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-slate-700">Steps</h4>
              <Button size="sm" variant="secondary" onClick={addCustomS}>+ Add custom step</Button>
            </div>
            <DragList
              items={orderedSteps}
              onReorder={reorderSteps}
              renderItem={(s, handle) => {
                const deactivated = part.deactivated.includes(s.id);
                return (
                  <div className={`border rounded-md p-3 ${s.isCustom ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'} ${deactivated ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-2">
                      {handle}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={s.isCustom ? 'slate' : 'blue'}>
                            {s.isCustom ? 'CUSTOM' : 'TEMPLATE'}
                          </Badge>
                          {!s.isCustom && (
                            <Toggle
                              checked={!deactivated}
                              onChange={() => toggleDeactivated(s.id)}
                              label={deactivated ? 'Inactive' : 'Active'}
                            />
                          )}
                        </div>
                        {s.isCustom ? (
                          <>
                            <Textarea value={s.text} onChange={(e) => updateAddedS(s.id, { text: e.target.value })} />
                            <Button size="sm" variant="ghost" onClick={() => removeAddedS(s.id)}>Delete custom step</Button>
                          </>
                        ) : (
                          <div className="text-sm text-slate-700">{s.text}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {orderedSteps.length === 0 && (
              <div className="text-xs text-slate-400 mt-2">
                No steps for this call type. Add steps to the base template in{' '}
                <em>Admin → Specialty Services</em>, or add custom steps here.
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
