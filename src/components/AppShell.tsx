import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { signOut } from '../lib/auth';
import { Button } from './ui/Button';
import { NotificationsBell } from './notifications/NotificationsBell';
import { ChangePasswordModal } from './ChangePasswordModal';
import { cn } from '../utils/cn';

export function AppShell() {
  const session = useAppStore((s) => s.session);
  const loc = useLocation();
  const nav = useNavigate();

  const [pwOpen, setPwOpen] = useState(false);

  async function logout() {
    await signOut();
    nav('/login', { replace: true });
  }

  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={cn(
        'px-3 py-1.5 text-sm rounded-md transition-colors',
        loc.pathname.startsWith(to)
          ? 'bg-brand-700 text-white'
          : 'text-brand-100 hover:bg-brand-700/60'
      )}
    >
      {label}
    </Link>
  );

  const displayName = session
    ? session.firstName || session.lastName
      ? `${session.firstName} ${session.lastName}`.trim()
      : session.email
    : '';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-lg tracking-wide">
              BRIDGE
            </Link>
            <nav className="flex gap-1">
              {link('/triage', 'Triage')}
              {link('/process-cards', 'Process cards')}
              {link('/reference-cards', 'Reference cards')}
              {session?.role === 'admin' && link('/admin', 'Admin')}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              className="text-sm text-brand-100 hover:text-white hover:underline focus:outline-none"
              title="Change your password"
            >
              {displayName}{' '}
              <span className="text-brand-300">({session?.role})</span>
            </button>
            <Button size="sm" variant="secondary" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        <Outlet />
      </main>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
