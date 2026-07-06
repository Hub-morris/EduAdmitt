import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { formatCurrency } from '../../api/client';
import { getRelevantImageUrl } from '../../utils/imageHelper';
import './ProgrammeDetailPage.css';

const tabs = ['Overview', 'Requirements', 'Modules', 'Career'];

export default function ProgrammeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [programme, setProgramme] = useState(null);
  const [selection, setSelection] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [selecting, setSelecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get(`/programmes/${id}`).then(({ data }) => setProgramme(data));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    api.get('/applications/my-selection')
      .then(({ data }) => setSelection(data))
      .catch(() => setSelection(null));
  }, [user]);

  const handleSelect = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/programmes/${id}` } });
      return;
    }
    setConfirming(true);
  };

  const confirmSelect = async () => {
    setSelecting(true);
    setConfirming(false);
    setToast('');

    try {
      await api.post('/applications/select-programme', { programmeId: parseInt(id) });
      setToast('Programme selected! You can now proceed to apply.');
      setTimeout(() => navigate('/apply'), 1500);
    } catch (err) {
      setToast(err.response?.data?.error || 'Failed to select programme');
    } finally {
      setSelecting(false);
    }
  };

  if (!programme) return (
    <div className="page-layout"><Navbar /><div className="page-loader"><div className="spinner" /></div></div>
  );

  const tabContent = {
    Overview: programme.overview || programme.description,
    Requirements: programme.requirements,
    Modules: programme.modules,
    Career: programme.career,
  };

  return (
    <div className="page-layout">
      <Navbar />
      <div className="programme-hero">
        <img src={getRelevantImageUrl(programme, '1600x400')} alt={programme.name} loading="lazy" />
        <div className="programme-hero-overlay" />
        <div className="container programme-hero-content">
          <FadeIn>
            <span className="programme-degree-badge">{programme.degree}</span>
            <h1>{programme.name}</h1>
            <p>{programme.faculty_name} &bull; {programme.department_name}</p>
          </FadeIn>
        </div>
      </div>

      <main className="container page-content">
        <div className="programme-meta-chips">
          {programme.type && <span className="meta-chip">{programme.type}</span>}
          {programme.degree && <span className="meta-chip">{programme.degree}</span>}
          {programme.code && <span className="meta-chip meta-chip-muted">{programme.code}</span>}
        </div>

        {programme.requirements && (
          <div className="requirements-callout card">
            <strong>Entry Requirements</strong>
            <p>{programme.requirements}</p>
          </div>
        )}

        <div className="info-grid">
          {[
            { label: 'Duration', value: programme.duration },
            { label: 'Fees', value: `${formatCurrency(programme.fees)} / Year` },
            { label: 'Min Qualification', value: programme.min_qualification },
            { label: 'Intake', value: programme.intake },
          ].map((item, i) => (
            <motion.div key={item.label} className="info-card card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <span className="info-label">{item.label}</span>
              <span className="info-value">{item.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="card programme-tabs-card">
          <div className="tabs">
            {tabs.map((tab) => (
              <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
          <div className="tab-content">
            <p style={{ whiteSpace: 'pre-line' }}>{tabContent[activeTab] || 'No information available.'}</p>
          </div>
        </div>

        <div className="select-action">
          {selection?.programme_id === programme?.id ? (
            <>
              <Link to="/apply" className="btn btn-primary btn-lg">Continue to Application</Link>
              <p className="select-note">This programme is already selected. Continue to complete your application.</p>
            </>
          ) : (
            <>
              <motion.button
                className="btn btn-primary btn-lg"
                onClick={handleSelect}
                disabled={selecting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {selecting ? 'Selecting...' : 'Select this Programme'}
              </motion.button>
              {confirming && (
                <div className="confirmation-box card">
                  <p>Are you sure you want to select this programme?</p>
                  <div className="confirmation-buttons">
                    <button className="btn btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                    <button className="btn btn-success" onClick={confirmSelect} disabled={selecting}>
                      {selecting ? 'Confirming...' : 'Confirm Selection'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {!user && <p className="select-note">You'll need to <Link to="/register">register</Link> or <Link to="/login">login</Link> first.</p>}
        </div>
      </main>
      <Footer />
      <Toast message={toast} type={toast.includes('Failed') ? 'error' : 'success'} onDismiss={() => setToast('')} />
    </div>
  );
}
