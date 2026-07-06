import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import { useAuth } from '../../context/AuthContext';
import './AdminLoginPage.css';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('admin@eduadmit.ac.ke');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role !== 'admin') {
        setError('Admin access required');
        return;
      }
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <FadeIn className="admin-login-card card">
        <div className="admin-login-header">
          <span className="brand-icon">E</span>
          <h1>Admin Login</h1>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Login to Admin Panel'}
          </button>
        </form>
      </FadeIn>
    </div>
  );
}
