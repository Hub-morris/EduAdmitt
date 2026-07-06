import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/client';

const initialForm = {
  facultyId: '',
  name: '',
  description: '',
};

export default function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [deptRes, facultyRes] = await Promise.all([
        api.get('/admin/departments'),
        api.get('/faculties'),
      ]);
      setDepartments(deptRes.data);
      setFaculties(facultyRes.data);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Unable to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingDepartment(null);
    setShowForm(false);
    setMessage('');
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    if (!form.facultyId || !form.name.trim()) {
      setMessage('Faculty and department name are required.');
      setSubmitting(false);
      return;
    }

    try {
      if (editingDepartment) {
        await api.put(`/admin/departments/${editingDepartment.id}`, form);
        setMessage('Department updated successfully.');
      } else {
        await api.post('/admin/departments', form);
        setMessage('Department created successfully.');
      }
      await loadData();
      resetForm();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setShowForm(true);
    setForm({
      facultyId: String(department.faculty_id || ''),
      name: department.name || '',
      description: department.description || '',
    });
    setMessage('');
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    try {
      await api.delete(`/admin/departments/${confirmTarget.id}`);
      setMessage(`Department ${confirmTarget.name} deleted successfully.`);
      setDepartments(departments.filter((d) => d.id !== confirmTarget.id));
      setConfirmTarget(null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete department');
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Manage Departments</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Create, edit, and remove departments available for programmes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); if (!showForm) { setMessage(''); setEditingDepartment(null); setForm(initialForm); } else resetForm(); }}>
          {showForm ? 'Cancel' : '+ Add Department'}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>{editingDepartment ? 'Edit Department' : 'New Department'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Faculty</label>
                <select name="facultyId" className="form-select" value={form.facultyId} onChange={handleChange} required>
                  <option value="">Select a faculty...</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Department Name</label>
                <input name="name" className="form-input" value={form.name} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-input" rows="3" value={form.description} onChange={handleChange} />
            </div>

            <button type="submit" className="btn btn-success" disabled={submitting}>
              {submitting ? 'Saving...' : editingDepartment ? 'Save Department' : 'Create Department'}
            </button>
          </form>
        </div>
      )}

      <div className="card table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Faculty</th>
              <th>Description</th>
              <th style={{ width: '190px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td>{department.name}</td>
                <td>{department.faculty_name}</td>
                <td>{department.description || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(department)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmTarget(department)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '480px', width: '90%' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--primary-dark)' }}>Confirm Delete</h3>
            <p style={{ marginBottom: '1.25rem' }}>
              Are you sure you want to delete <strong>{confirmTarget.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
