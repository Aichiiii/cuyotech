import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import { Empty, Loading } from './components/ui';
import { ShieldAlert } from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/shared/Notifications';
import Account from './pages/shared/Account';
import ClearanceQueue from './pages/shared/ClearanceQueue';
import PrintCor from './pages/shared/PrintCor';
import PrintReceipt from './pages/shared/PrintReceipt';

import Profile from './pages/student/Profile';
import Subjects from './pages/student/Subjects';
import Grades from './pages/student/Grades';
import Enrollment from './pages/student/Enrollment';
import Documents from './pages/student/Documents';
import Clearance from './pages/student/Clearance';
import StudentPayments from './pages/student/Payments';

import EnrollmentReview from './pages/registrar/EnrollmentReview';
import GradeEncoding from './pages/registrar/GradeEncoding';
import DocumentRequests from './pages/registrar/DocumentRequests';

import PaymentVerification from './pages/cashier/PaymentVerification';
import Receipts from './pages/cashier/Receipts';

import Courses from './pages/department/Courses';

import Users from './pages/admin/Users';
import Roles from './pages/admin/Roles';
import Policies from './pages/admin/Policies';
import AuditLogs from './pages/admin/AuditLogs';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading text="Starting CuyoTech SSIS…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Page-level permission guard (the API enforces the same rules server-side). */
function Perm({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return <Empty icon={ShieldAlert} title="Access denied" text="Your account role is not authorized to open this page." />;
  }
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/print/cor/:id" element={<RequireAuth><PrintCor /></RequireAuth>} />
      <Route path="/print/receipt/:id" element={<RequireAuth><PrintReceipt /></RequireAuth>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="account" element={<Account />} />

        <Route path="student/profile" element={<Perm perm="portal.access"><Profile /></Perm>} />
        <Route path="student/subjects" element={<Perm perm="portal.access"><Subjects /></Perm>} />
        <Route path="student/grades" element={<Perm perm="portal.access"><Grades /></Perm>} />
        <Route path="student/enrollment" element={<Perm perm="enrollment.submit"><Enrollment /></Perm>} />
        <Route path="student/documents" element={<Perm perm="documents.request"><Documents /></Perm>} />
        <Route path="student/clearance" element={<Perm perm="clearance.request"><Clearance /></Perm>} />
        <Route path="student/payments" element={<Perm perm="payments.submit"><StudentPayments /></Perm>} />

        <Route path="registrar/enrollments" element={<Perm perm="enrollment.review"><EnrollmentReview /></Perm>} />
        <Route path="registrar/grades" element={<Perm perm="grades.encode"><GradeEncoding /></Perm>} />
        <Route path="registrar/documents" element={<Perm perm="documents.review"><DocumentRequests /></Perm>} />

        <Route path="cashier/payments" element={<Perm perm="payments.verify"><PaymentVerification /></Perm>} />
        <Route path="cashier/receipts" element={<Perm perm="payments.verify"><Receipts /></Perm>} />

        <Route path="department/courses" element={<Perm perm="courses.manage"><Courses /></Perm>} />
        <Route path="clearance" element={<Perm perm="clearance.decide"><ClearanceQueue /></Perm>} />

        <Route path="admin/users" element={<Perm perm="users.manage"><Users /></Perm>} />
        <Route path="admin/roles" element={<Perm perm="roles.manage"><Roles /></Perm>} />
        <Route path="admin/policies" element={<Perm perm="policies.manage"><Policies /></Perm>} />
        <Route path="admin/audit" element={<Perm perm="audit.view"><AuditLogs /></Perm>} />

        <Route path="*" element={<Empty title="Page not found" text="The page you are looking for does not exist." />} />
      </Route>
    </Routes>
  );
}
