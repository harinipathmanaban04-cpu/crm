import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import { Spinner } from './ui.jsx';

// Lazy-load protected workspace views to drastically speed up initial page load and login render
const Layout = lazy(() => import('./Layout.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Teams = lazy(() => import('./pages/Teams.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail.jsx'));

// Lazy load module views from modules.jsx
const Accounts = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.Accounts })));
const LeadsPage = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.LeadsPage })));
const TasksPage = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.TasksPage })));
const CustomersPage = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.CustomersPage })));
const AdmissionsPage = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.AdmissionsPage })));
const InvoicesPage = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.InvoicesPage })));
const ActivityPage = lazy(() => import('./pages/modules.jsx').then((m) => ({ default: m.ActivityPage })));

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
      <Spinner />
    </div>
  );
}

function Protected({ children, allowTemp, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #EDFAFA 0%, #ffffff 50%, #FFF3F0 100%)' }}>
        <Spinner />
        <p className="mt-3 text-xs font-medium text-gray-500 animate-pulse">Initializing CRM workspace…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !allowTemp) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<Protected allowTemp><ChangePassword /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<Protected roles={['superadmin']}><Accounts /></Protected>} />
        <Route path="teams" element={<Protected roles={['superadmin', 'admin']}><Teams /></Protected>} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="followups" element={<LeadsPage mode="followups" />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="admissions" element={<AdmissionsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="activity" element={<Protected roles={['superadmin', 'admin']}><ActivityPage /></Protected>} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
