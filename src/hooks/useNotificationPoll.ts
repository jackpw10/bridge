import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { playPing } from '../components/notifications/notifAudio';

const POLL_MS = 3000;
const REPING_MS = 10_000;

export function useNotificationPoll() {
  const session = useAppStore((s) => s.session);
  const refresh = useAppStore((s) => s.refreshNotificationsFromStorage);
  const notifications = useAppStore((s) => s.notifications);

  const lastSeenIdsRef = useRef<Set<string>>(new Set());
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    if (!session) return;
    const tick = () => refresh();
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [session, refresh]);

  useEffect(() => {
    if (!session) return;
    const me = session.userId;
    const unacked = notifications.filter(
      (n) =>
        n.from !== me &&
        !n.ackedBy.includes(me) &&
        !n.deletedFor.includes(me)
    );

    let isNew = false;
    for (const n of unacked) {
      if (!lastSeenIdsRef.current.has(n.id)) {
        lastSeenIdsRef.current.add(n.id);
        isNew = true;
      }
    }

    const now = Date.now();
    if (unacked.length > 0 && (isNew || now - lastPingRef.current >= REPING_MS)) {
      playPing();
      lastPingRef.current = now;
    }
  }, [notifications, session]);
}
