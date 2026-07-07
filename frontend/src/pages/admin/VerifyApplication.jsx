import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import api, { formatDate } from '../../api/client';
import './AdminDetailPages.css';

export default function VerifyApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [activeTab, setActiveTab] = useState('Documents');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [showAmendmentForm, setShowAmendmentForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [amendmentMessage, setAmendmentMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    api.get(`/admin/applications/${id}`).then(({ data }) => {
      setApp(data);
      setLoading(false);
    });
  }, [id]);

  const handleVerify = async (status) => {
    setProcessing(true);
    try {
      const payload = {
        status,
        documents: app.documents?.map((d) => ({ id: d.id, status: status === 'verified' ? 'verified' : d.verification_status })),
      };
      
      if (status === 'amendments_needed' && amendmentMessage) {
        payload.feedbackMessage = amendmentMessage;
      }
      
      if (status === 'rejected' && rejectionReason) {
        payload.rejectionReason = rejectionReason;
      }
      
      await api.patch(`/admin/applications/${id}/verify`, payload);
      
      const msg = status === 'verified' ? 'Application verified! Proceed to qualification check.' 
                : status === 'amendments_needed' ? 'Amendment request sent to student.'
                : 'Application rejected.';
      
      setMessage(msg);
      if (status === 'verified') setTimeout(() => navigate(`/admin/qualify/${id}`), 1500);
      else setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;
  if (!app) return <AdminLayout><div className="empty-state">Application not found</div></AdminLayout>;

  const tabs = ['Documents', 'Personal', 'Academic'];

  return (
    <AdminLayout>
      <Link to="/admin" className="back-link">&larr; Back to Dashboard</Link>
      <h1 className="page-title">Verify Application</h1>

      {message && <div className="alert alert-success">{message}</div>}

      <div className="admin-detail-layout">
        <div className="applicant-sidebar card">
          <div className="applicant-avatar">{app.full_name?.charAt(0)}</div>
          <h3>{app.full_name}</h3>
          <p>{app.programme_name}</p>
          <span className={`badge badge-${app.verification_status === 'verified' ? 'success' : 'warning'}`}>
            {app.verification_status}
          </span>
        </div>

        <div className="admin-detail-main card">
          <div className="tabs">
            {tabs.map((tab) => (
              <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>

          {activeTab === 'Documents' && (
            <div className="doc-list">
              {app.documents?.length ? app.documents.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <div>
                    <strong>{doc.doc_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>
                    <span className="doc-name">{doc.original_name}</span>
                  </div>
                  <div className="doc-actions">
                    <a href={`/api/admin/documents/${doc.id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">View</a>
                    <span className={`badge badge-${doc.verification_status === 'verified' ? 'success' : 'warning'}`}>{doc.verification_status}</span>
                  </div>
                </div>
              )) : <p className="empty-state">No documents uploaded</p>}
            </div>
          )}

          {activeTab === 'Personal' && (
            <div className="info-list">
              <div><strong>Full Name:</strong> {app.full_name}</div>
              <div><strong>Date of Birth:</strong> {formatDate(app.date_of_birth)}</div>
              <div><strong>Gender:</strong> {app.gender}</div>
              <div><strong>ID Number:</strong> {app.id_number}</div>
              <div><strong>Email:</strong> {app.email}</div>
              <div><strong>Phone:</strong> {app.phone}</div>
              <div><strong>Address:</strong> {app.address}</div>
              <div><strong>County:</strong> {app.county || '—'}</div>
              <div><strong>Emergency Contact:</strong> {app.emergency_contact_name ? `${app.emergency_contact_name} (${app.emergency_contact_phone})` : '—'}</div>
            </div>
          )}

          {activeTab === 'Academic' && (
            <div className="info-list">
              <div><strong>KCSE Index:</strong> {app.kcse_index}</div>
              <div><strong>KCSE Grade:</strong> {app.kcse_grade}</div>
              <div><strong>Previous School:</strong> {app.previous_school}</div>
            </div>
          )}

          <div className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Payment Status</h4>
            <div className="payment-info">
              <div className="payment-chip">
                <span className="payment-chip-label">Fee</span>
                <span>KES 1,000</span>
              </div>
              <div className="payment-chip">
                <span className="payment-chip-label">Payment Status</span>
                <span className={`badge badge-${['completed', 'paid'].includes(app.payment_status) ? 'success' : app.payment_status === 'failed' ? 'danger' : 'warning'}`}>{app.payment_status || 'pending'}</span>
              </div>
              <div className="payment-chip">
                <span className="payment-chip-label">Reference</span>
                <span>{app.payment_reference || '—'}</span>
              </div>
            </div>
          </div>

          <div className="admin-actions">
            {!showAmendmentForm && !showRejectionForm ? (
              <>
                <button 
                  className="btn btn-warning" 
                  onClick={() => setShowAmendmentForm(true)}
                  disabled={processing}
                >
                  Request Amendments
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => setShowRejectionForm(true)}
                  disabled={processing}
                >
                  Reject Application
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={() => handleVerify('verified')} 
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Mark as Verified'}
                </button>
              </>
            ) : (
              <>
                {showAmendmentForm && (
                  <div className="feedback-form-container">
                    <h4>Request Amendments</h4>
                    <textarea 
                      className="form-textarea"
                      placeholder="What amendments are needed? Be specific about what the student should improve or resubmit."
                      value={amendmentMessage}
                      onChange={(e) => setAmendmentMessage(e.target.value)}
                      rows="4"
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleVerify('amendments_needed')}
                        disabled={processing || !amendmentMessage.trim()}
                      >
                        Send Request
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => { setShowAmendmentForm(false); setAmendmentMessage(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {showRejectionForm && (
                  <div className="feedback-form-container">
                    <h4>Reject Application</h4>
                    <textarea 
                      className="form-textarea"
                      placeholder="Provide a reason for rejection that will be communicated to the student."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows="4"
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button 
                        className="btn btn-danger"
                        onClick={() => handleVerify('rejected')}
                        disabled={processing || !rejectionReason.trim()}
                      >
                        Confirm Rejection
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => { setShowRejectionForm(false); setRejectionReason(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
