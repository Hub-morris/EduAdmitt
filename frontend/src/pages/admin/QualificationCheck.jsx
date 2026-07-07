import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/client';
import './AdminDetailPages.css';

export default function QualificationCheck() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.get(`/admin/applications/${id}`).then(({ data }) => {
      setApp(data);
      if (data.qualification_reasoning) {
        setResult({
          qualified: data.qualification_status === 'qualified',
          message: data.qualification_status === 'qualified'
            ? 'Student meets the programme requirements.'
            : 'Student does not meet the minimum grade requirement.',
          reasoning: data.qualification_reasoning,
          reasoningSource: 'stored',
          studentPoints: data.kcse_grade_points,
          requiredPoints: data.min_grade_points,
        });
      }
      setLoading(false);
    });
  }, [id]);

  const runCheck = async () => {
    setChecking(true);
    try {
      const { data } = await api.post(`/admin/applications/${id}/qualify`);
      setResult(data);
    } catch (err) {
      setResult({ message: err.response?.data?.error || 'Check failed', qualified: false });
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <Link to="/admin" className="back-link">&larr; Back to Dashboard</Link>
      <h1 className="page-title">Qualification Check</h1>
      <p className="page-subtitle">{app?.full_name} — {app?.programme_name}</p>

      <div className="card qualify-card">
        <div className="qualify-comparison">
          <div className="qualify-box">
            <span className="qualify-label">Student KCSE Grade</span>
            <span className="qualify-value">{app?.kcse_grade}</span>
            <span className="qualify-points">{app?.kcse_grade_points || result?.studentPoints || '—'} points</span>
          </div>
          <div className="qualify-vs">VS</div>
          <div className="qualify-box">
            <span className="qualify-label">Programme Requirement</span>
            <span className="qualify-value">{app?.min_qualification}</span>
            <span className="qualify-points">{app?.min_grade_points || result?.requiredPoints || '—'} points min</span>
          </div>
        </div>

        <div className="qualify-action">
          <button className="btn btn-primary btn-lg" onClick={runCheck} disabled={checking}>
            {checking ? 'Checking...' : 'Run Qualification Check'}
          </button>
          <p className="qualify-note">The system compares grades against programme requirements and generates an AI explanation.</p>
        </div>

        {result && (
          <motion.div
            className={`qualify-result ${result.qualified ? 'qualified' : 'not-qualified'}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <strong>Result: {result.qualified ? 'Qualified' : 'Not Qualified'}</strong>
            <p>{result.message}</p>
            {result.reasoning && (
              <div className="ai-reasoning">
                <div className="ai-reasoning-header">
                  <span className="ai-badge">AI Analysis</span>
                  <span className="ai-source">{result.reasoningSource === 'openai' ? 'Powered by OpenAI' : 'Rule-based analysis'}</span>
                </div>
                <div className="ai-reasoning-body">
                  {typeof result.reasoning === 'string' ? result.reasoning.split('\n\n').map((para, i) => (
                    <p key={i}>{para.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                  )) : null}
                </div>
              </div>
            )}
            {result.qualified && (
              <button className="btn btn-success" onClick={() => navigate(`/admin/admit/${id}`)} style={{ marginTop: '1rem' }}>
                Proceed to Admission Offer &rarr;
              </button>
            )}
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
}
