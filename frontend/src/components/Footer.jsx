import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">EduAdmit University</div>
          <p className="footer-text">Your gateway to quality higher education. Apply online and track your admission journey.</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <Link to="/programmes">Programmes</Link>
          <Link to="/about">About Us</Link>
          <Link to="/register">Apply Now</Link>
        </div>
        <div>
          <h4>Contact</h4>
          <p>admissions@eduadmit.ac.ke</p>
          <p>+254 700 000 000</p>
          <p>Nairobi, Kenya</p>
        </div>
        <div>
          <h4>Campus Location</h4>
          <div className="footer-map">
            <iframe
              title="EduAdmit Campus Map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=36.807,-1.296,36.827,-1.276&layer=mapnik&marker=-1.286389,36.817223"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">&copy; {new Date().getFullYear()} EduAdmit University. All rights reserved.</div>
      </div>
    </footer>
  );
}
