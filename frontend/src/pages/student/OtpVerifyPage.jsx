import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import { useAuth } from '../../context/AuthContext';
import './AuthPages.css';

export default function OtpVerifyPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyOtp({ otpId: state.otpId, code, fingerprint: state.fingerprint });
      if (data?.requiresWebAuthn) {
        navigate('/webauthn', { state: { from: state.from } });
        return;
      }
      const user = data.user;
      navigate(user?.role === 'admin' ? '/admin' : state.from || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!state.otpId) {
    return (
      <div className="page-layout">
        <Navbar />
        <main className="auth-page">
          <FadeIn className="auth-card card">
            <h1>OTP Required</h1>
            <p className="auth-subtitle">Please start login again to receive a verification code.</p>
            <Link to="/login" className="btn btn-primary">Back to login</Link>
          </FadeIn>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="auth-page">
        <FadeIn className="auth-card card">
          <h1>Enter OTP</h1>
          <p className="auth-subtitle">We sent a one-time code to your email. After verifying, you may be asked to complete biometric login.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input type="text" className="form-input" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
          <p className="auth-footer">Didn't receive a code? <Link to="/login">Request again</Link></p>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}
