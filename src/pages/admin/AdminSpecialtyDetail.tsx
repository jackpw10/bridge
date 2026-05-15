import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Badge } from '../../components/ui/Badge';
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
  const facilities = useAppStore((s) => s.facilities);
  const nav = useNavigate();

  const svc = services.find((s) => s.id === id);
  const [tab, setTab] = useState<VerKey>('llto');
  const [haTab, setHaTab] = useState<string | null>(null);

  if (!svc) {
    return (
      <div>
        <Link to="/admin/specialty" className="text-brand-600 hover:underline text-sm">← Specialty services</Link>
        <div className="mt-4 text-sm text-slate-500">Service not found.</div>
      </div>
    );
  }

  const has = Array.from(new Set(facilities.map((f) => f.healthAuthority).filter(Boolean)));
  const activeHa = haTab ?? has[0] ?? '';

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

  function patchTA(p: Partial<SpecialtyService['transportAdvisor']>) {
    patch({ transportAdvisor: { ...svcRef.transportAdvisor, ...p } });
  }
  function getCard(ha: string): TACard {
    return svcRef.transportAdvisor.cardsByHA[ha] ?? { steps: [] };
  }
  function setCard(ha: string, card: TACard) {
    patchTA({ cardsByHA: { ...svcRef.transportAdvisor.cardsByHA, [ha]: card } });
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

      <Card title="Transport Advisor" description="Optional pre-result HA-specific cards.">
        <Toggle
          checked={svc.transportAdvisor.enabled}
          onChange={(v) => patchTA({ enabled: v })}
          label="Enable Transport Advisor for this service"
        />
        {svc.transportAdvisor.enabled && (
          <div className="mt-4">
            {has.length === 0 ? (
              <div className="text-sm text-slate-400">Define at least one facility with a Health Authority first.</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {has.map((ha) => (
                    <button
                      key={ha}
                      type="button"
                      onClick={() => setHaTab(ha)}
                      className={`text-xs px-2.5 py-1 rounded ${activeHa === ha ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {ha}
                    </button>
                  ))}
                </div>
                <Badge tone="purple">HA: {activeHa}</Badge>
                <div className="mt-3 space-y-2">
                  {getCard(activeHa).steps.map((step, idx) => (
                    <div key={step.id} className="flex items-start gap-2">
                      <Textarea
                        value={step.text}
                        onChange={(e) => {
                          const card = getCard(activeHa);
                          const next = card.steps.map((s) => (s.id === step.id ? { ...s, text: e.target.value } : s));
                          setCard(activeHa, { ...card, steps: next });
                        }}
                      />
                      <Button size="sm" variant="ghost" onClick={() => {
                        const card = getCard(activeHa);
                        setCard(activeHa, { ...card, steps: card.steps.filter((s) => s.id !== step.id) });
                      }}>Remove</Button>
                      <Badge tone="slate">{idx + 1}</Badge>
                    </div>
                  ))}
                  <Button size="sm" onClick={() => {
                    const card = getCard(activeHa);
                    setCard(activeHa, { steps: [...card.steps, { id: uid('tas'), text: 'New step' }] });
                  }}>+ Add step</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
