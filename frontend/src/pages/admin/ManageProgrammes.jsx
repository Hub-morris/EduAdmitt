import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api, { formatCurrency } from '../../api/client';

const initialForm = {
  departmentId: '', name: '', code: '', duration: '', fees: '',
  minQualification: 'C+', minGradePoints: 7, intake: '', type: 'Full-time', degree: 'Bachelor',
  description: '', overview: '', requirements: '', modules: '', career: '', imageUrl: '',
};

export default function ManageProgrammes() {
  const [programmes, setProgrammes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [editingProgramme, setEditingProgramme] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const loadProgrammes = async (page = 1) => {
    const [progRes, deptRes] = await Promise.all([
      api.get('/admin/programmes', { params: { page, limit: 10 } }),
      api.get('/departments'),
    ]);
    setProgrammes(Array.isArray(progRes.data.data) ? progRes.data.data : []);
    setPagination(progRes.data.pagination || {});
    setCurrentPage(page);
    setDepartments(Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data && Array.isArray(deptRes.data.departments) ? deptRes.data.departments : []));
    setLoading(false);
  };

  useEffect(() => {
    loadProgrammes().catch(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setImageFile(null);
    setImagePreview('');
    setEditingProgramme(null);
    setShowForm(false);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(editingProgramme?.image_url || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      if (key === 'fees' || key === 'minGradePoints') return;
      payload.append(key, value);
    });

    if (imageFile) payload.append('image', imageFile);
    if (!imageFile && form.imageUrl) payload.append('imageUrl', form.imageUrl);

    payload.append('fees', Number(form.fees || 0));
    payload.append('minGradePoints', Number(form.minGradePoints || 0));

    try {
      if (editingProgramme) {
        await api.put(`/admin/programmes/${editingProgramme.id}`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessage('Programme updated successfully');
      } else {
        await api.post('/admin/programmes', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessage('Programme created successfully');
      }
      await loadProgrammes(currentPage);
      resetForm();
      setShowForm(false);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save programme');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (programme) => {
    setEditingProgramme(programme);
    setShowForm(true);
    setForm({
      departmentId: programme.department_id || '',
      name: programme.name || '',
      code: programme.code || '',
      duration: programme.duration || '',
      fees: programme.fees || '',
      minQualification: programme.min_qualification || 'C+',
      minGradePoints: programme.min_grade_points || 7,
      intake: programme.intake || '',
      type: programme.type || 'Full-time',
      degree: programme.degree || 'Bachelor',
      description: programme.description || '',
      overview: programme.overview || '',
      requirements: programme.requirements || '',
      modules: programme.modules || '',
      career: programme.career || '',
      imageUrl: programme.image_url || '',
    });
    setImagePreview(programme.image_url || '');
    setImageFile(null);
    setMessage('');
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    try {
      await api.delete(`/admin/programmes/${confirmTarget.id}`);
      setMessage(`Programme ${confirmTarget.name} deleted successfully`);
      setConfirmTarget(null);
      await loadProgrammes(currentPage);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete programme');
    } finally {
      setConfirmTarget(null);
    }
  };

  if (loading) return <AdminLayout><div className="page-loader"><div className="spinner" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Manage Programmes</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Add, edit, and remove university programmes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setMessage(''); setShowForm(!showForm); if (showForm) resetForm(); else setShowForm(true); }}>
          {showForm ? 'Cancel' : '+ Add Programme'}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>{editingProgramme ? 'Edit Programme' : 'New Programme'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
                <select name="departmentId" className="form-select" value={form.departmentId} onChange={handleChange} required>
                  <option value="">Select...</option>
                  {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name} ({d.faculty_name})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Programme Name</label>
                <input name="name" className="form-input" value={form.name} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Code</label>
                <input name="code" className="form-input" value={form.code} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fees (KES/yr)</label>
                <input name="fees" type="number" className="form-input" value={form.fees} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duration</label>
                <input name="duration" className="form-input" value={form.duration} onChange={handleChange} placeholder="4 Years" required />
              </div>
              <div className="form-group">
                <label className="form-label">Min Qualification</label>
                <input name="minQualification" className="form-input" value={form.minQualification} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select name="type" className="form-select" value={form.type} onChange={handleChange}>
                  <option>Full-time</option>
                  <option>Part-time</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Degree</label>
                <select name="degree" className="form-select" value={form.degree} onChange={handleChange}>
                  <option>Bachelor</option>
                  <option>Diploma</option>
                  <option>Master</option>
                  <option>Certificate</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Intake</label>
              <input name="intake" className="form-input" value={form.intake} onChange={handleChange} placeholder="January & September" required />
            </div>
            <div className="form-group">
              <label className="form-label">Photo / Thumbnail</label>
              <input type="file" accept="image/*" className="form-input" onChange={handleFileChange} />
              <input name="imageUrl" className="form-input" style={{ marginTop: '0.75rem' }} value={form.imageUrl} onChange={handleChange} placeholder="Or paste an image URL" />
              {imagePreview && (
                <img src={imagePreview} alt="Programme preview" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '12px', marginTop: '0.75rem' }} />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-input" rows="3" value={form.description} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Overview</label>
              <textarea name="overview" className="form-input" rows="3" value={form.overview} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Requirements</label>
              <textarea name="requirements" className="form-input" rows="3" value={form.requirements} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Modules</label>
              <textarea name="modules" className="form-input" rows="3" value={form.modules} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Career</label>
              <textarea name="career" className="form-input" rows="3" value={form.career} onChange={handleChange} />
            </div>
            <button type="submit" className="btn btn-success" disabled={submitting}>
              {submitting ? 'Saving...' : editingProgramme ? 'Save Changes' : 'Create Programme'}
            </button>
          </form>
        </div>
      )}

      {confirmTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '480px', width: '90%' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--primary-dark)' }}>Confirm Delete</h3>
            <p style={{ marginBottom: '1.25rem' }}>
              Are you sure you want to delete <strong>{confirmTarget.name}</strong>? It will no longer appear to students.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="card table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Code</th>
              <th>Name</th>
              <th>Faculty</th>
              <th>Fees</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(programmes || []).map(p => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px' }} /> : '—'}
                </td>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.faculty_name}</td>
                <td>{formatCurrency(p.fees)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(p)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmTarget({ id: p.id, name: p.name })}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', padding: '1rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => loadProgrammes(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => loadProgrammes(page)}
              >
                {page}
              </button>
            ))}
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => loadProgrammes(currentPage + 1)}
              disabled={currentPage === pagination.pages}
            >
              Next
            </button>
            <span style={{ marginLeft: '1rem', color: 'var(--gray)', fontSize: '0.875rem' }}>
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
