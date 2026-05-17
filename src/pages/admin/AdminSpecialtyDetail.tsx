import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { DragList } from '../../components/ui/DragList';
import type {
  ExceptionStep,
  SpecialtyService,
  TACard,
  TemplateQuestion,
  VerKey,
} from '../../types';
import { uid } from '../../utils/id';

export function AdminSpecialtyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const services = useAppStore((s) => s.specialty);
  const setServices = useAppStore((s) => s.setSpecialty);
  const has = useAppStore((s) => s.healthAuthorities);
  const nav = useNavigate();

  const svc = services.find((s) => s.id === id);
  const [tab, setTab] = useState<VerKey>('llto');

  if (!svc) {
    return (
      <div>
        <Link to="/admin/specialty" className="text-brand-600 hover:underline text-sm">← Specialty services</Link>
        <div className="mt-4 text-sm text-slate-500">Service not found.</div>
      </div>
    );
  }

  const svcRef: SpecialtyService = svc;

  function patch(p: Partial<SpecialtyService>) {
    setServices(services.map((s) => (s.id === svcRef.id ? { ...s, ...p } : s)));
  }

  function patchTemplate(key: VerKey, p: Partial<SpecialtyService['template'][VerKey]>) {
    const next = {
      ...svcRef.template,
      [key]: { ...svcRef.template[key], ...p },
    };
    patch({ template: next });
  }

  function addQ() {
    const q: TemplateQuestion = { id: uid('tq'), type: 'yesno', text: 'New question' };
    patchTemplate(tab, { preQuestions: [...svcRef.template[tab].preQuestions, q] });
  }
  function updQ(qid: string, patchQ: Partial<TemplateQuestion>) {
    patchTemplate(tab, {
      preQuestions: svcRef.template[tab].preQuestions.map((q) =>
        q.id === qid ? { ...q, ...patchQ } : q
      ),
    });
  }
  function removeQ(qid: string) {
    patchTemplate(tab, {
      preQuestions: svcRef.template[tab].preQuestions.filter((q) => q.id !== qid),
    });
  }
  function reorderQs(next: TemplateQuestion[]) {
    patchTemplate(tab, { preQuestions: next });
  }

  function addS() {
    const s: ExceptionStep = { id: uid('ts'), text: 'New step' };
    patchTemplate(tab, { exceptionSteps: [...svcRef.template[tab].exceptionSteps, s] });
  }
  function updS(sid: string, patchS: Partial<ExceptionStep>) {
    patchTemplate(tab, {
      exceptionSteps: svcRef.template[tab].exceptionSteps.map((s) =>
        s.id === sid ? { ...s, ...patchS } : s
      ),
    });
  }
  function removeS(sid: string) {
    patchTemplate(tab, {
      exceptionSteps: svcRef.template[tab].exceptionSteps.filter((s) => s.id !== sid),
    });
  }
  function reorderS(next: ExceptionStep[]) {
    patchTemplate(tab, { exceptionSteps: next });
  }

  // ---------- Transport Advisor ----------
  function patchTA(p: Partial<SpecialtyService['transportAdvisor']>) {
    patch({ transportAdvisor: { ...svcRef.transportAdvisor, ...p } });
  }

  function addTaCard() {
    const card: TACard = {
      id: uid('tac'),
      name: 'New TA card',
      llto: true,
      hloc: false,
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
        <Input label="Name" value={svc.name} onChange={(e) => patch({ name: e.target.value })} />
      </Card>

      <Card>
        <div className="flex gap-2 border-b border-slate-200 mb-4">
          {(['llto', 'hloc'] as VerKey[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === v ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
              onClick={() => setTab(v)}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>

        <section className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-700">Pre-questions</h3>
              <Button size="sm" onClick={addQ}>+ Add</Button>
            </div>
            <DragList
              items={svc.template[tab].preQuestions}
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
              items={svc.template[tab].exceptionSteps}
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
                          {svc.template[tab].preQuestions.map((q) => (
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
      </Card>

      <Card
        title="Transport Advisor"
        description="Cards shown after the referral question. A card fires when its version matches the case AND its HA list includes the destination facility's HA."
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
                <Link to="/admin/health-authorities" className="underline">Admin → Health Authorities</Link>{' '}
                before assigning cards.
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

                  <div className="flex gap-4">
                    <Toggle
                      checked={card.llto}
                      onChange={(v) => updateTaCard(card.id, { llto: v })}
                      label="LLTO"
                    />
                    <Toggle
                      checked={card.hloc}
                      onChange={(v) => updateTaCard(card.id, { hloc: v })}
                      label="HLOC"
                    />
                  </div>

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

                  {!card.llto && !card.hloc && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      This card has neither LLTO nor HLOC enabled — it will never fire.
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
