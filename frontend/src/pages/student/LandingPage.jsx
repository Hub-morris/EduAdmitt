import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faFileLines, faCircleCheck, faPhone } from '@fortawesome/free-solid-svg-icons';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ProgrammeCard from '../../components/ProgrammeCard';
import FadeIn, { FadeInStagger, FadeInItem } from '../../components/FadeIn';
import api from '../../api/client';
import './LandingPage.css';

const quickLinks = [
  { icon: faGraduationCap, title: 'Programmes', desc: 'Browse all courses', to: '/programmes' },
  { icon: faFileLines, title: 'How to Apply', desc: 'Step-by-step guide', to: '/about#apply' },
  { icon: faCircleCheck, title: 'Requirements', desc: 'Entry qualifications', to: '/about#requirements' },
  { icon: faPhone, title: 'Contact Us', desc: 'Get in touch', to: '/about#contact' },
];

export default function LandingPage() {
  const [search, setSearch] = useState('');
  const [programmes, setProgrammes] = useState([]);
  const [school, setSchool] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/programmes').then(({ data }) => setProgrammes(data.slice(0, 6)));
    api.get('/school').then(({ data }) => setSchool(data));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/programmes?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="landing-page">
      <Navbar />

      <section className="hero">
        <div className="hero-overlay" />
        <div className="container hero-content">
          <FadeIn>
            <h1>{school?.tagline || 'Your Future Starts Here'}</h1>
            <p>Discover world-class programmes at EduAdmit University. Search, apply, and track your admission online.</p>
            <form className="hero-search" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search Programmes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="hero-search-input"
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
          </FadeIn>
        </div>
      </section>

      <section className="quick-links-section">
        <div className="container">
          <FadeInStagger className="quick-links-grid">
            {quickLinks.map((link) => (
              <FadeInItem key={link.title}>
                <Link to={link.to} className="quick-link-card">
                  <FontAwesomeIcon icon={link.icon} className="quick-link-icon" aria-hidden="true" />
                  <h3>{link.title}</h3>
                  <p>{link.desc}</p>
                </Link>
              </FadeInItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      <section className="about-preview">
        <div className="container">
          <FadeIn>
            <h2 className="section-title">About EduAdmit University</h2>
            <p className="about-text">
              {school?.about || 'EduAdmit University is committed to academic excellence and innovation.'}
            </p>
            <Link to="/about" className="btn btn-secondary">Learn More</Link>
          </FadeIn>
        </div>
      </section>

      <section className="popular-programmes">
        <div className="container">
          <FadeIn>
            <div className="section-header">
              <h2 className="section-title">Popular Programmes</h2>
              <Link to="/programmes" className="view-all">View All &rarr;</Link>
            </div>
          </FadeIn>
          <div className="programmes-grid">
            {programmes.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <ProgrammeCard programme={p} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <FadeIn>
            <h2>Ready to Begin Your Journey?</h2>
            <p>Create an account and start your application today.</p>
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary btn-lg">Register Now</Link>
              <Link to="/programmes" className="btn btn-secondary btn-lg">Browse Programmes</Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
