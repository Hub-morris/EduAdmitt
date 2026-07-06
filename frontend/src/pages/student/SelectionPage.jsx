import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import api, { formatCurrency } from '../../api/client';
import './SelectionPage.css';

export default function SelectionPage() {
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/applications/my-selection')
      .then(({ data }) => setSelection(data))
      .catch(() => setError('Unable to load programme selection.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-layout">
      <Navbar />
      <main className="container page-content">
        <FadeIn>
          <h1 className="page-title">My Selected Programme</h1>
          <p className="page-subtitle">Review the programme you chose before submitting your application.</p>
        </FadeIn>

        {loading ? (
          <div className="page-loader"><div className="spinner" /></div>
        ) : error ? (
          <div className="empty-state card"><p>{error}</p></div>
        ) : !selection ? (
          <div className="empty-state card">
            <h2>No Programme Selected</h2>
            <p>You have not selected a programme yet. Choose one to continue with your application.</p>
            <Link to="/programmes" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Browse Programmes
            </Link>
          </div>
        ) : (
          <div className="selection-card card">
            <div className="selection-header">
              <div>
                <span className="programme-degree-badge">{selection.degree}</span>
                <h2>{selection.name}</h2>
                <p className="programme-detail-meta">{selection.faculty_name} &bull; {selection.department_name}</p>
              </div>
              <div className="selection-actions">
                <Link to={`/programmes/${selection.programme_id}`} className="btn btn-secondary">View Details</Link>
                <Link to="/apply" className="btn btn-primary">Proceed to Apply</Link>
              </div>
            </div>

            <div className="selection-grid">
              {[
                { label: 'Duration', value: selection.duration },
                { label: 'Fees', value: `${formatCurrency(selection.fees)} / Year` },
                { label: 'Minimum Qualification', value: selection.min_qualification },
                { label: 'Intake', value: selection.intake },
                { label: 'Type', value: selection.type },
                { label: 'Degree', value: selection.degree },
              ].map((item) => (
                <div key={item.label} className="selection-item card">
                  <span className="selection-label">{item.label}</span>
                  <span className="selection-value">{item.value || '—'}</span>
                </div>
              ))}
            </div>

            {selection.programme_description && (
              <div className="card programme-summary">
                <h3>Programme Summary</h3>
                <p>{selection.programme_description}</p>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
