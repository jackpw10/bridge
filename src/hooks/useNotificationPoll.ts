// Notifications now arrive via Supabase realtime — the channel subscription
// in appStore mutates `notifications` directly. This hook is still responsible
// for playing the audio ping when an unacknowledged notification appears.
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { playPing } from '../components/notifications/notifAudio';

const REPING_MS = 10_000;

export function useNotificationPoll() {
  const session = useAppStore((s) => s.session);
  const notifications = useAppStore((s) => s.notifications);

  const lastSeenIdsRef = useRef<Set<string>>(new Set());
  const lastPingRef = useRef<number>(0);

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
