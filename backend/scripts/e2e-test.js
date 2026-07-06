/**
 * End-to-end API test for the EduAdmit admission workflow.
 * Usage: node scripts/e2e-test.js [baseUrl]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.argv[2] || 'http://localhost:5000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../uploads-test');

const stamp = Date.now();
const studentEmail = `e2e.student.${stamp}@test.eduadmit.ac.ke`;
const studentPassword = 'TestPass123!';

let passed = 0;
let failed = 0;

function ok(label, detail = '') {
  passed++;
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, err) {
  failed++;
  console.error(`  ✗ ${label}: ${err}`);
}

async function api(method, urlPath, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let bodyPayload = body;
  if (formData) {
    bodyPayload = formData;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    bodyPayload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: bodyPayload });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'object' ? data.error || JSON.stringify(data) : data;
    throw new Error(`${res.status} ${msg}`);
  }
  return data;
}

function makeTestFile(name) {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(filePath, `EduAdmit E2E test file: ${name}`);
  return filePath;
}

async function run() {
  console.log('\nEduAdmit E2E Test');
  console.log('=================');
  console.log(`API: ${BASE}\n`);

  let studentToken;
  let adminToken;
  let programmeId;
  let applicationId;

  try {
    await api('GET', '/health');
    ok('Health check');
  } catch (e) {
    fail('Health check', e.message);
    console.error('\nStart the backend first: cd backend && npm run dev');
    process.exit(1);
  }

  try {
    const programmes = await api('GET', '/programmes?degree=Bachelor');
    if (!programmes.length) throw new Error('No programmes returned');
    programmeId = programmes[0].id;
    ok('Search programmes with filter', `${programmes.length} Bachelor programmes`);
  } catch (e) {
    fail('Search programmes', e.message);
  }

  try {
    const filtered = await api('GET', '/programmes?minCost=80000&maxCost=120000');
    ok('Filter programmes by cost range', `${filtered.length} programmes between 80k–120k`);
  } catch (e) {
    fail('Cost range filter', e.message);
  }

  try {
    const detail = await api('GET', `/programmes/${programmeId}`);
    ok('View programme details', detail.name);
  } catch (e) {
    fail('Programme details', e.message);
  }

  try {
    const reg = await api('POST', '/auth/register', {
      body: { email: studentEmail, password: studentPassword, fullName: 'E2E Test Student' },
    });
    studentToken = reg.token;
    ok('Student registration', studentEmail);
  } catch (e) {
    fail('Student registration', e.message);
  }

  try {
    await api('POST', '/applications/select-programme', {
      token: studentToken,
      body: { programmeId },
    });
    ok('Programme selection', `programme #${programmeId}`);
  } catch (e) {
    fail('Programme selection', e.message);
  }

  try {
    const fd = new FormData();
    fd.append('fullName', 'E2E Test Student');
    fd.append('dateOfBirth', '2004-06-15');
    fd.append('gender', 'Female');
    fd.append('idNumber', '12345678');
    fd.append('email', studentEmail);
    fd.append('phone', '+254712345678');
    fd.append('address', '123 Test Street, Nairobi');
    fd.append('county', 'Nairobi');
    fd.append('emergencyContactName', 'Jane Doe');
    fd.append('emergencyContactPhone', '+254798765432');
    fd.append('kcseIndex', '12345678901');
    fd.append('kcseGrade', 'B+');
    fd.append('previousSchool', 'Test High School');
    fd.append('programmeId', String(programmeId));

    for (const [field, filename] of [
      ['kcse_certificate', 'kcse.pdf'],
      ['national_id', 'id.pdf'],
      ['passport_photo', 'photo.jpg'],
    ]) {
      const filePath = makeTestFile(filename);
      const blob = new Blob([fs.readFileSync(filePath)]);
      fd.append(field, blob, filename);
    }

    const paymentRes = await api('POST', '/payments', { token: studentToken, body: { applicationId: null, amount: 1, currency: 'KES' } });
    const applicationPaymentId = paymentRes.paymentId;
    await api('POST', `/payments/${applicationPaymentId}/confirm`, { token: studentToken, body: {} });
    fd.append('paymentId', String(applicationPaymentId));

    const submit = await api('POST', '/applications/submit', { token: studentToken, formData: fd });
    applicationId = submit.applicationId;
    ok('Submit application with new fields', `application #${applicationId}`);
  } catch (e) {
    fail('Submit application', e.message);
  }

  try {
    const status = await api('GET', '/applications/status', { token: studentToken });
    if (status.status !== 'submitted') throw new Error(`Expected submitted, got ${status.status}`);
    ok('Student status check', status.status);
  } catch (e) {
    fail('Student status', e.message);
  }

  try {
    const login = await api('POST', '/auth/login', {
      body: { email: 'admin@eduadmit.ac.ke', password: 'admin123' },
    });
    adminToken = login.token;
    ok('Admin login');
  } catch (e) {
    fail('Admin login', e.message);
  }

  try {
    await api('PATCH', `/admin/applications/${applicationId}/verify`, {
      token: adminToken,
      body: { status: 'verified' },
    });
    ok('Admin verification', 'verified');
  } catch (e) {
    fail('Admin verification', e.message);
  }

  try {
    const qualify = await api('POST', `/admin/applications/${applicationId}/qualify`, { token: adminToken });
    if (!qualify.reasoning) throw new Error('Missing AI reasoning');
    if (!qualify.qualified) throw new Error('Expected qualified for B+ applicant');
    ok('AI qualification check', `${qualify.reasoningSource} — ${qualify.reasoning.slice(0, 60)}...`);
  } catch (e) {
    fail('AI qualification check', e.message);
  }

  try {
    const admit = await api('POST', `/admin/applications/${applicationId}/admit`, {
      token: adminToken,
      body: { intake: 'September 2026', reportingDate: '2026-09-01' },
    });
    ok('Admission offer', admit.admissionNumber);
  } catch (e) {
    fail('Admission offer', e.message);
  }

  try {
    const finalStatus = await api('GET', '/applications/status', { token: studentToken });
    if (finalStatus.admission_status !== 'admitted') throw new Error('Not admitted');
    if (!finalStatus.qualification_reasoning) throw new Error('Missing qualification reasoning on status');
    ok('Final student status with AI reasoning', finalStatus.admission_status);
  } catch (e) {
    fail('Final student status', e.message);
  }

  try {
    const letterRes = await fetch(`${BASE}/letters/${applicationId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (!letterRes.ok) throw new Error(`${letterRes.status}`);
    const letter = await letterRes.json();
    ok('Offer letter data', letter.admission_number);
  } catch (e) {
    fail('Offer letter data', e.message);
  }

  console.log('\n-----------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('All E2E tests passed!\n');
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
