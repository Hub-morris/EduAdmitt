import axios from 'axios';

const base = import.meta.env.VITE_API_BASE_URL || '/api';
const api = axios.create({ baseURL: base });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export const formatCurrency = (amount) =>
  `KES ${Number(amount || 0).toLocaleString()}`;

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_verification: 'Under Verification',
  verified: 'Verified',
  qualified: 'Qualified',
  not_qualified: 'Not Qualified',
  admitted: 'Admitted',
  rejected: 'Rejected',
  pending: 'Pending',
  none: 'No Application',
  amendments_needed: 'Amendments Needed',
};
