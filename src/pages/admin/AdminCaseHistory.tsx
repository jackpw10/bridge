import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { CaseEvent, CaseSummary } from '../../types';

interface CaseRow {
  id: string;
  actor: string;
  workflow_name: string;
  call_type_name: string;
  started_at: number;
  ended_at: number | null;
}
interface EventRow {
  id: string;
  case_id: string;
  actor: string;
  ts: number;
  event_type: string;
  summary: string;
  detail: Record<string, unknown>;
}

function summaryFromRow(r: CaseRow): CaseSummary {
  return {
    id: r.id,
    actor: r.actor,
    workflowId: null,
    workflowName: r.workflow_name ?? '',
    callTypeId: null,
    callTypeName: r.call_type_name ?? '',
    startedAt: Number(r.started_at),
    endedAt: r.ended_at == null ? null : Number(r.ended_at),
  };
}
function eventFromRow(r: EventRow): CaseEvent {
  return {
    id: r.id,
    caseId: r.case_id,
    actor: r.actor,
    ts: Number(r.ts),
    eventType: r.event_type,
    summary: r.summary,
    detail: r.detail ?? {},
  };
}

// Live-updating admin case history.
export function AdminCaseHistoryPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Initial load of cases (most recent first).
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(200);
      if (error) { setLoadErr(error.message); return; }
      const rows = ((data ?? []) as CaseRow[]).map(summaryFromRow);
      setCases(rows);
      if (rows.length && !selected) setSelected(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: refetch the cases list on any change so ended_at flips light up.
  useEffect(() => {
    const ch = supabase
      .channel('admin_cases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, async () => {
        const { data } = await supabase
          .from('cases')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(200);
        setCases(((data ?? []) as CaseRow[]).map(summaryFromRow));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Load events for the selected case + subscribe to updates.
  useEffect(() => {
    if (!selected) { setEvents([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('case_events')
        .select('*')
        .eq('case_id', selected)
        .order('ts', { ascending: true });
      if (!cancelled) {
        setEvents(((data ?? []) as EventRow[]).map(eventFromRow));
      }
    })();
    const ch = supabase
      .channel(`admin_case_events_${selected}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'case_events', filter: `case_id=eq.${selected}` },
        (payload) => {
          setEvents((cur) => [...cur, eventFromRow(payload.new as EventRow)]);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [selected]);

  const active = useMemo(() => cases.filter((c) => c.endedAt == null), [cases]);
  const closed = useMemo(() => cases.filter((c) => c.endedAt != null), [cases]);

  const selectedCase = cases.find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
        <h1 className="text-2xl font-bold text-slate-800">Case history</h1>
        <p className="text-sm text-slate-500">
          Every action from every triage case, streamed live. Active cases
          appear at the top; closed cases below.
        </p>
      </div>

      {loadErr && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {loadErr}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card title={`Active (${active.length})`} description="Cases in progress">
            <CaseList list={active} selected={selected} onSelect={setSelected} />
          </Card>
          <Card title={`Closed (${closed.length})`} description="Recently completed">
            <CaseList list={closed} selected={selected} onSelect={setSelected} />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title={selectedCase ? `Timeline — ${selectedCase.callTypeName || selectedCase.workflowName}` : 'Timeline'}
            description={selectedCase ? `Started ${formatDateTime(selectedCase.startedAt)}${selectedCase.endedAt ? ` · Ended ${formatDateTime(selectedCase.endedAt)}` : ' · Active'}` : 'Pick a case on the left'}
          >
            {events.length === 0 ? (
              <div className="text-sm text-slate-400">No events yet.</div>
            ) : (
              <ol className="text-xs font-mono space-y-1 max-h-[70vh] overflow-y-auto">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {formatTime(e.ts)}
                    </span>
                    <span className="text-slate-400 shrink-0 uppercase text-[10px] tracking-wider mt-[2px]">
                      {e.eventType}
                    </span>
                    <span className="text-slate-700 whitespace-pre-wrap break-words">
                      {e.summary}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CaseList({
  list,
  selected,
  onSelect,
}: {
  list: CaseSummary[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (list.length === 0) {
    return <div className="text-xs text-slate-400 py-2">Nothing here.</div>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {list.map((c) => {
        const isSel = c.id === selected;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-2 py-2 rounded text-sm ${isSel ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <div className="font-medium flex items-center gap-2">
                <span>{c.callTypeName || c.workflowName || 'Unknown call type'}</span>
                {c.endedAt == null && <Badge tone="green">live</Badge>}
              </div>
              <div className="text-xs text-slate-500">
                {formatDateTime(c.startedAt)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {c.actor}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString();
}
