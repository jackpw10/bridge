import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { AppShell } from './components/AppShell';
import { initAuth } from './store/appStore';
import { useAppStore } from './store/appStore';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import { TriagePage } from './pages/Triage';
import { ResultPage } from './pages/Result';
import { ProcessCardsPage } from './pages/ProcessCards';
import { ReferenceCardsPage } from './pages/ReferenceCards';
import { AdminHomePage } from './pages/admin/AdminHome';
import { AdminWorkflowPage } from './pages/admin/AdminWorkflow';
import { AdminFacilitiesPage } from './pages/admin/AdminFacilities';
import { AdminFacilityDetailPage } from './pages/admin/AdminFacilityDetail';
import { AdminSpecialtyPage } from './pages/admin/AdminSpecialty';
import { AdminSpecialtyDetailPage } from './pages/admin/AdminSpecialtyDetail';
import { AdminDiagnosesPage } from './pages/admin/AdminDiagnoses';
import { AdminProcessStepsPage } from './pages/admin/AdminProcessSteps';
import { AdminReasonsPage } from './pages/admin/AdminReasons';
import { AdminReferenceCardsPage } from './pages/admin/AdminReferenceCards';
import { AdminUsersPage } from './pages/admin/AdminUsers';
import { AdminHealthAuthoritiesPage } from './pages/admin/AdminHealthAuthorities';
import { useNotificationPoll } from './hooks/useNotificationPoll';
import './App.css';

function ShellWithPolling() {
  useNotificationPoll();
  return <AppShell />;
}

function BootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
      <div className="text-center">
        <div className="text-3xl font-bold text-slate-800 mb-2">BRIDGE</div>
        <div className="text-sm">Loading…</div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-800 p-6">
      <div className="max-w-md">
        <h1 className="text-xl font-bold mb-2">Couldn't connect to the backend</h1>
        <p className="text-sm mb-2">{message}</p>
        <p className="text-xs text-red-600">
          Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, that
          the Supabase project is reachable, and that the schema has been
          applied.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    initAuth();
  }, []);

  if (error) return <ErrorScreen message={error} />;
  if (loading) return <BootScreen />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <RequireAuth>
            <ShellWithPolling />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/triage" replace />} />
        <Route path="/triage" element={<TriagePage />} />
        <Route path="/triage/result" element={<ResultPage />} />
        <Route path="/process-cards" element={<ProcessCardsPage />} />
        <Route path="/reference-cards" element={<ReferenceCardsPage />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminHomePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/health-authorities"
          element={
            <RequireAdmin>
              <AdminHealthAuthoritiesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/workflow"
          element={
            <RequireAdmin>
              <AdminWorkflowPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/facilities"
          element={
            <RequireAdmin>
              <AdminFacilitiesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/facilities/:id"
          element={
            <RequireAdmin>
              <AdminFacilityDetailPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/specialty"
          element={
            <RequireAdmin>
              <AdminSpecialtyPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/specialty/:id"
          element={
            <RequireAdmin>
              <AdminSpecialtyDetailPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/diagnoses"
          element={
            <RequireAdmin>
              <AdminDiagnosesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/process-steps"
          element={
            <RequireAdmin>
              <AdminProcessStepsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/reasons"
          element={
            <RequireAdmin>
              <AdminReasonsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/reference-cards"
          element={
            <RequireAdmin>
              <AdminReferenceCardsPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
