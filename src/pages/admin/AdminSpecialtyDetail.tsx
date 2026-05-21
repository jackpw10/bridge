import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { DragList } from '../../components/ui/DragList';
import type {
  ExceptionStep,
  ServiceTemplate,
  SpecialtyService,
  TACard,
  TemplateQuestion,
} from '../../types';
import { uid } from '../../utils/id';

const emptyTemplate = (): ServiceTemplate => ({ preQuestions: [], exceptionSteps: [] });

export function AdminSpecialtyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const services = useAppStore((s) => s.specialty);
  const setServices = useAppStore((s) => s.setSpecialty);
  const has = useAppStore((s) => s.healthAuthorities);
  const callTypes = useAppStore((s) => s.callTypes);
  const nav = useNavigate();

  const svc = services.find((s) => s.id === id);
  const [tabCtId, setTabCtId] = useState<string>('');
  const [tabSvId, setTabSvId] = useState<string>('default');

  useEffect(() => {
    if (!tabCtId && callTypes.length > 0) setTabCtId(callTypes[0].id);
  }, [callTypes, tabCtId]);

  // Reset sub-version tab when call type tab changes — default to first sub-version
  // (or 'default' for call types without sub-versions).
  useEffect(() => {
    const ct = callTypes.find((c) => c.id === tabCtId);
    const fallback = ct && ct.subVersions.length > 0 ? ct.subVersions[0].id : 'default';
    setTabSvId(fallback);
  }, [tabCtId, callTypes]);

  if (!svc) {
    return (
      <div>
        <Link to="/admin/specialty" className="text-brand-600 hover:underline text-sm">← Specialty services</Link>
        <div className="mt-4 text-sm text-slate-500">Service not found.</div>
      </div>
    );
  }
  const svcRef: SpecialtyService = svc;

  // Active template lives at templates[callTypeId][subVersionId].
  const activeCtTemplates = svcRef.templates[tabCtId] ?? {};
  const currentTpl: ServiceTemplate = activeCtTemplates[tabSvId] ?? emptyTemplate();

  function patch(p: Partial<SpecialtyService>) {
    setServices(services.map((s) => (s.id === svcRef.id ? { ...s, ...p } : s)));
  }

  function patchTemplate(ctId: string, svId: string, p: Partial<ServiceTemplate>) {
    const byCt = svcRef.templates[ctId] ?? {};
    const existing = byCt[svId] ?? emptyTemplate();
    const nextByCt = { ...byCt, [svId]: { ...existing, ...p } };
    patch({ templates: { ...svcRef.templates, [ctId]: nextByCt } });
  }

  function addQ() {
    const q: TemplateQuestion = { id: uid('tq'), type: 'yesno', text: 'New question' };
    patchTemplate(tabCtId, tabSvId, { preQuestions: [...currentTpl.preQuestions, q] });
  }
  function updQ(qid: string, patchQ: Partial<TemplateQuestion>) {
    patchTemplate(tabCtId, tabSvId, {
      preQuestions: currentTpl.preQuestions.map((q) => (q.id === qid ? { ...q, ...patchQ } : q)),
    });
  }
  function removeQ(qid: string) {
    patchTemplate(tabCtId, tabSvId, {
      preQuestions: currentTpl.preQuestions.filter((q) => q.id !== qid),
    });
  }
  function reorderQs(next: TemplateQuestion[]) {
    patchTemplate(tabCtId, tabSvId, { preQuestions: next });
  }

  function addS() {
    const s: ExceptionStep = { id: uid('ts'), text: 'New step' };
    patchTemplate(tabCtId, tabSvId, { exceptionSteps: [...currentTpl.exceptionSteps, s] });
  }
  function updS(sid: string, patchS: Partial<ExceptionStep>) {
    patchTemplate(tabCtId, tabSvId, {
      exceptionSteps: currentTpl.exceptionSteps.map((s) =>
        s.id === sid ? { ...s, ...patchS } : s
      ),
    });
  }
  function removeS(sid: string) {
    patchTemplate(tabCtId, tabSvId, {
      exceptionSteps: currentTpl.exceptionSteps.filter((s) => s.id !== sid),
    });
  }
  function reorderS(next: ExceptionStep[]) {
    patchTemplate(tabCtId, tabSvId, { exceptionSteps: next });
  }

  const activeCallType = callTypes.find((c) => c.id === tabCtId);
  const subTabs = activeCallType?.subVersions ?? [];

  // ---------- Transport Advisor ----------
  function patchTA(p: Partial<SpecialtyService['transportAdvisor']>) {
    patch({ transportAdvisor: { ...svcRef.transportAdvisor, ...p } });
  }

  function addTaCard() {
    const card: TACard = {
      id: uid('tac'),
      name: 'New TA card',
      callTypeIds: [],
      haIds: [],
      steps: [],
    };
    patchTA({ cards: [...svcRef.transportAdvisor.cards, card] });
  }
  function updateTaCard(cid: string, p: Partial<TACard>) {
    patchTA({
      cards: svcRef.transportAdvisor.cards.map((c) => (c.id === cid ? { ...c, ...p } : c)),
    });
  }
  function removeTaCard(cid: string) {
    if (!window.confirm('Delete this TA card?')) return;
    patchTA({ cards: svcRef.transportAdvisor.cards.filter((c) => c.id !== cid) });
  }

  function deleteService() {
    if (!window.confirm('Delete this specialty service?')) return;
    setServices(services.filter((s) => s.id !== svcRef.id));
    nav('/admin/specialty');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/specialty" className="text-xs text-brand-600 hover:underline">← Specialty services</Link>
          <h1 className="text-2xl font-bold text-slate-800">{svc.name}</h1>
        </div>
        <Button variant="ghost" onClick={deleteService}>Delete</Button>
      </div>

      <Card title="Identity">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={svc.name} onChange={(e) => patch({ name: e.target.value })} />
          <Input
            label="Service number"
            type="number"
            min={1}
            value={svc.number || ''}
            placeholder="1"
            onChange={(e) => patch({ number: Number(e.target.value) || 0 })}
          />
        </div>
      </Card>

      <Card
        title="Enabled for call types"
        description="The specialty-service question during triage only lists this service for the call types toggled on here."
      >
        {callTypes.length === 0 ? (
          <div className="text-sm text-slate-500">No call types defined yet.</div>
        ) : (
          <div className="space-y-2">
            {callTypes.map((ct) => {
              const enabledIds = svcRef.enabledCallTypeIds ?? [];
              const on = enabledIds.includes(ct.id);
              return (
                <Toggle
                  key={ct.id}
                  checked={on}
                  onChange={(v) => {
                    const next = v
                      ? [...enabledIds, ct.id]
                      : enabledIds.filter((id) => id !== ct.id);
                    patch({ enabledCallTypeIds: next });
                  }}
                  label={ct.name}
                />
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Process Card Template" description="Per call-type pre-questions and exception steps. Each call type tab is independent.">
        {callTypes.length === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            No call types defined yet. Add some in{' '}
            <Link to="/admin/workflow" className="underline">Admin → Call Types</Link>{' '}
            first.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-2">
              {callTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setTabCtId(ct.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${tabCtId === ct.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
                >
                  {ct.name}
                </button>
              ))}
            </div>
            {subTabs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {subTabs.map((sv) => (
                  <button
                    key={sv.id}
                    type="button"
                    onClick={() => setTabSvId(sv.id)}
                    className={`px-2.5 py-1 text-xs rounded ${tabSvId === sv.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {sv.name}
                  </button>
                ))}
              </div>
            )}

            <section className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-700">Pre-questions</h3>
                  <Button size="sm" onClick={addQ}>+ Add</Button>
                </div>
                <DragList
                  items={currentTpl.preQuestions}
                  onReorder={reorderQs}
                  renderItem={(q, handle) => (
                    <div className="border rounded-md p-3 bg-white">
                      <div className="flex items-start gap-2">
                        {handle}
                        <div className="flex-1 space-y-2">
                          <Input value={q.text} onChange={(e) => updQ(q.id, { text: e.target.value })} />
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={q.type} onChange={(e) => updQ(q.id, { type: e.target.value as TemplateQuestion['type'] })}>
                              <option value="yesno">Yes / No</option>
                              <option value="dropdown">Dropdown</option>
                            </Select>
                            {q.type === 'dropdown' && (
                              <Input
                                placeholder="opt1|opt2"
                                value={(q.options ?? []).join('|')}
                                onChange={(e) => updQ(q.id, { options: e.target.value.split('|').map((x) => x.trim()).filter(Boolean) })}
                              />
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeQ(q.id)}>Delete</Button>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-700">Exception steps</h3>
                  <Button size="sm" onClick={addS}>+ Add</Button>
                </div>
                <DragList
                  items={currentTpl.exceptionSteps}
                  onReorder={reorderS}
                  renderItem={(s, handle) => (
                    <div className="border rounded-md p-3 bg-white">
                      <div className="flex items-start gap-2">
                        {handle}
                        <div className="flex-1 space-y-2">
                          <Textarea value={s.text} onChange={(e) => updS(s.id, { text: e.target.value })} />
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={s.condQid ?? ''} onChange={(e) => updS(s.id, { condQid: e.target.value || undefined })}>
                              <option value="">— unconditional —</option>
                              {currentTpl.preQuestions.map((q) => (
                                <option key={q.id} value={q.id}>{q.text}</option>
                              ))}
                            </Select>
                            <Input placeholder="when answer = …" value={s.condVal ?? ''} onChange={(e) => updS(s.id, { condVal: e.target.value || undefined })} />
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeS(s.id)}>Delete</Button>
                      </div>
                    </div>
                  )}
                />
              </div>
            </section>
          </>
        )}
      </Card>

      <Card
        title="Transport Advisor"
        description="Cards shown after the referral question. Card fires when the case's call type AND destination HA both match."
        actions={
          svc.transportAdvisor.enabled ? (
            <Button size="sm" onClick={addTaCard}>+ Add card</Button>
          ) : undefined
        }
      >
        <Toggle
          checked={svc.transportAdvisor.enabled}
          onChange={(v) => patchTA({ enabled: v })}
          label="Enable Transport Advisor for this service"
        />

        {svc.transportAdvisor.enabled && (
          <div className="mt-4 space-y-4">
            {has.length === 0 && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                No Health Authorities exist yet. Add one in{' '}
                <Link to="/admin/health-authorities" className="underline">Admin → Health Authorities</Link>.
              </div>
            )}
            {callTypes.length === 0 && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                No call types defined yet. Add one in{' '}
                <Link to="/admin/workflow" className="underline">Admin → Call Types</Link>.
              </div>
            )}

            {svc.transportAdvisor.cards.length === 0 ? (
              <div className="text-sm text-slate-500">
                No cards yet. Click "+ Add card" to create one.
              </div>
            ) : (
              svc.transportAdvisor.cards.map((card) => (
                <div key={card.id} className="border border-slate-200 rounded-md p-3 space-y-3 bg-slate-50">
                  <div className="flex items-start gap-2">
                    <Input
                      label="Card name"
                      value={card.name}
                      onChange={(e) => updateTaCard(card.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeTaCard(card.id)}>Delete card</Button>
                  </div>

                  <MultiSelect
                    label="Applies when case's call type is one of"
                    options={callTypes.map((c) => ({ value: c.id, label: c.name }))}
                    value={card.callTypeIds}
                    onChange={(v) => updateTaCard(card.id, { callTypeIds: v })}
                  />

                  <MultiSelect
                    label="Applies when destination HA is one of"
                    options={has.map((h) => ({ value: h.id, label: h.name }))}
                    value={card.haIds}
                    onChange={(v) => updateTaCard(card.id, { haIds: v })}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">Steps</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          updateTaCard(card.id, {
                            steps: [...card.steps, { id: uid('tas'), text: 'New step' }],
                          })
                        }
                      >
                        + Add step
                      </Button>
                    </div>
                    <DragList
                      items={card.steps}
                      onReorder={(next) => updateTaCard(card.id, { steps: next })}
                      renderItem={(step, handle) => (
                        <div className="flex items-start gap-2 bg-white border rounded-md p-2">
                          {handle}
                          <Textarea
                            value={step.text}
                            onChange={(e) =>
                              updateTaCard(card.id, {
                                steps: card.steps.map((s) =>
                                  s.id === step.id ? { ...s, text: e.target.value } : s
                                ),
                              })
                            }
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateTaCard(card.id, {
                                steps: card.steps.filter((s) => s.id !== step.id),
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    />
                  </div>

                  {card.callTypeIds.length === 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      No call types selected — this card will never fire.
                    </div>
                  )}
                  {card.haIds.length === 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      No HAs selected — this card will never fire.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
