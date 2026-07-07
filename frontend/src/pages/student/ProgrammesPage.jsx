import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ProgrammeCard from '../../components/ProgrammeCard';
import FadeIn from '../../components/FadeIn';
import api from '../../api/client';
import './ProgrammesPage.css';

export default function ProgrammesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [programmes, setProgrammes] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [type, setType] = useState('');
  const [degree, setDegree] = useState('');
  const [minCost, setMinCost] = useState('');
  const [maxCost, setMaxCost] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/faculties'),
      api.get('/filters'),
      api.get('/departments'),
    ]).then(([facRes, filterRes, deptRes]) => {
      setFaculties(Array.isArray(facRes.data) ? facRes.data : (facRes.data && Array.isArray(facRes.data.faculties) ? facRes.data.faculties : []));
      setFilters(filterRes.data || {});
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data && Array.isArray(deptRes.data.departments) ? deptRes.data.departments : []));
    });
  }, []);

  useEffect(() => {
    if (facultyId) {
      api.get(`/departments?facultyId=${facultyId}`).then(({ data }) => setDepartments(data));
    }
  }, [facultyId]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (facultyId) params.set('facultyId', facultyId);
    if (departmentId) params.set('departmentId', departmentId);
    if (type) params.set('type', type);
    if (degree) params.set('degree', degree);
    if (minCost) params.set('minCost', minCost);
    if (maxCost) params.set('maxCost', maxCost);

    api.get(`/programmes?${params}`)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.programmes) ? data.programmes : []);
        setProgrammes(list);
      })
      .finally(() => setLoading(false));
  }, [search, facultyId, departmentId, type, degree, minCost, maxCost]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(e.target.search.value);
  };

  const activeFilters = [
    search && { label: `Search: "${search}"`, clear: () => setSearch('') },
    facultyId && { label: faculties.find((f) => String(f.id) === facultyId)?.name, clear: () => setFacultyId('') },
    departmentId && { label: departments.find((d) => String(d.id) === departmentId)?.name, clear: () => setDepartmentId('') },
    type && { label: type, clear: () => setType('') },
    degree && { label: degree, clear: () => setDegree('') },
    minCost && { label: `Min KES ${Number(minCost).toLocaleString()}`, clear: () => setMinCost('') },
    maxCost && { label: `Max KES ${Number(maxCost).toLocaleString()}`, clear: () => setMaxCost('') },
  ].filter(Boolean);

  return (
    <div className="page-layout">
      <Navbar />
      <main className="container page-content">
        <FadeIn>
          <h1 className="page-title">Search Programmes</h1>
          <p className="page-subtitle">Find the perfect programme for your career goals</p>
        </FadeIn>

        <div className="programmes-layout">
          <aside className="filters-panel card">
            <h3>Filters</h3>
            <form onSubmit={handleSearch}>
              <div className="form-group">
                <label className="form-label">Search</label>
                <input name="search" className="form-input" defaultValue={search} placeholder="Programme name..." />
              </div>
            </form>
            <div className="form-group">
              <label className="form-label">Faculty</label>
              <select className="form-select" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                <option value="">All Faculties</option>
                {(faculties || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">All Departments</option>
                {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All Types</option>
                {(filters.types || []).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Degree</label>
              <select className="form-select" value={degree} onChange={(e) => setDegree(e.target.value)}>
                <option value="">All Degrees</option>
                {(filters.degrees || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cost Range (KES/yr)</label>
              <div className="cost-range">
                <input type="number" className="form-input" value={minCost} onChange={(e) => setMinCost(e.target.value)} placeholder={`Min ${filters.minFees || 0}`} />
                <span className="cost-range-sep">–</span>
                <input type="number" className="form-input" value={maxCost} onChange={(e) => setMaxCost(e.target.value)} placeholder={`Max ${filters.maxFees || 200000}`} />
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFacultyId(''); setDepartmentId(''); setType(''); setDegree(''); setMinCost(''); setMaxCost(''); }}>
              Clear Filters
            </button>
          </aside>

          <div className="programmes-results">
            {activeFilters.length > 0 && (
              <div className="active-filters">
                {activeFilters.map((f) => (
                  <button key={f.label} type="button" className="filter-chip" onClick={f.clear}>
                    {f.label} <span aria-hidden="true">&times;</span>
                  </button>
                ))}
              </div>
            )}
            {loading ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : programmes.length === 0 ? (
              <div className="empty-state card"><p>No programmes found matching your criteria.</p></div>
            ) : (
              <>
                <p className="results-count">{programmes.length} programme{programmes.length !== 1 ? 's' : ''} found</p>
                <div className="programmes-grid">
                  {(programmes || []).map((p) => <ProgrammeCard key={p.id} programme={p} />)}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
