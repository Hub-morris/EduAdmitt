import express from 'express';
import pool from '../config/db.js';

const router = express.Router();
const defaultFacultyName = 'General Studies';
const defaultDepartments = [
  'Business Administration',
  'Accounting',
  'Economics',
  'Marketing',
  'Finance',
  'Human Resource Management',
  'Information Technology',
  'Computer Science',
  'Software Engineering',
  'Data Science',
  'Cybersecurity',
  'Computer Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Architecture',
  'Nursing',
  'Public Health',
  'Pharmacy',
  'Medicine',
  'Education',
  'Early Childhood Education',
  'Special Needs Education',
  'Law',
  'International Relations',
  'Political Science',
  'Psychology',
  'Sociology',
  'Environmental Science',
  'Agriculture',
  'Hospitality and Tourism Management',
  'Media and Communication',
  'Creative Arts',
  'Design',
  'Music',
  'Physics',
  'Chemistry',
  'Biology',
  'Statistics',
  'Mathematics',
  'Sport Science',
  'Journalism',
  'Environmental Engineering',
];

async function ensureDefaultDepartments() {
  const countResult = await pool.query('SELECT COUNT(*) FROM departments');
  if (parseInt(countResult.rows[0].count, 10) > 0) return;

  let facultyId;
  const facultyResult = await pool.query('SELECT id FROM faculties WHERE name = $1', [defaultFacultyName]);
  if (facultyResult.rows.length) {
    facultyId = facultyResult.rows[0].id;
  } else {
    const inserted = await pool.query(
      'INSERT INTO faculties (name, description) VALUES ($1, $2) RETURNING id',
      [defaultFacultyName, 'Default faculty for seeded institution departments']
    );
    facultyId = inserted.rows[0].id;
  }

  for (const name of defaultDepartments) {
    await pool.query(
      `INSERT INTO departments (faculty_id, name, description)
        SELECT $1, $2, $3
        WHERE NOT EXISTS (
          SELECT 1 FROM departments WHERE name = $2
        )`,
      [facultyId, name, `${name} department`]
    );
  }
}

router.get('/faculties', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM faculties ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch faculties' });
  }
});

router.get('/departments', async (req, res) => {
  try {
    await ensureDefaultDepartments();
    const { facultyId } = req.query;
    let query = 'SELECT d.*, f.name as faculty_name FROM departments d LEFT JOIN faculties f ON f.id = d.faculty_id';
    const params = [];
    if (facultyId) {
      query += ' WHERE d.faculty_id = $1';
      params.push(facultyId);
    }
    query += ' ORDER BY d.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.get('/programmes', async (req, res) => {
  try {
    const { search, facultyId, departmentId, minCost, maxCost, type, degree } = req.query;
    let query = `
      SELECT p.*, d.name as department_name, f.name as faculty_name, f.id as faculty_id
      FROM programmes p
      JOIN departments d ON d.id = p.department_id
      LEFT JOIN faculties f ON f.id = d.faculty_id
      WHERE p.is_active = true
    `;
    const params = [];
    let idx = 1;

    if (search) {
      query += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR p.code ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (facultyId) {
      query += ` AND f.id = $${idx++}`;
      params.push(facultyId);
    }
    if (departmentId) {
      query += ` AND d.id = $${idx++}`;
      params.push(departmentId);
    }
    if (minCost) {
      query += ` AND p.fees >= $${idx++}`;
      params.push(minCost);
    }
    if (maxCost) {
      query += ` AND p.fees <= $${idx++}`;
      params.push(maxCost);
    }
    if (type) {
      query += ` AND p.type ILIKE $${idx++}`;
      params.push(type);
    }
    if (degree) {
      query += ` AND p.degree ILIKE $${idx++}`;
      params.push(degree);
    }

    query += ' ORDER BY p.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch programmes' });
  }
});

router.get('/programmes/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, d.name as department_name, f.name as faculty_name
       FROM programmes p
       JOIN departments d ON d.id = p.department_id
       JOIN faculties f ON f.id = d.faculty_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Programme not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch programme' });
  }
});

router.get('/filters', async (_req, res) => {
  try {
    const types = await pool.query('SELECT DISTINCT type FROM programmes WHERE type IS NOT NULL ORDER BY type');
    const degrees = await pool.query('SELECT DISTINCT degree FROM programmes WHERE degree IS NOT NULL ORDER BY degree');
    const costs = await pool.query('SELECT MIN(fees) as min_fees, MAX(fees) as max_fees FROM programmes');
    res.json({
      types: types.rows.map(r => r.type),
      degrees: degrees.rows.map(r => r.degree),
      minFees: costs.rows[0]?.min_fees || 0,
      maxFees: costs.rows[0]?.max_fees || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

router.get('/school', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM school_info LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch school info' });
  }
});

export default router;
