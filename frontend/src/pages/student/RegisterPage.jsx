import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import { useAuth } from '../../context/AuthContext';
import './AuthPages.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedPassword, setSuggestedPassword] = useState('');
  const [showSuggestedPassword, setShowSuggestedPassword] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(form.email, form.password, form.fullName);
      navigate('/programmes');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const generateStrongPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setSuggestedPassword(pw);
    setShowSuggestedPassword(true);
    setPasswordVisible(false);
    setForm((s) => ({ ...s, password: pw, confirm: pw }));
    navigator.clipboard?.writeText(pw).catch(() => {});
  };

  return (
    <div className="page-layout">
      <Navbar />
      <main className="auth-page">
        <FadeIn className="auth-card card">
          <h1>Create Account</h1>
          <p className="auth-subtitle">Register to start your admission application</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input name="fullName" className="form-input" value={form.fullName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input name="email" type="email" className="form-input" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  className="form-input"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
                <button type="button" className="btn btn-secondary" onClick={generateStrongPassword}>Suggest</button>
              </div>
              {suggestedPassword && showSuggestedPassword && (
                <div className="suggested-password-box" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', flex: '1 1 auto' }}>
                    {passwordVisible ? suggestedPassword : '••••••••••••'}
                  </span>
                  <button type="button" className="btn btn-secondary" onClick={() => setPasswordVisible((v) => !v)}>
                    {passwordVisible ? 'Hide' : 'View'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={generateStrongPassword}>New Suggestion</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input name="confirm" type="password" className="form-input" value={form.confirm} onChange={handleChange} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <p className="auth-footer">Already have an account? <Link to="/login">Login</Link></p>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}
