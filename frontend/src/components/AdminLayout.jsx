import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt,
  faUniversity,
  faSitemap,
  faBookOpen,
  faClipboardList,
  faCreditCard,
  faUsers,
  faBars,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: faTachometerAlt, exact: true },
  { to: '/admin/programmes', label: 'Programmes', icon: faBookOpen },
  { to: '/admin/departments', label: 'Departments', icon: faSitemap },
  { to: '/admin#applications', label: 'Applications', icon: faClipboardList, anchor: 'applications' },
  { to: '/admin#payments', label: 'Payments', icon: faCreditCard, anchor: 'payments' },
  { to: '/admin#users', label: 'Users', icon: faUsers, anchor: 'users' },
];

export default function AdminLayout({ children }) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (item) => {
    const targetPath = item.to.split('#')[0];
    const pathMatch = item.exact ? location.pathname === targetPath : location.pathname.startsWith(targetPath);
    const hashMatch = !item.anchor || location.hash === `#${item.anchor}`;
    return pathMatch && hashMatch;
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/images/logo.png" alt="EduAdmit Admin logo" className="sidebar-logo" />
          EduAdmit Admin
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-link ${isActive(item) ? 'active' : ''}`}
              onClick={() => {
                setSidebarOpen(false);
                if (item.anchor) {
                  window.location.hash = item.anchor;
                }
              }}
            >
              <span className="sidebar-icon">
                <FontAwesomeIcon icon={item.icon} />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <button className="sidebar-logout" onClick={handleLogout}>Logout</button>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <span className="admin-header-title">Administration Panel</span>
        </header>
        <div className="admin-content">{children}</div>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
