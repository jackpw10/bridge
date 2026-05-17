import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../utils/cn';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

export function NotificationsBell() {
  const session = useAppStore((s) => s.session);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);

  const [open, setOpen] = useState(false);

  const me = session?.userId ?? '';

  const visible = useMemo(
    () =>
      notifications
        .filter((n) => !n.deletedFor.includes(me))
        .sort((a, b) => b.ts - a.ts),
    [notifications, me]
  );

  const unacked = visible.filter(
    (n) => n.from !== me && !n.ackedBy.includes(me)
  );
  const hasUnacked = unacked.length > 0;

  async function ack(id: string) {
    // Fetch all other user IDs so we can hide the notification for them
    // (semantics: "I handled it — no need for others to act").
    const { data: profiles } = await supabase.from('profiles').select('id');
    const allOtherIds = (profiles ?? [])
      .map((p) => p.id as string)
      .filter((uid) => uid !== me);

    const next = notifications.map((n) => {
      if (n.id !== id) return n;
      const ackedBy = n.ackedBy.includes(me) ? n.ackedBy : [...n.ackedBy, me];
      const deletedFor = Array.from(new Set([...n.deletedFor, ...allOtherIds]));
      return { ...n, ackedBy, deletedFor };
    });
    setNotifications(next);
  }

  function dismiss(id: string) {
    const next = notifications.map((n) =>
      n.id !== id ? n : { ...n, deletedFor: Array.from(new Set([...n.deletedFor, me])) }
    );
    setNotifications(next);
  }

  if (!session) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-700 hover:bg-brand-600 text-white',
          hasUnacked && 'animate-pulseRed'
        )}
        aria-label="Notifications"
      >
        <span aria-hidden>🔔</span>
        {hasUnacked && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unacked.length}
          </span>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        size="lg"
      >
        {visible.length === 0 ? (
          <div className="text-sm text-slate-500">No notifications.</div>
        ) : (
          <ul className="space-y-2">
            {visible.map((n) => {
              const fromMe = n.from === me;
              const isAcked = n.ackedBy.includes(me);
              return (
                <li
                  key={n.id}
                  className={cn(
                    'p-3 border rounded-md',
                    fromMe
                      ? 'border-slate-200 bg-slate-50'
                      : isAcked
                      ? 'border-slate-200'
                      : 'border-red-300 bg-red-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{n.title}</div>
                      <div className="text-sm text-slate-600 whitespace-pre-wrap mt-1">
                        {n.body}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(n.ts).toLocaleString()}
                        {fromMe && ' · sent by you'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!fromMe && !isAcked && (
                        <Button size="sm" onClick={() => ack(n.id)}>
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismiss(n.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </>
  );
}
