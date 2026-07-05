import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { DragList } from '../../components/ui/DragList';
import type {
  ProcessCardStep,
  ServiceTemplate,
  SpecialtyService,
  TACard,
} from '../../types';
import { uid } from '../../utils/id';

const emptyTemplate = (): ServiceTemplate => ({ steps: [] });

export function AdminSpecialtyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const services = useAppStore((s) => s.specialty);
  const setServices = useAppStore((s) => s.setSpecialty);
  const has = useAppStore((s) => s.healthAuthorities);
  const callTypes = useAppStore((s) => s.callTypes);
  const nav = useNavigate();

  const svc = services.find((s) => s.id === id);
  const [tabCtId, setTabCtId] = useState<string>('');

  useEffect(() => {
    if (!tabCtId && callTypes.length > 0) setTabCtId(callTypes[0].id);
  }, [callTypes, tabCtId]);

  if (!svc) {
    return (
      <div>
        <Link to="/admin/specialty" className="text-brand-600 hover:underline text-sm">← Specialty services</Link>
        <div className="mt-4 text-sm text-slate-500">Service not found.</div>
      </div>
    );
  }
  const svcRef: SpecialtyService = svc;

  // Active template lives at templates[callTypeId].
  const currentTpl: ServiceTemplate = svcRef.templates[tabCtId] ?? emptyTemplate();

  function patch(p: Partial<SpecialtyService>) {
    setServices(services.map((s) => (s.id === svcRef.id ? { ...s, ...p } : s)));
  }

  function patchTemplate(ctId: string, p: Partial<ServiceTemplate>) {
    const existing = svcRef.templates[ctId] ?? emptyTemplate();
    patch({ templates: { ...svcRef.templates, [ctId]: { ...existing, ...p } } });
  }

  function addS() {
    const s: ProcessCardStep = { id: uid('ts'), text: 'New step' };
    patchTemplate(tabCtId, { steps: [...currentTpl.steps, s] });
  }
  function updS(sid: string, text: string) {
    patchTemplate(tabCtId, {
      steps: currentTpl.steps.map((s) => (s.id === sid ? { ...s, text } : s)),
    });
  }
  function removeS(sid: string) {
    patchTemplate(tabCtId, { steps: currentTpl.steps.filter((s) => s.id !== sid) });
  }
  function reorderS(next: ProcessCardStep[]) {
    patchTemplate(tabCtId, { steps: next });
  }

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

      <Card title="Process Card Template" description="One flat list of steps per call type.">
        {callTypes.length === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            No call types defined yet. Add some in{' '}
            <Link to="/admin/workflow" className="underline">Admin → Call Types</Link>{' '}
            first.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-4">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700">Process Card steps</h3>
                <Button size="sm" onClick={addS}>+ Add step</Button>
              </div>
              <DragList
                items={currentTpl.steps}
                onReorder={reorderS}
                renderItem={(s, handle) => (
                  <div className="border rounded-md p-3 bg-white">
                    <div className="flex items-start gap-2">
                      {handle}
                      <Textarea
                        value={s.text}
                        onChange={(e) => updS(s.id, e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" variant="ghost" onClick={() => removeS(s.id)}>Delete</Button>
                    </div>
                  </div>
                )}
              />
              {currentTpl.steps.length === 0 && (
                <div className="text-xs text-slate-400 mt-2">No steps yet for this call type.</div>
              )}
            </div>
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
