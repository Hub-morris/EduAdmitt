import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import api, { formatCurrency } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './ApplicationPage.css';
import PaymentModal from '../../components/PaymentModal';

const steps = ['Personal', 'Contact', 'Academic', 'Uploads', 'Payment', 'Review'];

export default function ApplicationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [isAmendment, setIsAmendment] = useState(false);
  const [feedbackMessages, setFeedbackMessages] = useState([]);
  const [form, setForm] = useState({
    fullName: '', dateOfBirth: '', gender: '', idNumber: '',
    email: '', phone: '', address: '', county: '',
    emergencyContactName: '', emergencyContactPhone: '',
    kcseIndex: '', kcseGrade: '', previousSchool: '',
  });
  const [files, setFiles] = useState({ kcse_certificate: null, national_id: null, passport_photo: null });
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentCreated, setPaymentCreated] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const applicationFee = 1;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get selection and check for existing application
        const selRes = await api.get('/applications/my-selection');
        const statusRes = await api.get('/applications/status');
        
        if (selRes.data) {
          setSelection(selRes.data);

          if (statusRes.data && statusRes.data.programme_id === selRes.data.programme_id) {
            if (statusRes.data.needs_amendment) {
              setIsAmendment(true);
              setFeedbackMessages(statusRes.data.feedback || []);
            } else {
              setError('You have already applied for this programme. View your status or choose a different programme.');
              setBlocked(true);
              setLoading(false);
              return;
            }
          }
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        email: f.email || user.email || '',
        fullName: f.fullName || user.full_name || user.fullName || '',
      }));
    }
  }, [user]);

  const fileInputs = {
    kcse_certificate: useRef(null),
    national_id: useRef(null),
    passport_photo: useRef(null),
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleFile = (name, file) => {
    setFiles((prev) => ({ ...prev, [name]: file }));
  };

  const requiredDocuments = ['kcse_certificate', 'national_id', 'passport_photo'];
  const allDocumentsUploaded = requiredDocuments.every((name) => Boolean(files[name]));

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const validateStep = (currentStep) => {
    if (currentStep === 0) {
      if (!form.fullName.trim()) return 'Please enter your full name.';
      if (!form.dateOfBirth.trim()) return 'Please enter your date of birth.';
      if (!form.gender.trim()) return 'Please select your gender.';
      if (!form.idNumber.trim()) return 'Please enter your ID number.';
    }
    if (currentStep === 1) {
      if (!form.email.trim()) return 'Please enter your email address.';
      if (!form.phone.trim()) return 'Please enter your phone number.';
      if (!form.address.trim()) return 'Please enter your address.';
      if (!form.county.trim()) return 'Please enter your county.';
      if (!form.emergencyContactName.trim()) return 'Please enter an emergency contact name.';
      if (!form.emergencyContactPhone.trim()) return 'Please enter an emergency contact phone.';
    }
    if (currentStep === 2) {
      if (!form.kcseIndex.trim()) return 'Please enter your KCSE index.';
      if (!form.kcseGrade.trim()) return 'Please enter your KCSE grade.';
      if (!form.previousSchool.trim()) return 'Please enter your previous school.';
    }
    if (currentStep === 3 && !allDocumentsUploaded) {
      return 'Please upload all required documents before continuing.';
    }
    return null;
  };

  const handleNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    next();
  };

  const createPaymentReference = async () => {
    if (!selection) return setError('Programme selection missing');
    setError('');
    try {
      const applicationFee = 1;
      const res = await api.post('/payments', { applicationId: null, amount: applicationFee, currency: 'KES' });
      setPaymentId(res.data.paymentId || null);
      setPaymentRef(res.data.reference);
      setPaymentAmount(applicationFee);
      setPaymentCreated(true);
      setShowPaymentModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create payment reference');
    }
  };

  const handlePaymentConfirmed = (receipt) => {
    setPaymentConfirmed(true);
    setShowPaymentModal(false);
    next();
  };

  const validateBeforeSubmit = () => {
    const personalError = validateStep(0);
    if (personalError) return personalError;
    const contactError = validateStep(1);
    if (contactError) return contactError;
    const academicError = validateStep(2);
    if (academicError) return academicError;
    if (!allDocumentsUploaded) return 'Please upload all required documents before submitting your application.';
    if (!paymentConfirmed) return 'Please complete the application fee payment before submitting your application.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('programmeId', selection.programme_id);
    Object.entries(files).forEach(([k, v]) => { if (v) fd.append(k, v); });

    try {
      fd.append('paymentId', paymentId || '');
      await api.post('/applications/submit', fd);
      setSuccess(true);
      setTimeout(() => navigate('/status'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-layout"><Navbar /><div className="page-loader"><div className="spinner" /></div></div>;

  if (blocked) {
    return (
      <div className="page-layout">
        <Navbar />
        <main className="container page-content">
          <div className="empty-state card">
            <h2>Cannot Apply</h2>
            <p>{error}</p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/status" className="btn btn-primary">View Status</Link>
              <Link to="/programmes" className="btn btn-secondary">Browse Programmes</Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error && !selection) {
    return (
      <div className="page-layout">
        <Navbar />
        <main className="container page-content">
          <div className="empty-state card">
            <h2>Cannot Apply</h2>
            <p>{error}</p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/status" className="btn btn-primary">View Status</Link>
              <Link to="/programmes" className="btn btn-secondary">Browse Programmes</Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="page-layout">
        <Navbar />
        <main className="container page-content">
          <div className="empty-state card">
            <h2>No Programme Selected</h2>
            <p>Please select a programme before applying.</p>
            <Link to="/programmes" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Programmes</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="container page-content">
        <h1 className="page-title">Application Form</h1>
        <p className="page-subtitle">Applying for: <strong>{selection.name}</strong></p>

        {isAmendment && (
          <motion.div className="alert alert-warning" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            ℹ️ You are resubmitting your application with amendments. Please address the feedback provided.
          </motion.div>
        )}

        {isAmendment && feedbackMessages.length > 0 && (
          <div className="card feedback-summary">
            <h4>Amendment Feedback</h4>
            {feedbackMessages.map((item) => (
              <div key={item.id} className="feedback-note">
                <p>{item.feedback_message}</p>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}

        {success && <div className="alert alert-success">Application submitted successfully!</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="step-circle">{i < step ? '✓' : i + 1}</div>
                <span className="step-label">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`step-line ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="card application-form-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 && (
                <>
                  <h3>Personal Details</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input name="fullName" className="form-input" value={form.fullName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input name="dateOfBirth" type="date" className="form-input" value={form.dateOfBirth} onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select name="gender" className="form-select" value={form.gender} onChange={handleChange} required>
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">ID Number</label>
                      <input name="idNumber" className="form-input" value={form.idNumber} onChange={handleChange} required />
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h3>Contact Information</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input name="email" type="email" className="form-input" value={form.email} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input name="phone" className="form-input" value={form.phone} onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea name="address" className="form-textarea" value={form.address} onChange={handleChange} required />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">County</label>
                      <input name="county" className="form-input" value={form.county} onChange={handleChange} placeholder="e.g. Nairobi" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Name</label>
                      <input name="emergencyContactName" className="form-input" value={form.emergencyContactName} onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Phone</label>
                    <input name="emergencyContactPhone" className="form-input" value={form.emergencyContactPhone} onChange={handleChange} placeholder="+254..." required />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h3>Academic Information</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">KCSE Index Number</label>
                      <input name="kcseIndex" className="form-input" value={form.kcseIndex} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">KCSE Mean Grade</label>
                      <select name="kcseGrade" className="form-select" value={form.kcseGrade} onChange={handleChange} required>
                        <option value="">Select grade...</option>
                        {['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Previous School</label>
                    <input name="previousSchool" className="form-input" value={form.previousSchool} onChange={handleChange} required />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h3>Upload Documents</h3>
                  <p className="page-subtitle" style={{ marginBottom: '1rem' }}>All three documents are required for submission.</p>
                  {[
                    { name: 'kcse_certificate', label: 'KCSE Certificate / Result Slip' },
                    { name: 'national_id', label: 'National ID' },
                    { name: 'passport_photo', label: 'Passport Photo' },
                  ].map(({ name, label }) => (
                    <div className="form-group" key={name}>
                      <label className="form-label">{label}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => fileInputs[name].current?.click()}
                        >
                          Select File
                        </button>
                        <span>{files[name]?.name || 'No file selected'}</span>
                      </div>
                      <input
                        ref={fileInputs[name]}
                        type="file"
                        name={name}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleFile(name, file);
                        }}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>
                  ))}
                </>
              )}

              {step === 4 && (
                <>
                  <h3>Application Fee Payment</h3>
                  <p>Please pay the application fee to proceed to final submission.</p>
                  <div className="payment-summary card">
                    <div className="payment-summary-row"><span>Programme</span><strong>{selection.name}</strong></div>
                    <div className="payment-summary-row"><span>Amount</span><strong>{formatCurrency(paymentAmount || applicationFee)}</strong></div>
                    {paymentCreated && <div className="payment-summary-row"><span>Reference</span><strong>{paymentRef}</strong></div>}
                  </div>
                  <div className="payment-action-row">
                    {!paymentCreated ? (
                      <button className="btn btn-primary" onClick={createPaymentReference}>Pay with M-PESA</button>
                    ) : (
                      <>
                        <button className="btn btn-success" onClick={() => setShowPaymentModal(true)} disabled={!paymentCreated}>Continue to M-PESA</button>
                        <button className="btn btn-secondary" onClick={() => { setPaymentCreated(false); setPaymentRef(''); setPaymentId(null); setPaymentAmount(0); setPaymentConfirmed(false); }}>Cancel</button>
                      </>
                    )}
                  </div>
                  {showPaymentModal && (
                    <PaymentModal
                      amount={paymentAmount || selection.fees}
                      reference={paymentRef}
                      programme={selection.name}
                      paymentId={paymentId}
                      onCancel={() => setShowPaymentModal(false)}
                      onConfirm={handlePaymentConfirmed}
                    />
                  )}
                  {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
                </>
              )}

              {step === 5 && (
                <>
                  <h3>Review & Submit</h3>
                  <div className="review-grid">
                    <div><strong>Programme:</strong> {selection.name}</div>
                    <div><strong>Duration:</strong> {selection.duration}</div>
                    <div><strong>Fees:</strong> {formatCurrency(selection.fees)}/yr</div>
                    <div><strong>Name:</strong> {form.fullName}</div>
                    <div><strong>Email:</strong> {form.email}</div>
                    <div><strong>County:</strong> {form.county}</div>
                    <div><strong>Emergency Contact:</strong> {form.emergencyContactName} ({form.emergencyContactPhone})</div>
                    <div><strong>KCSE Grade:</strong> {form.kcseGrade}</div>
                    <div><strong>Documents:</strong> {Object.values(files).filter(Boolean).length} uploaded</div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="form-nav">
            {step > 0 && <button className="btn btn-secondary" onClick={prev}>Previous</button>}
            {step < steps.length - 1 ? (
              <button className="btn btn-primary" onClick={handleNext} disabled={step === 3 && !allDocumentsUploaded}>
                {step === 3 ? 'Continue' : 'Next'}
              </button>
            ) : (
              <button className="btn btn-success" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
