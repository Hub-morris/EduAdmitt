import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import api, { formatDate, STATUS_LABELS } from '../../api/client';
import './AdminDetailPages.css';

export default function ManageApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const loadApplications = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/applications', { params: { page, limit: 10 } });
      setApplications(Array.isArray(res.data.data) ? res.data.data : []);
      setPagination(res.data.pagination);
      setCurrentPage(page);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Unable to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="page-title">Applications</h1>

      {message && <div className={`alert alert-${message.includes('success') ? 'success' : 'danger'}`}>{message}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {applications.length > 0 ? (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Applicant</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Programme</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>KCSE Grade</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Submitted</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{app.full_name}</td>
                    <td style={{ padding: '1rem' }}>{app.email}</td>
                    <td style={{ padding: '1rem' }}>{app.programme_name}</td>
                    <td style={{ padding: '1rem' }}>{app.kcse_grade || '—'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${app.verification_status === 'verified' ? 'success' : app.verification_status === 'pending' ? 'warning' : 'secondary'}`}>
                        {STATUS_LABELS[app.verification_status] || app.verification_status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{formatDate(app.submitted_at)}</td>
                    <td style={{ padding: '1rem' }}>
                      <Link to={`/admin/verify/${app.id}`} className="btn btn-sm btn-primary">View</Link>
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
                  onClick={() => loadApplications(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => loadApplications(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => loadApplications(currentPage + 1)}
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
          <p className="empty-state">No applications found</p>
        )}
      </div>
    </AdminLayout>
  );
}
