import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import api, { STATUS_LABELS, formatDate } from '../../api/client';
import './StatusPage.css';

const timelineSteps = [
  { key: 'submitted', label: 'Application Submitted', field: 'submitted_at' },
  { key: 'verification', label: 'Document Verification', field: 'verified_at' },
  { key: 'qualification', label: 'Qualification Check', field: 'qualified_at' },
  { key: 'admission', label: 'Admission Offer', field: 'admitted_at' },
  { key: 'letter', label: 'Offer Letter', field: 'admitted_at' },
];

function getStepStatus(stepKey, status) {
  const order = ['submitted', 'under_verification', 'verified', 'qualified', 'not_qualified', 'admitted'];
  const stepIndex = { submitted: 0, verification: 1, qualification: 2, admission: 3, letter: 4 };
  const currentIndex = order.indexOf(status);
  const thisIndex = stepIndex[stepKey];

  if (status === 'rejected') return stepKey === 'submitted' ? 'done' : 'pending';
  if (status === 'not_qualified') return thisIndex <= 2 ? (thisIndex < 2 ? 'done' : 'failed') : 'pending';
  if (status === 'amendments_needed') return stepKey === 'submitted' ? 'pending' : 'pending';
  if (thisIndex < currentIndex || status === 'admitted') return 'done';
  if (thisIndex === currentIndex || (status === 'under_verification' && stepKey === 'verification')) return 'active';
  return 'pending';
}

export default function StatusPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  useEffect(() => {
    api.get('/applications/status').then(({ data }) => {
      setStatus(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (status?.status === 'not_qualified') {
      setShowRejectionModal(true);
    }
  }, [status]);

  if (loading) return <div className="page-layout"><Navbar /><div className="page-loader"><div className="spinner" /></div></div>;

  if (!status || status.status === 'none') {
    return (
      <div className="page-layout">
        <Navbar />
        <main className="container page-content">
          <div className="empty-state card">
            <h2>No Application Found</h2>
            <p>You haven't submitted an application yet.</p>
            <Link to="/apply" className="btn btn-primary" style={{ marginTop: '1rem' }}>Start Application</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const statusClass = {
    admitted: 'success', qualified: 'info', under_verification: 'warning',
    rejected: 'danger', not_qualified: 'danger', submitted: 'warning',
    amendments_needed: 'warning',
  };

  return (
    <div className="page-layout">
      <Navbar />
      <main className="container page-content">
        <FadeIn>
          <h1 className="page-title">Application Status</h1>
          <p className="page-subtitle">Track your admission progress</p>
        </FadeIn>

        <div className={`status-banner badge badge-${statusClass[status.status] || 'gray'}`}>
          Status: {STATUS_LABELS[status.status] || status.status}
          {status.programme_name && ` — ${status.programme_name}`}
        </div>

        {status.needs_amendment && (
          <motion.div
            className="card amendments-alert"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="amendments-alert-header">
              <h3>⚠️ Amendments Required</h3>
              <span className="amendment-count">Amendment Request #{status.amendment_count}</span>
            </div>
            {Array.isArray(status.feedback) && status.feedback.length > 0 && (
              <div className="feedback-messages">
                {status.feedback.map((msg, idx) => (
                  <div key={idx} className="feedback-item">
                    <p>{msg.feedback_message}</p>
                    <small>{formatDate(msg.created_at)}</small>
                  </div>
                ))}
              </div>
            )}

            <Link to="/apply" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Amend Application
            </Link>
          </motion.div>
        )}

        {status.payment_status === 'pending' && (
          <motion.div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--warning)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={{ marginBottom: '.5rem' }}>Payment Pending</h3>
            <p>Your M-PESA payment request has been sent. Please complete the prompt on your phone and wait for confirmation.</p>
          </motion.div>
        )}

        {status.payment_status === 'failed' && status.payment_rejection_reason && (
          <motion.div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--danger)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 style={{ marginBottom: '.5rem' }}>Payment Update</h3>
            <p>{status.payment_rejection_reason}</p>
          </motion.div>
        )}

        {status.status === 'not_qualified' && (
          <motion.div
            className="rejection-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="rejection-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="rejection-modal-content">
                <div className="rejection-icon">❌</div>
                <h2>You Don’t Qualify</h2>
                <p>You don’t qualify for this programme after verification. Please try another programme.</p>
                <p className="rejection-reason">{status.rejection_reason || 'Please review the programme requirements and choose a different programme.'}</p>
                <div className="rejection-actions">
                  <Link to="/programmes" className="btn btn-primary">Browse Other Programmes</Link>
                  <button onClick={() => setShowRejectionModal(false)} className="btn btn-secondary">Dismiss</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        <div className="card status-card">
          <div className="timeline">
            {timelineSteps.map((step, i) => {
              const stepStatus = getStepStatus(step.key, status.status);
              return (
                <motion.div
                  key={step.key}
                  className={`timeline-item ${stepStatus}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="timeline-marker">
                    {stepStatus === 'done' ? '✓' : stepStatus === 'failed' ? '✗' : i + 1}
                  </div>
                  <div className="timeline-content">
                    <h4>{step.label}</h4>
                    {status[step.field] && (
                      <span className="timeline-date">{formatDate(status[step.field])}</span>
                    )}
                    {stepStatus === 'active' && <span className="timeline-active">In Progress</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {status.admission_status === 'admitted' && (
            <div className="status-actions">
              <Link to="/offer-letter" className="btn btn-primary">View Offer Letter</Link>
            </div>
          )}

          {typeof status.qualification_reasoning === 'string' && (
            <div className="qualification-insight card">
              <div className="qualification-insight-header">
                <h4>Qualification Analysis</h4>
                <span className="ai-badge">AI</span>
              </div>
              {status.qualification_reasoning.split('\n\n').map((para, i) => (
                <p key={i}>{para.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
              ))}
            </div>
          )}

          {status.rejection_reason && status.status !== 'not_qualified' && (
            <div className="rejection-notice">
              <strong>Rejection reason:</strong> {status.rejection_reason}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
