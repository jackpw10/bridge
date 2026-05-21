import { useEffect, useRef } from 'react';
import type { WorkflowQuestion } from '../../types';
import { useAppStore } from '../../store/appStore';
import { Input } from '../ui/Input';
import { Combobox, type ComboboxHandle } from '../ui/Combobox';
import { MultiSelect } from '../ui/MultiSelect';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface Props {
  question: WorkflowQuestion;
  answers: Record<string, string>;
  setAnswer: (qid: string, value: string, subKeys?: Record<string, string>) => void;
  // The case's call type — used to filter specialty-service options to the
  // services enabled for this call type.
  callTypeId?: string;
  // When provided, picking a dropdown option auto-advances to the next
  // question (Initial Triage Questions only).
  onAdvance?: () => void;
}

export function QuestionRenderer({ question, answers, setAnswer, callTypeId, onAdvance }: Props) {
  const facilities = useAppStore((s) => s.facilities);
  const specialty = useAppStore((s) => s.specialty);
  const diagnoses = useAppStore((s) => s.diagnoses);
  const reasons = useAppStore((s) => s.reasons);
  const has = useAppStore((s) => s.healthAuthorities);
  const haName = (id: string) => has.find((h) => h.id === id)?.name ?? '';

  const value = answers[question.id] ?? '';

  // Explicit focus on mount for the text input — the `autoFocus` attribute is
  // unreliable when the previous question's element still held focus at the
  // moment React commits the new tree. We focus via ref + a microtask to
  // guarantee the element exists and is interactable.
  const inputRef = useRef<HTMLInputElement>(null);
  // The override "Reason" picker — focused after the user picks a custom
  // destination, so the keyboard flow chains facility → reason → next.
  const reasonComboRef = useRef<ComboboxHandle>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // Referral question hotkeys: 1/2/3 pick a default destination, O opens the
  // override flow and drops the cursor into the facility picker. No deps array
  // so the closure (answers/facilities) stays fresh each render. Ignored while
  // the user is typing in a field.
  useEffect(() => {
    if (question.type !== 'referral_resolve') return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const facAnsKey = Object.keys(answers).find((k) => k.endsWith('__facid'));
      const facId = facAnsKey ? answers[facAnsKey] : '';
      const fac = facilities.find((f) => f.id === facId) ?? null;
      const svcKey = Object.keys(answers).find((k) => k.endsWith('__svcs'));
      let svcIds: string[] = [];
      try { svcIds = svcKey ? (JSON.parse(answers[svcKey]) as string[]) : []; } catch { svcIds = []; }
      const primarySvcId = svcIds[0];
      const pattern = fac && primarySvcId ? fac.referralPatterns[primarySvcId] : undefined;

      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = Number(e.key) - 1;
        const destId = pattern?.[(['d1', 'd2', 'd3'] as const)[idx]];
        if (destId) {
          e.preventDefault();
          const destName = facilities.find((f) => f.id === destId)?.name ?? '';
          setAnswer(question.id, `Default destination ${idx + 1}: ${destName}`, {
            choice: destId,
            customfacid: '',
            reasonid: '',
          });
        }
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setAnswer(question.id, 'Custom destination', {
          choice: '__custom__',
          customfacid: answers[`${question.id}__customfacid`] ?? '',
          reasonid: answers[`${question.id}__reasonid`] ?? '',
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (question.type === 'yesno' || question.type === 'triage') {
    const opts: Array<{ value: 'Yes' | 'No'; hotkey: 'Y' | 'N'; rest: string }> = [
      { value: 'Yes', hotkey: 'Y', rest: 'es' },
      { value: 'No', hotkey: 'N', rest: 'o' },
    ];
    return (
      <div className="flex gap-2">
        {opts.map((o) => (
          <Button
            key={o.value}
            variant={value === o.value ? 'primary' : 'secondary'}
            onClick={() => {
              setAnswer(question.id, o.value);
              if (onAdvance) onAdvance();
            }}
          >
            ({o.hotkey}){o.rest}
          </Button>
        ))}
        {question.type === 'triage' && (
          <span className="text-xs text-slate-500 self-center ml-2">
            Yes → LLTO · No → HLOC
          </span>
        )}
      </div>
    );
  }

  if (question.type === 'dropdown') {
    // Numbered type-to-filter combobox: shows the first 9 matches as 1-9,
    // a digit (or Enter) picks one and auto-advances.
    const opts = (question.options ?? []).map((o) => ({ value: o.label, label: o.label }));
    return (
      <Combobox
        autoFocus
        numbered
        options={opts}
        value={value}
        placeholder="Type to filter…"
        onChange={(v) => {
          setAnswer(question.id, v);
          if (v && onAdvance) onAdvance();
        }}
      />
    );
  }

  if (question.type === 'text') {
    return (
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setAnswer(question.id, e.target.value)}
        placeholder="Type here…"
      />
    );
  }

  if (question.type === 'facility' || question.type === 'receiving_facility') {
    const opts = facilities.map((f) => ({ value: f.id, label: f.name, meta: haName(f.healthAuthorityId) }));
    const facId = answers[`${question.id}__facid`] ?? '';
    const freeText = answers[`${question.id}__freetext`] ?? '';
    return (
      <div className="space-y-2">
        <Combobox
          autoFocus
          numbered
          options={opts}
          value={facId}
          onChange={(v) => {
            const lbl = facilities.find((f) => f.id === v)?.name ?? '';
            setAnswer(question.id, lbl || freeText, { facid: v, freetext: v ? '' : freeText });
            // Picking a facility from the list auto-advances; typing free text
            // (handled by the Input below) does not.
            if (v && onAdvance) onAdvance();
          }}
          placeholder="Search facilities…"
        />
        {question.allowFreeText && (
          <Input
            placeholder="Or type an address / facility name…"
            value={freeText}
            onChange={(e) =>
              setAnswer(question.id, e.target.value || facilities.find((f) => f.id === facId)?.name || '', {
                facid: e.target.value ? '' : facId,
                freetext: e.target.value,
              })
            }
          />
        )}
      </div>
    );
  }

  if (question.type === 'specialty_multi') {
    // Only offer services enabled for this case's call type / workflow.
    const available = callTypeId
      ? specialty.filter((s) => (s.enabledCallTypeIds ?? []).includes(callTypeId))
      : specialty;
    const opts = available.map((s) => ({ value: s.id, label: s.name }));
    const svcs: string[] = (() => {
      const raw = answers[`${question.id}__svcs`];
      try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
    })();
    return (
      <MultiSelect
        autoFocus
        options={opts}
        value={svcs}
        onChange={(v) => {
          const lbl = v
            .map((id) => specialty.find((s) => s.id === id)?.name ?? id)
            .join(', ');
          setAnswer(question.id, lbl, { svcs: JSON.stringify(v) });
        }}
      />
    );
  }

  if (question.type === 'diagnosis_multi') {
    const opts = diagnoses.map((d) => ({ value: d.id, label: d.text }));
    const dxs: string[] = (() => {
      const raw = answers[`${question.id}__dxs`];
      try { return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
    })();
    return (
      <MultiSelect
        autoFocus
        allowCreate
        options={opts}
        value={dxs}
        onChange={(v) => {
          // Free-text entries are stored as the raw string; the `?? id`
          // fallback renders them as-is since they have no diagnosis record.
          const lbl = v.map((id) => diagnoses.find((d) => d.id === id)?.text ?? id).join(', ');
          setAnswer(question.id, lbl, { dxs: JSON.stringify(v) });
        }}
      />
    );
  }

  if (question.type === 'referral_resolve') {
    // Find the most recent facility + specialty answers from the answers map.
    const facAnsKey = Object.keys(answers).find((k) => k.endsWith('__facid'));
    const facId = facAnsKey ? answers[facAnsKey] : '';
    const fac = facilities.find((f) => f.id === facId) ?? null;
    const svcKey = Object.keys(answers).find((k) => k.endsWith('__svcs'));
    let svcIds: string[] = [];
    try {
      svcIds = svcKey ? (JSON.parse(answers[svcKey]) as string[]) : [];
    } catch {
      svcIds = [];
    }
    const primarySvcId = svcIds[0];
    const pattern = fac && primarySvcId ? fac.referralPatterns[primarySvcId] : undefined;

    const choice = answers[`${question.id}__choice`] ?? '';
    const customId = answers[`${question.id}__customfacid`] ?? '';
    const reasonId = answers[`${question.id}__reasonid`] ?? '';

    const onChooseDefault = (destId: string, idx: number) => {
      const destName = facilities.find((f) => f.id === destId)?.name ?? '';
      setAnswer(question.id, `Default destination ${idx + 1}: ${destName}`, {
        choice: destId,
        customfacid: '',
        reasonid: '',
      });
    };

    const filteredCandidates = primarySvcId
      ? facilities
          .filter((f) => f.id !== facId && f.onSiteServiceIds.includes(primarySvcId))
          .map((f) => ({ value: f.id, label: f.name, meta: haName(f.healthAuthorityId) }))
      : facilities.map((f) => ({ value: f.id, label: f.name, meta: haName(f.healthAuthorityId) }));

    return (
      <div className="space-y-3">
        {!pattern && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            No referral pattern defined for this sending facility / primary service. Choose a destination manually.
          </div>
        )}
        {pattern && (
          <div className="flex flex-col gap-2">
            {(['d1','d2','d3'] as const).map((k, idx) => {
              const destId = pattern[k];
              if (!destId) return null;
              const destName = facilities.find((f) => f.id === destId)?.name ?? '—';
              const isChosen = choice === destId;
              return (
                <Button
                  key={k}
                  variant={isChosen ? 'primary' : 'secondary'}
                  onClick={() => onChooseDefault(destId, idx)}
                >
                  Use destination {idx + 1}: {destName}
                </Button>
              );
            })}
          </div>
        )}

        <div className="border-t pt-3 space-y-2">
          <Button
            variant={choice === '__custom__' ? 'primary' : 'secondary'}
            onClick={() => {
              setAnswer(question.id, 'Custom destination', {
                choice: '__custom__',
                customfacid: customId,
                reasonid: reasonId,
              });
            }}
          >
            Override / choose another facility
          </Button>
          {choice === '__custom__' && (
            <div className="space-y-2">
              <Combobox
                label="Custom destination"
                autoFocus
                numbered
                options={filteredCandidates}
                value={customId}
                onChange={(v) => {
                  const destName = facilities.find((f) => f.id === v)?.name ?? '';
                  setAnswer(question.id, `Custom: ${destName}`, {
                    choice: '__custom__',
                    customfacid: v,
                    reasonid: reasonId,
                  });
                  // Chain focus to the reason picker once a site is chosen —
                  // focusing the combobox opens its dropdown so the user can
                  // arrow + Enter through the reasons.
                  if (v) window.setTimeout(() => reasonComboRef.current?.focus(), 0);
                }}
              />
              <Combobox
                ref={reasonComboRef}
                label="Reason for override"
                numbered
                value={reasonId}
                options={reasons.map((r) => ({ value: r.id, label: r.text }))}
                placeholder="Pick a reason…"
                onChange={(v) => {
                  setAnswer(question.id, `Custom (override)`, {
                    choice: '__custom__',
                    customfacid: customId,
                    reasonid: v,
                  });
                }}
              />
            </div>
          )}
        </div>
        {value && <Badge tone="blue">{value}</Badge>}
      </div>
    );
  }

  return <Input value={value} onChange={(e) => setAnswer(question.id, e.target.value)} />;
}
