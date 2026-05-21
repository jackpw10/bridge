import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type {
  CardOverride,
  CardOverridePart,
  ExceptionStep,
  ServiceTemplate,
  SpecialtyService,
  TemplateQuestion,
} from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
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
    addedQuestions: [],
    addedSteps: [],
    qOrder: [],
    sOrder: [],
  };
}

function emptyTpl(): ServiceTemplate {
  return { preQuestions: [], exceptionSteps: [] };
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
  const [tabSvId, setTabSvId] = useState<string>('default');
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

  useEffect(() => {
    const ct = callTypes.find((c) => c.id === tabCtId);
    setTabSvId(ct && ct.subVersions.length > 0 ? ct.subVersions[0].id : 'default');
  }, [tabCtId, callTypes]);

  const activeCallType = callTypes.find((c) => c.id === tabCtId);
  const partKey = `${tabCtId}:${tabSvId}`;
  const part: CardOverridePart = draft.parts[partKey] ?? emptyPart();
  const tpl: ServiceTemplate =
    service.templates[tabCtId]?.[tabSvId] ?? emptyTpl();
  const templateQs = tpl.preQuestions;
  const templateSteps = tpl.exceptionSteps;

  function patchPart(p: Partial<CardOverridePart>) {
    setDraft((d) => ({
      ...d,
      parts: { ...d.parts, [partKey]: { ...part, ...p } },
    }));
  }

  const orderedQs: Array<TemplateQuestion & { isCustom: boolean }> = useMemo(() => {
    const all: Array<TemplateQuestion & { isCustom: boolean }> = [
      ...templateQs.map((q) => ({ ...q, isCustom: false })),
      ...part.addedQuestions.map((q) => ({ ...q, isCustom: true })),
    ];
    if (!part.qOrder.length) return all;
    const map = new Map(all.map((q) => [q.id, q] as const));
    const out: typeof all = [];
    for (const id of part.qOrder) {
      const q = map.get(id);
      if (q) { out.push(q); map.delete(id); }
    }
    for (const q of map.values()) out.push(q);
    return out;
  }, [templateQs, part.addedQuestions, part.qOrder]);

  const orderedSteps: Array<ExceptionStep & { isCustom: boolean }> = useMemo(() => {
    const all: Array<ExceptionStep & { isCustom: boolean }> = [
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

  function updateAddedQ(qid: string, patch: Partial<TemplateQuestion>) {
    patchPart({
      addedQuestions: part.addedQuestions.map((q) =>
        q.id === qid ? { ...q, ...patch } : q
      ),
    });
  }
  function removeAddedQ(qid: string) {
    patchPart({
      addedQuestions: part.addedQuestions.filter((q) => q.id !== qid),
      qOrder: part.qOrder.filter((id) => id !== qid),
    });
  }
  function addCustomQ() {
    const q: TemplateQuestion = { id: uid('cq'), type: 'yesno', text: 'New question' };
    patchPart({ addedQuestions: [...part.addedQuestions, q] });
  }

  function updateAddedS(sid: string, patch: Partial<ExceptionStep>) {
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
    const s: ExceptionStep = { id: uid('cs'), text: 'New step' };
    patchPart({ addedSteps: [...part.addedSteps, s] });
  }

  function reorderQs(next: Array<{ id: string }>) {
    patchPart({ qOrder: next.map((n) => n.id) });
  }
  function reorderSteps(next: Array<{ id: string }>) {
    patchPart({ sOrder: next.map((n) => n.id) });
  }

  const subTabs = activeCallType?.subVersions ?? [];

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
          <div className="mb-2">
            <Badge tone="blue">
              Code: {processCardCode(service, activeCallType, tabSvId, facility)}
            </Badge>
          </div>
          {subTabs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {subTabs.map((sv) => (
                <button
                  key={sv.id}
                  type="button"
                  onClick={() => setTabSvId(sv.id)}
                  className={`px-2.5 py-1 text-xs rounded ${
                    tabSvId === sv.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {sv.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-700">Questions</h4>
                <Button size="sm" variant="secondary" onClick={addCustomQ}>+ Add custom</Button>
              </div>
              <DragList
                items={orderedQs}
                onReorder={reorderQs}
                renderItem={(q, handle) => {
                  const deactivated = part.deactivated.includes(q.id);
                  return (
                    <div className={`border rounded-md p-3 ${q.isCustom ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'} ${deactivated ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-2">
                        {handle}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge tone={q.isCustom ? 'slate' : 'blue'}>
                              {q.isCustom ? 'CUSTOM' : 'TEMPLATE'}
                            </Badge>
                            {!q.isCustom && (
                              <Toggle
                                checked={!deactivated}
                                onChange={() => toggleDeactivated(q.id)}
                                label={deactivated ? 'Inactive' : 'Active'}
                              />
                            )}
                          </div>
                          {q.isCustom ? (
                            <>
                              <Input value={q.text} onChange={(e) => updateAddedQ(q.id, { text: e.target.value })} />
                              <div className="grid grid-cols-2 gap-2">
                                <Select value={q.type} onChange={(e) => updateAddedQ(q.id, { type: e.target.value as TemplateQuestion['type'] })}>
                                  <option value="yesno">Yes / No</option>
                                  <option value="dropdown">Dropdown</option>
                                </Select>
                                {q.type === 'dropdown' && (
                                  <Input
                                    placeholder="opt1|opt2|opt3"
                                    value={(q.options ?? []).join('|')}
                                    onChange={(e) =>
                                      updateAddedQ(q.id, {
                                        options: e.target.value.split('|').map((s) => s.trim()).filter(Boolean),
                                      })
                                    }
                                  />
                                )}
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => removeAddedQ(q.id)}>Delete custom question</Button>
                            </>
                          ) : (
                            <div className="text-sm text-slate-700">{q.text}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-700">Steps</h4>
                <Button size="sm" variant="secondary" onClick={addCustomS}>+ Add custom</Button>
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
                              <div className="grid grid-cols-2 gap-2">
                                <Select value={s.condQid ?? ''} onChange={(e) => updateAddedS(s.id, { condQid: e.target.value || undefined })}>
                                  <option value="">— unconditional —</option>
                                  {orderedQs.map((q) => (
                                    <option key={q.id} value={q.id}>{q.text}</option>
                                  ))}
                                </Select>
                                <Input
                                  placeholder="when answer = …"
                                  value={s.condVal ?? ''}
                                  onChange={(e) => updateAddedS(s.id, { condVal: e.target.value || undefined })}
                                />
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => removeAddedS(s.id)}>Delete custom step</Button>
                            </>
                          ) : (
                            <div className="text-sm text-slate-700">
                              <div>{s.text}</div>
                              {s.condQid && (
                                <div className="text-xs text-slate-500 mt-1">
                                  when {s.condQid} = "{s.condVal}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
