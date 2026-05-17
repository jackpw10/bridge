import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Combobox } from '../../components/ui/Combobox';
import { Badge } from '../../components/ui/Badge';
import { CardOverrideModal } from '../../components/admin/CardOverrideModal';
import type { Facility, NotificationRequirement, ReferralPattern } from '../../types';
import { uid } from '../../utils/id';

export function AdminFacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const facilities = useAppStore((s) => s.facilities);
  const setFacilities = useAppStore((s) => s.setFacilities);
  const services = useAppStore((s) => s.specialty);
  const overrides = useAppStore((s) => s.overrides);
  const setOverrides = useAppStore((s) => s.setOverrides);
  const has = useAppStore((s) => s.healthAuthorities);
  const nav = useNavigate();

  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const facility = facilities.find((f) => f.id === id);
  const [editingOverride, setEditingOverride] = useState<{ svcId: string } | null>(null);

  if (!facility) {
    return (
      <div>
        <Link to="/admin/facilities" className="text-brand-600 hover:underline text-sm">← Facilities</Link>
        <div className="mt-4 text-sm text-slate-500">Facility not found.</div>
      </div>
    );
  }

  function patch(p: Partial<Facility>) {
    if (!facility) return;
    setFacilities(facilities.map((f) => (f.id === facility.id ? { ...f, ...p } : f)));
  }

  function setReferralPattern(svcId: string, p: ReferralPattern) {
    if (!facility) return;
    patch({
      referralPatterns: { ...facility.referralPatterns, [svcId]: p },
    });
  }

  function updateNotifReq(nr: NotificationRequirement) {
    if (!facility) return;
    const list = facility.notificationRequirements.some((n) => n.id === nr.id)
      ? facility.notificationRequirements.map((n) => (n.id === nr.id ? nr : n))
      : [...facility.notificationRequirements, nr];
    patch({ notificationRequirements: list });
  }
  function removeNotifReq(nid: string) {
    if (!facility) return;
    patch({
      notificationRequirements: facility.notificationRequirements.filter((n) => n.id !== nid),
    });
  }

  function deleteFacility() {
    if (!facility) return;
    if (!window.confirm('Delete this facility?')) return;
    setFacilities(facilities.filter((f) => f.id !== facility.id));
    nav('/admin/facilities');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/facilities" className="text-xs text-brand-600 hover:underline">← Facilities</Link>
          <h1 className="text-2xl font-bold text-slate-800">{facility.name}</h1>
        </div>
        <Button variant="ghost" onClick={deleteFacility}>Delete facility</Button>
      </div>

      <Card title="Identity">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={facility.name} onChange={(e) => patch({ name: e.target.value })} />
          <Select
            label="Health authority"
            value={facility.healthAuthorityId}
            onChange={(e) => patch({ healthAuthorityId: e.target.value })}
          >
            <option value="">— none —</option>
            {has.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </Select>
        </div>
        {has.length === 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
            No Health Authorities defined yet. Add one in{' '}
            <Link to="/admin/health-authorities" className="underline">Admin → Health Authorities</Link>.
          </div>
        )}
      </Card>

      <Card title="On-site specialty services" description="Mark which services this facility provides on-site.">
        <MultiSelect
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          value={facility.onSiteServiceIds}
          onChange={(v) => patch({ onSiteServiceIds: v })}
        />
      </Card>

      <Card title="Referral patterns" description="Default destinations for each specialty service this facility refers OUT for.">
        {services.length === 0 ? (
          <div className="text-sm text-slate-400">No specialty services defined.</div>
        ) : (
          <div className="space-y-3">
            {services.map((s) => {
              const onSite = facility.onSiteServiceIds.includes(s.id);
              const rp = facility.referralPatterns[s.id] ?? { d1: '', d2: '', d3: '' };
              const candidates = facilities
                .filter((f) => f.id !== facility.id && f.onSiteServiceIds.includes(s.id))
                .map((f) => ({ value: f.id, label: f.name, meta: haName(f.healthAuthorityId) }));
              return (
                <div key={s.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-slate-800">{s.name}</div>
                    {onSite && <Badge tone="green">On-site</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['d1','d2','d3'] as const).map((k, i) => (
                      <Combobox
                        key={k}
                        label={`Destination ${i + 1}`}
                        options={candidates}
                        value={rp[k]}
                        allowEmpty
                        onChange={(v) => setReferralPattern(s.id, { ...rp, [k]: v })}
                      />
                    ))}
                  </div>
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditingOverride({ svcId: s.id })}>
                      Edit card override
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Per-service notifications" description="Optional notification triggered when this facility is selected as receiving and the service applies.">
        <div className="space-y-3">
          {services.map((s) => {
            const cfg = facility.serviceNotifs[s.id] ?? { enabled: false, message: '' };
            return (
              <div key={s.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800">{s.name}</div>
                  <Toggle
                    checked={cfg.enabled}
                    onChange={(v) =>
                      patch({
                        serviceNotifs: { ...facility.serviceNotifs, [s.id]: { ...cfg, enabled: v } },
                      })
                    }
                  />
                </div>
                {cfg.enabled && (
                  <Textarea
                    placeholder="Message body"
                    value={cfg.message}
                    onChange={(e) =>
                      patch({
                        serviceNotifs: { ...facility.serviceNotifs, [s.id]: { ...cfg, message: e.target.value } },
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Facility notification requirements"
        description="Mandatory steps shown on the result screen for cases involving this facility."
        actions={
          <Button
            size="sm"
            onClick={() =>
              updateNotifReq({
                id: uid('nr'),
                text: '',
                llto: true,
                hloc: true,
                svcIds: [],
                excludeSvcIds: [],
              })
            }
          >
            + Add
          </Button>
        }
      >
        {facility.notificationRequirements.length === 0 ? (
          <div className="text-sm text-slate-400">None.</div>
        ) : (
          <div className="space-y-3">
            {facility.notificationRequirements.map((nr) => (
              <div key={nr.id} className="border rounded-md p-3 space-y-3">
                <Input
                  value={nr.text}
                  onChange={(e) => updateNotifReq({ ...nr, text: e.target.value })}
                  placeholder="Requirement text"
                />
                <div className="flex gap-4 flex-wrap items-center">
                  <Toggle checked={nr.llto} onChange={(v) => updateNotifReq({ ...nr, llto: v })} label="LLTO" />
                  <Toggle checked={nr.hloc} onChange={(v) => updateNotifReq({ ...nr, hloc: v })} label="HLOC" />
                  <Button size="sm" variant="ghost" onClick={() => removeNotifReq(nr.id)} className="ml-auto">Delete</Button>
                </div>
                <MultiSelect
                  label="Limit to services (empty = any)"
                  options={services.map((s) => ({ value: s.id, label: s.name }))}
                  value={nr.svcIds}
                  onChange={(v) =>
                    updateNotifReq({
                      ...nr,
                      svcIds: v,
                      // Clear exclude list when an include list is set — they're mutually exclusive.
                      excludeSvcIds: v.length > 0 ? [] : nr.excludeSvcIds,
                    })
                  }
                />
                {nr.svcIds.length === 0 && (
                  <MultiSelect
                    label="Exclude services (don't apply when any of these are selected)"
                    options={services.map((s) => ({ value: s.id, label: s.name }))}
                    value={nr.excludeSvcIds}
                    onChange={(v) => updateNotifReq({ ...nr, excludeSvcIds: v })}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingOverride && (() => {
        const svc = services.find((s) => s.id === editingOverride.svcId);
        if (!svc) return null;
        const ov = overrides.find((o) => o.facilityId === facility.id && o.svcId === svc.id);
        return (
          <CardOverrideModal
            facilityId={facility.id}
            facilityName={facility.name}
            service={svc}
            override={ov ?? null}
            onClose={() => setEditingOverride(null)}
            onSave={(next) => {
              const exists = overrides.some((o) => o.id === next.id);
              setOverrides(
                exists
                  ? overrides.map((o) => (o.id === next.id ? next : o))
                  : [...overrides, next]
              );
              setEditingOverride(null);
            }}
          />
        );
      })()}

    </div>
  );
}
