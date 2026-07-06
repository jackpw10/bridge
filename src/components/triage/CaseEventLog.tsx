import type { CaseEvent } from '../../types';
import { Card } from '../ui/Card';

interface Props {
  events: CaseEvent[];
  title?: string;
  description?: string;
}

// Compact live log of user actions for the current case. Shown at the
// bottom of the triage / result / new-case screens for now — can be hidden
// or removed later without affecting behaviour.
export function CaseEventLog({
  events,
  title = 'Case action log',
  description = 'Every action you take is timestamped and audited.',
}: Props) {
  if (events.length === 0) return null;
  return (
    <Card title={title} description={description}>
      <ol className="text-xs font-mono space-y-1 max-h-64 overflow-y-auto">
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
    </Card>
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
