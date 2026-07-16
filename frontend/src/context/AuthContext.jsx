import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePasswordPrompt, setShowChangePasswordPrompt] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => setUser(data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    // prompt user to consider changing password after login
    setShowChangePasswordPrompt(true);
    return data.user;
  };

  const register = async (email, password, fullName) => {
    const { data } = await api.post('/auth/register', { email, password, fullName });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    // after registering, strongly encourage password change
    setShowChangePasswordPrompt(true);
    return data.user;
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, changePassword, showChangePasswordPrompt, setShowChangePasswordPrompt }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
