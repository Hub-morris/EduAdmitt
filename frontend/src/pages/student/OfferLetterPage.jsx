import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import api, { formatCurrency, formatDate } from '../../api/client';
import './OfferLetterPage.css';

export default function OfferLetterPage() {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const letterRef = useRef(null);

  useEffect(() => {
    api.get('/applications/my-application').then(({ data }) => {
      setApplication(data);
      setLoading(false);
    });
  }, []);

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!letterRef.current) return;
    setIsDownloading(true);

    try {
      const element = letterRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= 297;

      while (heightLeft > 0) {
        position -= 297;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= 297;
      }

      pdf.save(`EduAdmit_Offer_Letter_${application?.admission_number || 'letter'}.pdf`);
    } catch (error) {
      console.error('Download failed', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) return <div className="page-layout"><Navbar /><div className="page-loader"><div className="spinner" /></div></div>;

  if (!application || application.admission_status !== 'admitted') {
    return (
      <div className="page-layout">
        <Navbar />
        <main className="container page-content">
          <div className="empty-state card">
            <h2>No Offer Letter Available</h2>
            <p>Your admission letter will appear here once you are admitted.</p>
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
        <FadeIn>
          <h1 className="page-title">Admission Offer Letter</h1>
          <p className="page-subtitle">Congratulations on your admission!</p>
        </FadeIn>

        <div className="letter-actions no-print">
          <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? 'Preparing download...' : 'Download PDF'}
          </button>
        </div>

        <div className="offer-letter card" ref={letterRef}>
          <div className="letter-header">
            <div className="letter-logo">
              <img src="/images/logo.png" alt="EduAdmit logo" />
            </div>
            <div>
              <h2>EduAdmit University</h2>
              <p>Office of Admissions • Academic Affairs</p>
            </div>
          </div>

          <div className="letter-date">{formatDate(application.admission_date)}</div>

          <div className="letter-meta">
            <span className="letter-badge">Admitted</span>
            <span className="letter-badge">{application.programme_type || 'Degree Programme'}</span>
            <span className="letter-badge">{application.intake}</span>
          </div>

          <p className="letter-greeting">Dear {application.full_name},</p>

          <p className="letter-body">
            We are delighted to confirm your admission to EduAdmit University for the programme shown below.
            This offer is issued by the Office of Admissions and confirms your eligibility to enroll for the upcoming intake.
          </p>

          <table className="letter-table">
            <tbody>
              <tr><td>Admission Number</td><td><strong>{application.admission_number}</strong></td></tr>
              <tr><td>Programme</td><td>{application.programme_name}</td></tr>
              <tr><td>Intake</td><td>{application.intake}</td></tr>
              <tr><td>Reporting Date</td><td>{formatDate(application.reporting_date)}</td></tr>
            </tbody>
          </table>

          <div className="letter-details-grid">
            <div className="letter-address">
              <h4>Campus Address</h4>
              <p>
                EduAdmit University<br />
                123 Academic Way<br />
                Knowledge City, ED 45678
              </p>
            </div>

            <div className="letter-map">
              <div className="letter-map-box">
                <iframe
                  title="Campus map"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=36.807,-1.296,36.827,-1.276&layer=mapnik&marker=-1.286389,36.817223"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p>Campus location for your admission and registration.</p>
            </div>
          </div>

          <div className="letter-section">
            <h4>Fee Structure</h4>
            <pre className="letter-pre">{application.fee_structure}</pre>
          </div>

          <div className="letter-section">
            <h4>Registration Guidelines</h4>
            <pre className="letter-pre">{application.registration_guidelines}</pre>
          </div>

          <div className="letter-footer">
            <p>
              Please complete your acceptance and registration steps before the reporting date. For questions about enrollment,
              contact the Office of Admissions at <strong>admissions@eduadmit.edu</strong> or call <strong>0789761234</strong>.
            </p>
            <p className="letter-note">This offer is subject to the terms and conditions of EduAdmit University.</p>
          </div>

          <p className="letter-closing">
            Congratulations once again. We look forward to welcoming you to our campus.
          </p>

          <div className="letter-signature">
            <div className="signature-details">
              <div className="sig-line">_________________________</div>
              <div className="sig-name">Dr. Jane K. Mutiso</div>
              <div className="sig-title">Director of Admissions</div>
              <div className="sig-office">EduAdmit University</div>
            </div>
            <div className="letter-seal">
              <span className="seal-text">EduAdmit University</span>
              <span className="seal-subtext">Official Seal</span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
