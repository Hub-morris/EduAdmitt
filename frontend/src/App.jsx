import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PageLoader from './components/PageLoader';
import ChangePasswordModal from './components/ChangePasswordModal';

const LandingPage = lazy(() => import('./pages/student/LandingPage'));
const ProgrammesPage = lazy(() => import('./pages/student/ProgrammesPage'));
const ProgrammeDetailPage = lazy(() => import('./pages/student/ProgrammeDetailPage'));
const SelectionPage = lazy(() => import('./pages/student/SelectionPage'));
const LoginPage = lazy(() => import('./pages/student/LoginPage'));
const RegisterPage = lazy(() => import('./pages/student/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/student/ForgotPasswordPage'));
const ApplicationPage = lazy(() => import('./pages/student/ApplicationPage'));
const StatusPage = lazy(() => import('./pages/student/StatusPage'));
const OfferLetterPage = lazy(() => import('./pages/student/OfferLetterPage'));
const AboutPage = lazy(() => import('./pages/student/AboutPage'));

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const VerifyApplication = lazy(() => import('./pages/admin/VerifyApplication'));
const QualificationCheck = lazy(() => import('./pages/admin/QualificationCheck'));
const AdmissionOffer = lazy(() => import('./pages/admin/AdmissionOffer'));
const ManageProgrammes = lazy(() => import('./pages/admin/ManageProgrammes'));
const ManageDepartments = lazy(() => import('./pages/admin/ManageDepartments'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageApplications = lazy(() => import('./pages/admin/ManageApplications'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader fullScreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/programmes" element={<ProgrammesPage />} />
        <Route path="/programmes/:id" element={<ProgrammeDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/select" element={<ProtectedRoute role="student"><SelectionPage /></ProtectedRoute>} />
        <Route path="/apply" element={<ProtectedRoute role="student"><ApplicationPage /></ProtectedRoute>} />
        <Route path="/status" element={<ProtectedRoute role="student"><StatusPage /></ProtectedRoute>} />
        <Route path="/offer-letter" element={<ProtectedRoute role="student"><OfferLetterPage /></ProtectedRoute>} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/verify/:id" element={<ProtectedRoute role="admin"><VerifyApplication /></ProtectedRoute>} />
        <Route path="/admin/qualify/:id" element={<ProtectedRoute role="admin"><QualificationCheck /></ProtectedRoute>} />
        <Route path="/admin/admit/:id" element={<ProtectedRoute role="admin"><AdmissionOffer /></ProtectedRoute>} />
        <Route path="/admin/programmes" element={<ProtectedRoute role="admin"><ManageProgrammes /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute role="admin"><ManageDepartments /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute role="admin"><ManageUsers /></ProtectedRoute>} />
        <Route path="/admin/applications" element={<ProtectedRoute role="admin"><ManageApplications /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute role="admin"><AdminReports /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <AuthPasswordPrompt />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AuthPasswordPrompt() {
  const { user, showChangePasswordPrompt, setShowChangePasswordPrompt, changePassword } = useAuth();
  const open = Boolean(user && showChangePasswordPrompt);

  return (
    <ChangePasswordModal
      open={open}
      onClose={() => setShowChangePasswordPrompt(false)}
      requireCurrent={true}
      onSuccess={() => setShowChangePasswordPrompt(false)}
    />
  );
}
