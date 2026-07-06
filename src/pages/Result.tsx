import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriage } from '../hooks/useTriage';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Combobox } from '../components/ui/Combobox';
import { TriageTabs } from '../components/triage/TriageTabs';
import { ProcessCardLookup } from '../components/triage/ProcessCardLookup';
import { CaseEventLog } from '../components/triage/CaseEventLog';
import { QuestionRenderer } from '../components/triage/QuestionRenderer';
import { uid } from '../utils/id';

export function ResultPage() {
  const t = useTriage();
  const specialty = useAppStore((s) => s.specialty);
  const facilities = useAppStore((s) => s.facilities);
  const diagnoses = useAppStore((s) => s.diagnoses);
  const refCards = useAppStore((s) => s.refCards);
  const reasons = useAppStore((s) => s.reasons);
  const initialQs = useAppStore((s) => s.initialCallQuestions);
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

  // Log the phase change into 'result' once, when the user actually reaches
  // this page for the current case.
  useEffect(() => {
    if (t.caseId && t.phase === 'result') {
      t.logAction('phase_change', 'Reached Result screen', { phase: 'result' });
    }
    // Only fires when the caseId changes; a real phase transition also
    // arrives via a caseId that hasn't logged a phase_change yet. Guarding
    // by caseId + phase is enough for now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.caseId]);

  // Log any change to the receiving facility while on the Result page. This
  // covers the inline editor below, whichever underlying question drives it.
  const prevDestId = useRef<string | null>(t.destFacility?.id ?? null);
  useEffect(() => {
    const cur = t.destFacility?.id ?? null;
    if (prevDestId.current !== null && prevDestId.current !== cur) {
      t.logAction(
        'receiving_facility_changed',
        `Receiving facility: ${t.destFacility?.name ?? '—'}`,
        { facId: cur },
      );
    }
    prevDestId.current = cur;
  }, [t.destFacility?.id, t]);

  // ----- case summary text -----
  const summary = useMemo(() => buildSummary(), [t, facilities, specialty, diagnoses, filteredNotifReqs, reasons, initialQs]);

  function buildSummary(): string {
    const lines: string[] = [];
    lines.push('IFT Triage Result');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    if (t.callTypeName) lines.push(`Call type: ${t.callTypeName}`);
    lines.push('');
    lines.push(`Sending: ${t.sendingFacility?.name ?? '—'}`);
    if (t.destFacility) lines.push(`Receiving: ${t.destFacility.name}`);
    lines.push('');

    // ---- Initial call answers (asked before the call type was picked) ----
    const answeredInitials = initialQs.filter((q) => (t.initialAnswers[q.id] ?? '').trim());
    if (answeredInitials.length > 0) {
      lines.push('Initial call answers:');
      for (const q of answeredInitials) {
        lines.push(`  • ${q.text}: ${t.initialAnswers[q.id] || '—'}`);
      }
      lines.push('');
    }

    // ---- All triage answers (every visible workflow question) ----
    lines.push('Triage answers:');
    for (const q of t.visibleQuestions) {
      const answer = formatAnswerForSummary(q);
      lines.push(`  • ${q.text}: ${answer || '—'}`);
    }

    // ---- Per-service Process Cards ----
    for (const item of t.acQueue) {
      const svc = specialty.find((s) => s.id === item.svcId);
      const dest = facilities.find((f) => f.id === item.destFacId);
      if (!svc) continue;
      lines.push('');
      lines.push(`— ${svc.name}${t.callTypeName ? ` (${t.callTypeName})` : ''} → ${dest?.name ?? '—'} —`);
      const steps = t.getActiveCardSteps(item.svcId, t.callTypeId, item.destFacId);
      for (const s of steps) {
        lines.push(`  → ${s.text}`);
      }
    }

    if (t.activeProcessSteps.length) {
      lines.push('');
      lines.push('Action Card:');
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
  const [editingDest, setEditingDest] = useState(false);

  // The workflow question whose answer drives destFacility. Prefer
  // referral_resolve (richer UX: 3 default destinations + custom override +
  // reason). Fall back to a plain receiving_facility picker.
  const destinationQuestion = useMemo(() => {
    return (
      t.visibleQuestions.find((q) => q.type === 'referral_resolve') ??
      t.visibleQuestions.find((q) => q.type === 'receiving_facility') ??
      null
    );
  }, [t.visibleQuestions]);
  function copy() {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function completeCase() {
    nav(t.closeActiveCase());
  }

  // Transitional: while a tab switch navigates here, the active case may be a
  // non-result case for one render. Render nothing rather than flashing the
  // error panel.
  if (t.phase !== 'result') return null;

  // If the workflow couldn't be loaded (e.g. it was deleted while the case
  // was in progress, or realtime sync raced), show a clear error rather than
  // rendering a tree full of empty placeholders.
  if (!t.activeWorkflow) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">IFT Triage Result</h1>
        </div>
        <Card>
          <div className="space-y-3">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
              <strong>The workflow for this case is no longer available.</strong> It may
              have been deleted, or the page lost its connection. Start a new case from
              the triage tab.
            </div>
            <Button onClick={() => nav(t.closeActiveCase())}>Back to triage</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TriageTabs />
      <div>
        <h1 className="text-2xl font-bold text-slate-800">IFT Triage Result</h1>
        <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
          <span>{t.sendingFacility?.name ?? '—'} → {t.destFacility?.name ?? '—'}</span>
          {t.callTypeName && <Badge tone="green">{t.callTypeName}</Badge>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {initialQs.some((q) => (t.initialAnswers[q.id] ?? '').trim()) && (
            <Card title="Initial call answers">
              <ul className="text-sm space-y-1">
                {initialQs
                  .filter((q) => (t.initialAnswers[q.id] ?? '').trim())
                  .map((q) => (
                    <li key={q.id}>
                      <span className="text-slate-500">{q.text}:</span>{' '}
                      <span className="font-medium">{t.initialAnswers[q.id]}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          {destinationQuestion && (
            <Card
              title="Receiving facility"
              description="Change this to update the Process Cards and notification requirements below."
              actions={
                <Button
                  size="sm"
                  variant={editingDest ? 'secondary' : 'ghost'}
                  onClick={() => setEditingDest((v) => !v)}
                >
                  {editingDest ? 'Done' : 'Change'}
                </Button>
              }
            >
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-slate-500">Currently:</span>{' '}
                  <span className="font-medium text-slate-800">
                    {t.destFacility?.name ?? '—'}
                  </span>
                </div>
                {editingDest && (
                  <div className="pt-2 border-t border-slate-200">
                    <QuestionRenderer
                      key={destinationQuestion.id}
                      question={destinationQuestion}
                      answers={t.answers}
                      setAnswer={t.setAnswer}
                      callTypeId={t.callTypeId}
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          {t.acQueue.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-500">
                No service/destination was selected. The Action Card below still applies.
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
                const steps = t.getActiveCardSteps(item.svcId, t.callTypeId, item.destFacId);
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
                    {steps.length > 0 ? (
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        {steps.map((s) => (
                          <li key={s.id}>{s.text}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-xs text-slate-400">No steps configured.</div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Card title="Action Card">
            {t.activeProcessSteps.length === 0 ? (
              <div className="text-sm text-slate-400">None configured for this call type.</div>
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

        {/* Right column (1/3) — Reference + process card lookups */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4 space-y-4">
            <Card
              title="Reference cards"
              description="Quick lookup"
              actions={
                <Button size="sm" variant="ghost" onClick={() => setRefOpen('')}>
                  Clear
                </Button>
              }
            >
              <Combobox
                options={refOptions}
                value={refOpen}
                onChange={setRefOpen}
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

            <ProcessCardLookup
              key={t.callTypeId}
              callTypeId={t.callTypeId}
              getActiveCardSteps={t.getActiveCardSteps}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={completeCase}>Complete case</Button>
      </div>

      <CaseEventLog events={t.events} />
    </div>
  );
}
