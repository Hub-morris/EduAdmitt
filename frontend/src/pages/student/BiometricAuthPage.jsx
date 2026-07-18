import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import { loginBiometric } from '../../utils/webauthn';
import { useAuth } from '../../context/AuthContext';
import './AuthPages.css';

export default function BiometricAuthPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setShowChangePasswordPrompt } = useAuth();
  const from = location.state?.from || '/';

  useEffect(() => {
    async function authenticate() {
      setError('');
      setLoading(true);
      try {
        const data = await loginBiometric();
        if (data?.token) {
          localStorage.setItem('token', data.token);
          setUser(data.user);
          setShowChangePasswordPrompt(true);
          navigate(data.user?.role === 'admin' ? '/admin' : from);
        } else {
          setError('Biometric authentication failed');
        }
      } catch (err) {
        const message = err.response?.data?.error || 'Biometric authentication failed';
        setError(message);
        if (err.response?.status === 403) {
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        }
      } finally {
        setLoading(false);
      }
    }

    authenticate();
  }, [from, navigate, setShowChangePasswordPrompt, setUser]);

  return (
    <div className="page-layout">
      <Navbar />
      <main className="auth-page">
        <FadeIn className="auth-card card">
          <h1>Biometric Login</h1>
          <p className="auth-subtitle">Please complete the biometric prompt to finish signing in.</p>
          {error && <div className="alert alert-error">{error}</div>}
          {loading ? <p>Waiting for biometric verification...</p> : <p>Ready to verify.</p>}
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}
