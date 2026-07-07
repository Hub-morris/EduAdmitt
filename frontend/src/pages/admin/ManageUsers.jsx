import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api, { formatDate } from '../../api/client';
import './AdminDetailPages.css';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const loadUsers = async (page = 1) => {
    try {
      const res = await api.get('/admin/users', {
        params: { page, limit: 10 }
      });
      setUsers(Array.isArray(res.data.data) ? res.data.data : []);
      setPagination(res.data.pagination);
      setCurrentPage(page);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async () => {
    if (!confirmTarget) return;
    try {
      await api.delete(`/admin/users/${confirmTarget.id}`);
      setMessage(`User ${confirmTarget.full_name} deleted successfully.`);
      loadUsers(currentPage);
      setConfirmTarget(null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="page-title">Manage Users</h1>

      {message && <div className={`alert alert-${message.includes('success') || message.includes('deleted') ? 'success' : 'danger'}`}>{message}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {users.length > 0 ? (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Role</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Created</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{user.full_name}</td>
                    <td style={{ padding: '1rem' }}>{user.email}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${user.status === 'online' ? 'success' : user.status === 'offline' ? 'warning' : 'secondary'}`}>
                        {user.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{formatDate(user.created_at)}</td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setConfirmTarget(user)}
                        disabled={confirmTarget !== null}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', padding: '1rem' }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => loadUsers(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => loadUsers(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => loadUsers(currentPage + 1)}
                  disabled={currentPage === pagination.pages}
                >
                  Next
                </button>
                <span style={{ marginLeft: '1rem', color: 'var(--gray)' }}>
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="empty-state">No users found</p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete <strong>{confirmTarget.full_name}</strong>?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setConfirmTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
