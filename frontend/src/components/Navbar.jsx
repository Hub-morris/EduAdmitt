import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <img src="/images/logo.png" alt="EduAdmit logo" className="navbar-logo" />
          EduAdmit
        </Link>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <span className={menuOpen ? 'open' : ''} />
        </button>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/programmes" onClick={() => setMenuOpen(false)}>Programmes</Link>
          <Link to="/about" onClick={() => setMenuOpen(false)}>About</Link>
          {user?.role === 'student' && (
            <>
              <Link to="/select" onClick={() => setMenuOpen(false)}>My Selection</Link>
              <Link to="/apply" onClick={() => setMenuOpen(false)}>Apply</Link>
              <Link to="/status" onClick={() => setMenuOpen(false)}>Status</Link>
              <Link to="/offer-letter" onClick={() => setMenuOpen(false)}>Offer Letter</Link>
            </>
          )}
          {user ? (
            <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
              Logout ({user.fullName?.split(' ')[0] || 'User'})
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm btn-secondary" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="btn btn-sm btn-primary" onClick={() => setMenuOpen(false)}>Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
