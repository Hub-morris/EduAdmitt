import bcrypt from 'bcryptjs';
import pool, { initDb } from './config/db.js';
import { fileURLToPath } from 'url';

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
  'Architecture and Built Environment',
  'Information Systems',
  'Health Sciences',
  'Tourism and Hospitality',
  'Environmental Engineering',
];

export async function seedData() {
  await initDb();

  const adminEmail = 'eduadmitt2@gmail.com';
  const adminPassword = 'admin123';
  const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

  if (existingAdmin.rows.length === 0) {
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name, is_email_verified, last_login_at) VALUES ($1, $2, $3, $4, TRUE, NOW())',
      [adminEmail, adminHash, 'admin', 'System Administrator']
    );
    console.log(`Admin user created successfully! Admin login: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`Admin user ${adminEmail} already exists. Skipping admin creation.`);
  }

  const facultyResult = await pool.query('SELECT id FROM faculties WHERE name = $1', [defaultFacultyName]);
  let facultyId;
  if (facultyResult.rows.length > 0) {
    facultyId = facultyResult.rows[0].id;
  } else {
    const facultyInsert = await pool.query(
      'INSERT INTO faculties (name, description) VALUES ($1, $2) RETURNING id',
      [defaultFacultyName, 'Default faculty for seeded academic departments']
    );
    facultyId = facultyInsert.rows[0].id;
    console.log(`Created default faculty "${defaultFacultyName}"`);
  }

  for (const departmentName of defaultDepartments) {
    await pool.query(
      `INSERT INTO departments (faculty_id, name, description)
       SELECT $1::INTEGER, $2::VARCHAR, $3::TEXT
       WHERE NOT EXISTS (
         SELECT 1 FROM departments WHERE name = $2::VARCHAR
       )`,
      [facultyId, departmentName, `${departmentName} department`]
    );
  }

  await seedProgrammes();
  console.log('Default institution departments and programmes seeded.');
}

const sampleProgrammes = [
  {
    name: 'Bachelor of Science in Computer Science',
    code: 'BSC-CS',
    department: 'Computer Science',
    description: 'A comprehensive undergraduate programme in computing, software engineering, and data systems.',
    duration: '4 Years',
    fees: 120000,
    minQualification: 'C+',
    minGradePoints: 8,
    intake: 'January & September',
    type: 'Full-time',
    degree: 'Bachelor',
    overview: 'Build software solutions, learn programming, algorithms, and systems design.',
    requirements: 'KCSE Mean Grade C+ or equivalent, with a minimum of C in Mathematics and English.',
    modules: 'Programming, Data Structures, Operating Systems, Database Systems, Web Development.',
    career: 'Software Developer, Systems Analyst, Data Scientist, IT Consultant.',
    imageUrl: null,
  },
  {
    name: 'Diploma in Business Administration',
    code: 'DIP-BA',
    department: 'Business Administration',
    description: 'A practical diploma programme covering business operations, management, and entrepreneurship.',
    duration: '2 Years',
    fees: 80000,
    minQualification: 'C',
    minGradePoints: 6,
    intake: 'January & September',
    type: 'Full-time',
    degree: 'Diploma',
    overview: 'Gain skills to manage business processes, finance, marketing, and administration.',
    requirements: 'KCSE Mean Grade C or equivalent.',
    modules: 'Business Management, Accounting, Marketing, Human Resource Management.',
    career: 'Business Administrator, Office Manager, Sales Executive, Entrepreneur.',
    imageUrl: null,
  },
  {
    name: 'Diploma in Information Technology',
    code: 'DIP-IT',
    department: 'Information Technology',
    description: 'Focused IT training for network administration, systems support, and application deployment.',
    duration: '2 Years',
    fees: 90000,
    minQualification: 'C',
    minGradePoints: 6,
    intake: 'January & September',
    type: 'Full-time',
    degree: 'Diploma',
    overview: 'Learn how to manage IT infrastructure, support users, and deploy modern systems.',
    requirements: 'KCSE Mean Grade C or equivalent.',
    modules: 'Networking, Database Administration, IT Support, Web Technologies.',
    career: 'IT Technician, Network Administrator, Systems Support Specialist.',
    imageUrl: null,
  },
  {
    name: 'Diploma in Nursing',
    code: 'DIP-NUR',
    department: 'Nursing',
    description: 'A clinical programme preparing students for work in health facilities and community care.',
    duration: '3 Years',
    fees: 110000,
    minQualification: 'C+',
    minGradePoints: 7,
    intake: 'January',
    type: 'Full-time',
    degree: 'Diploma',
    overview: 'Develop clinical nursing skills, patient care, and health education techniques.',
    requirements: 'KCSE Mean Grade C+ or equivalent, including C in Biology and English.',
    modules: 'Anatomy, Physiology, Pharmacology, Clinical Nursing Practice.',
    career: 'Enrolled Nurse, Clinical Nurse Assistant, Health Services Officer.',
    imageUrl: null,
  },
  {
    name: 'Certificate in Cybersecurity',
    code: 'CERT-CS',
    department: 'Cybersecurity',
    description: 'An entry-level certificate focusing on digital safety, threat detection, and network protection.',
    duration: '1 Year',
    fees: 50000,
    minQualification: 'D+',
    minGradePoints: 4,
    intake: 'January & September',
    type: 'Full-time',
    degree: 'Certificate',
    overview: 'Study the fundamentals of cybersecurity, risk management, and secure networks.',
    requirements: 'KCSE Mean Grade D+ or equivalent.',
    modules: 'Network Security, Cyber Threats, Ethical Hacking, Security Policies.',
    career: 'Security Analyst, IT Support Technician, Cybersecurity Assistant.',
    imageUrl: null,
  },
];

async function seedProgrammes() {
  const programmeCount = await pool.query('SELECT COUNT(*) FROM programmes');
  if (parseInt(programmeCount.rows[0].count, 10) > 0) return;

  for (const programme of sampleProgrammes) {
    const deptRes = await pool.query('SELECT id FROM departments WHERE name = $1 LIMIT 1', [programme.department]);
    const departmentId = deptRes.rows[0]?.id;
    if (!departmentId) continue;

    await pool.query(
      `INSERT INTO programmes (department_id, name, code, description, duration, fees,
        min_qualification, min_grade_points, intake, type, degree, overview, requirements, modules, career, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (code) DO NOTHING`,
      [departmentId, programme.name, programme.code, programme.description, programme.duration, programme.fees,
       programme.minQualification, programme.minGradePoints, programme.intake, programme.type, programme.degree,
       programme.overview, programme.requirements, programme.modules, programme.career, programme.imageUrl]
    );
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  seedData().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  }).finally(() => process.exit(0));
}
