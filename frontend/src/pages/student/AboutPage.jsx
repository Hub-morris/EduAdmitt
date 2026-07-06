import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import FadeIn from '../../components/FadeIn';
import api from '../../api/client';
import './AboutPage.css';

export default function AboutPage() {
  const [school, setSchool] = useState(null);

  useEffect(() => {
    api.get('/school').then(({ data }) => setSchool(data));
  }, []);

  return (
    <div className="page-layout">
      <Navbar />
      <main className="container page-content">
        <FadeIn>
          <h1 className="page-title">About {school?.name || 'EduAdmit University'}</h1>
          <p className="page-subtitle">{school?.tagline}</p>
        </FadeIn>

        <div className="about-grid">
          <div className="card about-section">
            <h2>Who We Are</h2>
            <p>{school?.about}</p>
          </div>
          <div className="card about-section">
            <h2>Our Mission</h2>
            <p>{school?.mission}</p>
          </div>
          <div className="card about-section">
            <h2>Our Vision</h2>
            <p>{school?.vision}</p>
          </div>
        </div>

        <div id="apply" className="card about-section apply-guide">
          <h2>How to Apply</h2>
          <ol className="apply-steps">
            <li><strong>Search Programmes</strong> — Browse and filter available programmes by faculty, department, cost, and type.</li>
            <li><strong>Select a Programme</strong> — Choose your preferred programme and review requirements.</li>
            <li><strong>Fill Application Form</strong> — Provide personal, contact, and academic details with required documents.</li>
            <li><strong>Track Status</strong> — Monitor verification, qualification, and admission progress online.</li>
            <li><strong>Receive Offer Letter</strong> — Download and print your official admission letter once approved.</li>
          </ol>
          <Link to="/register" className="btn btn-primary">Start Application</Link>
        </div>

        <div id="requirements" className="card about-section">
          <h2>General Requirements</h2>
          <ul className="req-list">
            <li>Valid KCSE certificate or result slip</li>
            <li>National ID or birth certificate</li>
            <li>Passport-size photograph</li>
            <li>Minimum grade as specified by each programme</li>
          </ul>
        </div>

        <div id="contact" className="card about-section contact-section">
          <h2>Contact Us</h2>
          <div className="contact-grid">
            <div><strong>Email:</strong> {school?.contact_email}</div>
            <div><strong>Phone:</strong> {school?.contact_phone}</div>
            <div><strong>Address:</strong> {school?.address}</div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
