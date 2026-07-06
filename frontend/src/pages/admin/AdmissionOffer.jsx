import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import api, { formatCurrency } from '../../api/client';
import './AdminDetailPages.css';

export default function AdmissionOffer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [form, setForm] = useState({ intake: '', reportingDate: '', feeStructure: '', registrationGuidelines: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/admin/applications/${id}`).then(({ data }) => {
      setApp(data);
      setForm({
        intake: data.programme_intake || data.intake || '',
        reportingDate: '',
        feeStructure: `Tuition: ${formatCurrency(data.fees)} per year\nRegistration Fee: KES 5,000\nStudent Activity Fee: KES 2,000`,
        registrationGuidelines: '1. Report to the admissions office with original documents.\n2. Complete online registration within 7 days.\n3. Pay registration fees before orientation.',
      });
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post(`/admin/applications/${id}/admit`, form);
      setMessage(`Admission approved! Number: ${data.admissionNumber}`);
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Admission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <Link to="/admin" className="back-link">&larr; Back to Dashboard</Link>
      <h1 className="page-title">Admission Offer</h1>
      <p className="page-subtitle">Approve admission for {app?.full_name}</p>

      {message && <div className="alert alert-success">{message}</div>}

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="info-list" style={{ marginBottom: '1.5rem' }}>
          <div><strong>Student:</strong> {app?.full_name}</div>
          <div><strong>Programme:</strong> {app?.programme_name}</div>
          <div><strong>KCSE Grade:</strong> {app?.kcse_grade}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Intake</label>
            <input className="form-input" value={form.intake} onChange={(e) => setForm({ ...form, intake: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Reporting Date</label>
            <input type="date" className="form-input" value={form.reportingDate} onChange={(e) => setForm({ ...form, reportingDate: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Fee Structure</label>
            <textarea className="form-textarea" value={form.feeStructure} onChange={(e) => setForm({ ...form, feeStructure: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Registration Guidelines</label>
            <textarea className="form-textarea" value={form.registrationGuidelines} onChange={(e) => setForm({ ...form, registrationGuidelines: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-success btn-lg" disabled={submitting}>
            {submitting ? 'Processing...' : 'Save & Generate Letter'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
