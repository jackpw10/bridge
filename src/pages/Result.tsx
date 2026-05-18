import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriage } from '../hooks/useTriage';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Combobox } from '../components/ui/Combobox';
import { uid } from '../utils/id';

export function ResultPage() {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);
  const diagnoses = useAppStore((s) => s.diagnoses);
  const refCards = useAppStore((s) => s.refCards);
  const reasons = useAppStore((s) => s.reasons);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const session = useAppStore((s) => s.session);
  const nav = useNavigate();

  // ----- compute filtered notification requirements for receiving facility -----
  const receiving = t.destFacility;
  const filteredNotifReqs = useMemo(() => {
    if (!receiving) return [];
    return receiving.notificationRequirements.filter((nr) => {
      // call-type gate
      if (nr.callTypeIds.length > 0 && !nr.callTypeIds.includes(t.callTypeId)) return false;
      if (nr.svcIds.length > 0) {
        return t.context.svcIds.some((svc) => nr.svcIds.includes(svc));
      }
      if (nr.excludeSvcIds.length > 0) {
        return !t.context.svcIds.some((svc) => nr.excludeSvcIds.includes(svc));
      }
      return true;
    });
  }, [receiving, t.callTypeId, t.context.svcIds]);

  // ----- side-effect: send out per-service + per-diagnosis notifications once -----
  useEffect(() => {
    if (t.notifsSent || !session) return;
    if (t.acQueue.length === 0 && t.context.diagnoses.length === 0) {
      t.markNotifsSent();
      return;
    }

    const newNotifs = [...notifications];

    for (const item of t.acQueue) {
      const dest = facilities.find((f) => f.id === item.destFacId);
      const svc = specialty.find((s) => s.id === item.svcId);
      if (!dest || !svc) continue;
      const cfg = dest.serviceNotifs[item.svcId];
      if (cfg?.enabled && cfg.message) {
        newNotifs.push({
          id: uid('n'),
          from: session.userId,
          ts: Date.now(),
          title: `${svc.name} → ${dest.name}`,
          body: cfg.message,
          ackedBy: [session.userId],
          deletedFor: [],
        });
      }
    }

    for (const dxId of t.context.diagnoses) {
      const dx = diagnoses.find((d) => d.id === dxId);
      if (dx?.notifEnabled && dx.notifMessage) {
        newNotifs.push({
          id: uid('n'),
          from: session.userId,
          ts: Date.now(),
          title: `Diagnosis: ${dx.text}`,
          body: dx.notifMessage,
          ackedBy: [session.userId],
          deletedFor: [],
        });
      }
    }

    if (newNotifs.length !== notifications.length) {
      setNotifications(newNotifs);
    }
    t.markNotifsSent();
  }, [t, notifications, facilities, specialty, diagnoses, session, setNotifications]);

  // ----- case summary text -----
  const summary = useMemo(() => buildSummary(), [t, facilities, specialty, diagnoses, filteredNotifReqs, reasons]);

  function buildSummary(): string {
    const lines: string[] = [];
    lines.push('IFT Triage Result');
    lines.push(`Workflow: ${t.activeWorkflow?.name ?? '—'}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    if (t.callTypeName) {
      lines.push(`Call type: ${t.callTypeName}`);
    }
    lines.push('');
    lines.push(`Sending: ${t.sendingFacility?.name ?? '—'}`);
    if (t.destFacility) lines.push(`Receiving: ${t.destFacility.name}`);
    lines.push('');

    // ---- All triage answers (every visible workflow question) ----
    lines.push('Triage answers:');
    for (const q of t.visibleQuestions) {
      const answer = formatAnswerForSummary(q);
      lines.push(`  • ${q.text}: ${answer || '—'}`);
    }

    // ---- Post-triage answers ----
    const pt = t.activeWorkflow?.postTriage;
    if (pt?.mode === 'questions' && pt.questions.length > 0) {
      lines.push('');
      lines.push('Post-triage answers:');
      for (const q of pt.questions) {
        lines.push(`  • ${q.text}: ${t.postTriageAnswers[q.id] || '—'}`);
      }
    } else if (pt?.mode === 'transport_requirements' && pt.items.length > 0) {
      lines.push('');
      lines.push('Transport requirements:');
      for (const item of pt.items) {
        const v = t.postTriageAnswers[item.id] ?? '';
        lines.push(`  • ${item.label}: ${v || '—'}`);
      }
    }

    // ---- Per-service action cards ----
    for (const item of t.acQueue) {
      const svc = specialty.find((s) => s.id === item.svcId);
      const dest = facilities.find((f) => f.id === item.destFacId);
      if (!svc) continue;
      lines.push('');
      lines.push(`— ${svc.name}${t.callTypeName ? ` (${t.callTypeName})` : ''} → ${dest?.name ?? '—'} —`);
      const qs = t.getActiveCardQs(item.svcId, t.callTypeId, t.subVersionId, item.destFacId);
      const preAnswers: Record<string, string> = {};
      for (const q of qs) {
        const key = `${item.svcId}:${q.id}`;
        const a = t.acStates[key] ?? '';
        preAnswers[q.id] = a;
        lines.push(`  • ${q.text}: ${a || '—'}`);
      }
      const steps = t.getActiveCardSteps(item.svcId, t.callTypeId, t.subVersionId, item.destFacId, preAnswers);
      for (const s of steps) {
        lines.push(`  → ${s.text}`);
      }
    }

    if (t.activeProcessSteps.length) {
      lines.push('');
      lines.push('Process steps:');
      t.activeProcessSteps.forEach((s, i) => lines.push(`  ${i + 1}. ${s.text}`));
    }

    if (filteredNotifReqs.length) {
      lines.push('');
      lines.push('Receiving-facility notifications:');
      filteredNotifReqs.forEach((nr) => lines.push(`  • ${nr.text}`));
    }

    if (t.notes.trim()) {
      lines.push('');
      lines.push('Additional information:');
      lines.push(t.notes.trim());
    }

    return lines.join('\n');
  }

  // Build a human-readable string for any workflow question's answer.
  function formatAnswerForSummary(q: typeof t.visibleQuestions[number]): string {
    const raw = t.answers[q.id];

    if (q.type === 'referral_resolve') {
      const choice = t.answers[`${q.id}__choice`];
      if (!choice) return '—';
      if (choice === '__custom__') {
        const facId = t.answers[`${q.id}__customfacid`];
        const reasonId = t.answers[`${q.id}__reasonid`];
        const fac = facilities.find((f) => f.id === facId);
        const reason = reasons.find((r) => r.id === reasonId);
        return `Custom: ${fac?.name ?? '—'}${reason ? ` (reason: ${reason.text})` : ''}`;
      }
      const fac = facilities.find((f) => f.id === choice);
      return fac ? `Default destination: ${fac.name}` : raw ?? '—';
    }

    return raw ?? '';
  }

  // ----- reference card quick lookup -----
  const [refOpen, setRefOpen] = useState<string>('');
  const refOptions = refCards.map((c) => ({
    value: c.id,
    label: c.name,
    meta: c.code,
  }));
  const refSelected = refCards.find((c) => c.id === refOpen);

  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function completeCase() {
    t.reset();
    nav('/triage');
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">IFT Triage Result</h1>
        <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
          <Badge tone="blue">{t.activeWorkflow?.name ?? '—'}</Badge>
          <span>{t.sendingFacility?.name ?? '—'} → {t.destFacility?.name ?? '—'}</span>
          {t.callTypeName && <Badge tone="green">{t.callTypeName}</Badge>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {t.acQueue.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-500">
                No service/destination was selected. Generic process steps below still apply.
              </div>
            </Card>
          ) : (
            <div
              className={`grid grid-cols-1 ${
                t.acQueue.length > 1 ? 'md:grid-cols-2' : ''
              } gap-4`}
            >
              {t.acQueue.map((item) => {
                const svc = specialty.find((s) => s.id === item.svcId);
                const dest = facilities.find((f) => f.id === item.destFacId);
                if (!svc) return null;
                const qs = t.getActiveCardQs(item.svcId, t.callTypeId, t.subVersionId, item.destFacId);
                const preAnswers: Record<string, string> = {};
                for (const q of qs) {
                  preAnswers[q.id] = t.acStates[`${item.svcId}:${q.id}`] ?? '';
                }
                const steps = t.getActiveCardSteps(
                  item.svcId,
                  t.callTypeId,
                  t.subVersionId,
                  item.destFacId,
                  preAnswers
                );
                return (
                  <Card
                    key={`${item.svcId}:${item.destFacId}`}
                    title={
                      <span className="flex items-center gap-2">
                        <span>{svc.name}</span>
                        {t.callTypeName && (
                          <Badge tone="blue">{t.callTypeName}</Badge>
                        )}
                      </span>
                    }
                    description={`Destination: ${dest?.name ?? '—'}`}
                  >
                    {qs.length > 0 && (
                      <ul className="text-sm space-y-1 mb-3">
                        {qs.map((q) => (
                          <li key={q.id}>
                            <span className="text-slate-500">{q.text}:</span>{' '}
                            <span className="font-medium">{preAnswers[q.id] || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {steps.length > 0 ? (
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        {steps.map((s) => (
                          <li key={s.id}>{s.text}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-xs text-slate-400">No exception steps apply.</div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Card title="Generic process steps">
            {t.activeProcessSteps.length === 0 ? (
              <div className="text-sm text-slate-400">None configured for this workflow.</div>
            ) : (
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                {t.activeProcessSteps.map((s) => <li key={s.id}>{s.text}</li>)}
              </ol>
            )}
          </Card>

          {filteredNotifReqs.length > 0 && (
            <Card
              title="Receiving-facility notification requirements"
              description={t.destFacility?.name}
            >
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {filteredNotifReqs.map((nr) => <li key={nr.id}>{nr.text}</li>)}
              </ul>
            </Card>
          )}

          {t.notes.trim() && (
            <Card title="Additional information">
              <p className="text-sm whitespace-pre-wrap text-slate-700">{t.notes}</p>
            </Card>
          )}

          <Card
            title="Case summary"
            actions={
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            }
          >
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-3">
              {summary}
            </pre>
          </Card>
        </div>

        {/* Right column (1/3) — Reference cards */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4">
            <Card title="Reference cards" description="Quick lookup">
              <Combobox
                options={refOptions}
                value={refOpen}
                onChange={setRefOpen}
                allowEmpty
                placeholder="Type to find a reference card by name or code…"
              />
              {refSelected && (
                <div className="mt-3 p-3 border border-slate-200 rounded-md bg-slate-50">
                  <div className="font-medium text-slate-800">{refSelected.name}</div>
                  {refSelected.code && (
                    <div className="text-xs text-slate-500">code: {refSelected.code}</div>
                  )}
                  {refSelected.body && (
                    <p className="text-sm mt-2 whitespace-pre-wrap">{refSelected.body}</p>
                  )}
                  {refSelected.steps.length > 0 && (
                    <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
                      {refSelected.steps.map((s) => (
                        <li key={s.id}>{s.text}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => { t.goToWorkflow(); nav('/triage/run'); }}>
          Back
        </Button>
        <Button onClick={completeCase}>Complete case</Button>
      </div>
    </div>
  );
}
