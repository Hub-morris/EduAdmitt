import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminLayout from '../../components/AdminLayout';
import FadeIn from '../../components/FadeIn';
import api, { STATUS_LABELS, formatDate } from '../../api/client';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/applications'),
      api.get('/admin/payments'),
      api.get('/admin/users'),
    ])
      .then(([dashRes, appsRes, paymentsRes, usersRes]) => {
        if (!isMounted) return;
        setData(dashRes.data);
        setApplications(appsRes.data);
        setPayments(paymentsRes.data);
        setUsers(usersRes.data);
        setError('');
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Unable to load the admin dashboard right now.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = data?.stats || {};
  const paymentStats = data?.paymentStats || {};

  const chartData = (data?.timeline || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
    applications: parseInt(d.count),
  }));

  const getActionLink = (app) => {
    if (app.verification_status === 'pending') return `/admin/verify/${app.id}`;
    if (app.qualification_status === 'pending' && app.verification_status === 'verified') return `/admin/qualify/${app.id}`;
    if (app.qualification_status === 'qualified' && app.admission_status !== 'admitted') return `/admin/admit/${app.id}`;
    return null;
  };

  const handlePaymentAction = async (paymentId, action) => {
    const reason = action === 'reject' ? window.prompt('Enter the reason for rejecting this payment:') : '';
    if (action === 'reject' && reason === null) return;

    try {
      const endpoint = action === 'approve' ? `/admin/payments/${paymentId}/approve` : `/admin/payments/${paymentId}/reject`;
      await api.patch(endpoint, action === 'reject' ? { reason } : {});
      setPayments((prev) => prev.map((payment) => payment.id === paymentId ? {
        ...payment,
        status: action === 'approve' ? 'completed' : 'failed',
        rejection_reason: action === 'reject' ? reason : null,
      } : payment));
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update payment status.');
    }
  };

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;

  if (error) {
    return (
      <AdminLayout>
        <FadeIn>
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.75rem', color: 'var(--primary-dark)' }}>Dashboard unavailable</h2>
            <p style={{ color: 'var(--gray)' }}>{error}</p>
            <p style={{ marginTop: '0.75rem', color: 'var(--gray)' }}>Please sign in again as an admin or verify that the backend is running.</p>
          </div>
        </FadeIn>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <FadeIn>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of admission applications</p>
      </FadeIn>

      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        {[
          { label: 'Total Applications', value: stats.total, class: 'blue' },
          { label: 'Under Verification', value: stats.under_verification, class: 'orange' },
          { label: 'Qualified', value: stats.qualified, class: 'green' },
          { label: 'Admitted', value: stats.admitted, class: 'purple' },
        ].map((s, i) => (
          <motion.div key={s.label} className={`stat-card ${s.class}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <div className="stat-value">{s.value || 0}</div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        {[
          { label: 'Total Payments', value: paymentStats.total_payments, class: 'blue' },
          { label: 'Completed', value: paymentStats.completed, class: 'green' },
          { label: 'Pending', value: paymentStats.pending, class: 'orange' },
          { label: 'Failed', value: paymentStats.failed, class: 'red' },
        ].map((s, i) => (
          <motion.div key={s.label} className={`stat-card ${s.class}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 4) * 0.1 }}>
            <div className="stat-value">{s.value || 0}</div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ color: 'var(--gray)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Amount Collected</p>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-dark)' }}>
                KES {Number(paymentStats.total_collected || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ color: 'var(--gray)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Amount Expected</p>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-dark)' }}>
                KES {Number(paymentStats.total_amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        {[
          { label: 'Today Payments', value: paymentStats.today_payments, class: 'blue' },
          { label: 'Today Amount', value: paymentStats.today_amount, class: 'orange' },
          { label: 'Today Collected', value: paymentStats.today_collected_amount, class: 'green' },
          { label: 'Today Failed', value: paymentStats.total_failed_amount, class: 'red' },
        ].map((s, i) => (
          <motion.div key={s.label} className={`stat-card ${s.class}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 8) * 0.1 }}>
            <div className="stat-value">{s.label.includes('Amount') ? `KES ${Number(s.value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : s.value || 0}</div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div id="applications" className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>Applications Over Time</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="applications" stroke="#2563EB" strokeWidth={2} dot={{ fill: '#2563EB' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div id="payments" className="card table-wrap" style={{ marginBottom: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0', color: 'var(--primary-dark)' }}>Payment Tracking</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray)' }}>No payments yet</td></tr>
            ) : payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.student_name || '—'}</td>
                <td>{payment.reference}</td>
                <td>{payment.amount ? `KES ${Number(payment.amount).toLocaleString()}` : '—'}</td>
                <td>
                  <span className={`badge badge-${payment.status === 'completed' ? 'success' : payment.status === 'failed' ? 'danger' : 'warning'}`}>{payment.status}</span>
                </td>
                <td>
                  {payment.status === 'completed' || payment.status === 'failed' ? (
                    <span style={{ color: 'var(--gray)' }}>Done</span>
                  ) : (
                    <div style={{ display: 'flex', gap: '.35rem' }}>
                      <button className="btn btn-sm btn-success" onClick={() => handlePaymentAction(payment.id, 'approve')}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handlePaymentAction(payment.id, 'reject')}>Reject</button>
                    </div>
                  )}
                </td>
                <td>{formatDate(payment.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="users" className="card table-wrap" style={{ marginBottom: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0', color: 'var(--primary-dark)' }}>Users</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray)' }}>No users yet</td></tr>
            ) : users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name || '—'}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td><span className={`badge badge-${user.status === 'online' ? 'success' : 'warning'}`}>{user.status}</span></td>
                <td>{formatDate(user.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h3 style={{ padding: '1rem 1rem 0', color: 'var(--primary-dark)' }}>Recent Applications</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Programme</th>
              <th>KCSE</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)' }}>No applications yet</td></tr>
            ) : applications.map((app) => {
              const action = getActionLink(app);
              return (
                <tr key={app.id}>
                  <td>{app.full_name}</td>
                  <td>{app.programme_name}</td>
                  <td>{app.kcse_grade || '—'}</td>
                  <td>
                    <span className={`badge badge-${app.status === 'admitted' ? 'success' : app.status === 'rejected' || app.status === 'not_qualified' ? 'danger' : 'warning'}`}>
                      {STATUS_LABELS[app.status] || app.status}
                    </span>
                    {app.qualification_reasoning && (
                      <span className="ai-badge-sm" title="AI qualification analysis available">AI</span>
                    )}
                  </td>
                  <td>{formatDate(app.submitted_at)}</td>
                  <td>
                    {action ? <Link to={action} className="btn btn-sm btn-primary">Process</Link> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
