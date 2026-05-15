import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { AppShell } from './components/AppShell';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import { TriagePage } from './pages/Triage';
import { ResultPage } from './pages/Result';
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
import { useNotificationPoll } from './hooks/useNotificationPoll';
import './App.css';

function ShellWithPolling() {
  useNotificationPoll();
  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminHomePage />
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
