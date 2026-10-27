import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Teams from './pages/Teams.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import { Accounts, LeadsPage, TasksPage, CustomersPage, AdmissionsPage, InvoicesPage, ActivityPage } from './pages/modules.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import { Spinner } from './ui.jsx';

function Protected({ children, allowTemp, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="pt-40"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !allowTemp) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
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
