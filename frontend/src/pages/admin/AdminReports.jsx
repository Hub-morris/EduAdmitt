import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import AdminLayout from '../../components/AdminLayout';
import FadeIn from '../../components/FadeIn';
import api from '../../api/client';

const statusColors = ['#F59E0B', '#2563EB', '#10B981', '#EF4444', '#8B5CF6'];

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    api.get('/admin/dashboard')
      .then((res) => {
        if (!mounted) return;
        setData(res.data || {});
        setError('');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.error || 'Unable to load report data.');
      })
      .finally(() => {
        if (!mounted) setLoading(false);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const stats = data?.stats || {};
  const chartData = (data?.timeline || []).map((entry) => ({
    date: new Date(entry.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
    applications: Number(entry.count),
  }));

  const statusData = [
    { name: 'Pending', value: Number(stats.pending || 0) },
    { name: 'Under Verification', value: Number(stats.under_verification || 0) },
    { name: 'Qualified', value: Number(stats.qualified || 0) },
    { name: 'Rejected', value: Number(stats.rejected || 0) },
    { name: 'Admitted', value: Number(stats.admitted || 0) },
  ];

  const pieStatusData = statusData.filter((entry) => entry.value > 0);

  const totals = [
    { label: 'Total Applications', value: stats.total || 0, color: '#2563EB' },
    { label: 'Pending', value: stats.pending || 0, color: '#F59E0B' },
    { label: 'Rejected', value: stats.rejected || 0, color: '#EF4444' },
    { label: 'Admitted', value: stats.admitted || 0, color: '#10B981' },
  ];

  return (
    <AdminLayout>
      <FadeIn>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Visual overview of admissions performance.</p>
      </FadeIn>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            // download JSON
            const blob = new Blob([JSON.stringify(data || {}, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'eduadmit-reports.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download JSON
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            // build simple CSV of timeline
            const rows = [['date','applications']];
            (data?.timeline || []).forEach((r) => rows.push([r.date, r.count]));
            const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'eduadmit-timeline.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download CSV
        </button>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            try {
              const res = await api.get('/admin/reports/pdf', { responseType: 'blob' });
              const blob = new Blob([res.data], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'eduadmit-reports.pdf';
              a.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error('PDF download failed', err);
              window.alert('Failed to download PDF report');
            }
          }}
        >
          Download PDF
        </button>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.75rem', color: 'var(--primary-dark)' }}>Unable to load reports</h2>
          <p style={{ color: 'var(--gray)' }}>{error}</p>
        </div>
      ) : (
        <>
          <div className="grid-4 dashboard-summary" style={{ marginBottom: '2rem' }}>
            {totals.map((item) => (
              <motion.div key={item.label} className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div style={{ color: item.color, fontSize: '2rem', fontWeight: 700 }}>{item.value}</div>
                <div className="stat-label" style={{ marginTop: '0.5rem' }}>{item.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid-2" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card chart-card">
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>Applications Over Time</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="applications" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>Application Status Distribution</h3>
              {pieStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={4}
                      label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {pieStatusData.map((entry, index) => (
                        <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}`} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray)' }}>
                  No status distribution data available yet.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>Latest Admission Summary</h3>
            <p style={{ color: 'var(--gray)', lineHeight: 1.8 }}>
              Use this report page to quickly see the number of pending applications, how many were rejected, and how many students have been admitted. The dashboard also shows trends over the last 30 days.
            </p>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
