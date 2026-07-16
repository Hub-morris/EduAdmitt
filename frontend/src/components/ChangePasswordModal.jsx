import { useState } from 'react';
import api from '../api/client';
import './ChangePasswordModal.css';

export default function ChangePasswordModal({ open, onClose, requireCurrent = true, onSuccess }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPass) return setError('Enter a new password');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: requireCurrent ? current : undefined, newPassword: newPass });
      setLoading(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  return (
    <div className="cp-modal-overlay">
      <div className="cp-modal">
        <h3>Change Password</h3>
        <p>For your security we recommend changing your password regularly.</p>
        <form onSubmit={handleSubmit}>
          {requireCurrent && (
            <div className="form-group">
              <label>Current password</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="form-input" />
            </div>
          )}
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="form-input" required minLength={6} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
