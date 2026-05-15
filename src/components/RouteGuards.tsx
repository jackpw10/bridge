import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAppStore } from '../store/appStore';

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAppStore((s) => s.session);
  const loc = useLocation();
  if (!session) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const session = useAppStore((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== 'admin') return <Navigate to="/triage" replace />;
  return <>{children}</>;
}
