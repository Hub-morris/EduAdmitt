import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = 'http://localhost:5001/api';
const uploadsDir = path.join(__dirname, '../../uploads-test');

// Create test uploads directory
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const testResults = [];

async function makeRequest(method, endpoint, data = null, headers = {}) {
  const fullUrl = baseUrl + endpoint;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(fullUrl, options);
    const body = await res.text();
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
    return { status: res.status, data: parsed };
  } catch (err) {
    throw err;
  }
}

async function uploadFormData(endpoint, formData, token) {
  const fullUrl = baseUrl + endpoint;
  const options = {
    method: 'POST',
    headers: {
      ...( token && { 'Authorization': `Bearer ${token}` }),
    },
    body: formData,
  };

  try {
    const res = await fetch(fullUrl, options);
    const body = await res.text();
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
    return { status: res.status, data: parsed };
  } catch (err) {
    throw err;
  }
}

function createMockFile(name) {
  const filepath = path.join(uploadsDir, `${Date.now()}-${name}`);
  const ext = path.extname(name);
  
  // Create a minimal valid file based on extension
  let content;
  if (ext === '.pdf') {
    content = Buffer.from('%PDF-1.4\n%fake pdf content\n', 'utf-8');
  } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    // Create a minimal valid JPEG header
    content = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  } else {
    content = Buffer.from('mock file content', 'utf-8');
  }
  
  fs.writeFileSync(filepath, content);
  return filepath;
}

async function runPaymentSubmissionTest(testNum) {
  console.log(`\n========== TEST ${testNum} ==========`);
  const timestamp = Date.now();
  const email = `test${timestamp}-${testNum}@eduadmit.test`;
  const password = 'TestPass123!';

  try {
    // 1. Register user
    console.log(`1. Registering user`);
    const registerRes = await makeRequest('POST', '/auth/register', { email, password, fullName: `Test User ${testNum}` });
    if (registerRes.status !== 201) {
      throw new Error(`Register failed: ${registerRes.status}`);
    }
    console.log(`   ✓ Registered`);

    // 2. Login
    console.log(`2. Logging in`);
    const loginRes = await makeRequest('POST', '/auth/login', { email, password });
    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }
    const token = loginRes.data.token;
    console.log(`   ✓ Logged in`);

    // 3. Get programmes
    console.log(`3. Fetching programmes`);
    const progsRes = await makeRequest('GET', '/programmes');
    if (progsRes.status !== 200 || !Array.isArray(progsRes.data) || !progsRes.data.length) {
      throw new Error(`Get programmes failed: ${progsRes.status}`);
    }
    const programmeId = progsRes.data[0].id;
    console.log(`   ✓ Found programmes`);

    // 4. Select programme
    console.log(`4. Selecting programme`);
    const selectRes = await makeRequest('POST', '/applications/select-programme', { programmeId }, { 'Authorization': `Bearer ${token}` });
    if (selectRes.status !== 200) {
      throw new Error(`Select programme failed: ${selectRes.status}`);
    }
    console.log(`   ✓ Programme selected`);

    // 5. Create payment
    console.log(`5. Creating payment`);
    const payRes = await makeRequest('POST', '/payments', { applicationId: null, amount: 1, currency: 'KES' }, { 'Authorization': `Bearer ${token}` });
    if (payRes.status !== 201 || !payRes.data.paymentId) {
      throw new Error(`Create payment failed: ${payRes.status}`);
    }
    const paymentId = payRes.data.paymentId;
    console.log(`   ✓ Payment created`);

    // 6. Confirm payment
    console.log(`6. Confirming payment`);
    const confirmRes = await makeRequest('POST', `/payments/${paymentId}/confirm`, {}, { 'Authorization': `Bearer ${token}` });
    if (confirmRes.status !== 200) {
      throw new Error(`Confirm payment failed: ${confirmRes.status}`);
    }
    console.log(`   ✓ Payment confirmed`);

    // 7. Verify payment status
    console.log(`7. Verifying payment status`);
    const statusRes = await makeRequest('GET', `/payments/${paymentId}`, null, { 'Authorization': `Bearer ${token}` });
    if (statusRes.status !== 200 || statusRes.data.status !== 'completed') {
      throw new Error(`Payment status check failed or not completed`);
    }
    console.log(`   ✓ Payment confirmed as completed`);

    // 8. Submit application WITH file uploads
    console.log(`8. Submitting application with file uploads`);
    const formData = new FormData();
    
    // Add form fields
    formData.append('programmeId', String(programmeId));
    formData.append('paymentId', String(paymentId));
    formData.append('fullName', `Test User ${testNum}`);
    formData.append('dateOfBirth', '2000-01-15');
    formData.append('gender', 'M');
    formData.append('idNumber', `ID${timestamp}${testNum}`);
    formData.append('email', email);
    formData.append('phone', '254700686117');
    formData.append('address', 'Test Address');
    formData.append('county', 'Nairobi');
    formData.append('emergencyContactName', 'Emergency Contact');
    formData.append('emergencyContactPhone', '254700686118');
    formData.append('kcseIndex', 'A12345');
    formData.append('kcseGrade', 'A');
    formData.append('previousSchool', 'Test School');

    // Add mock files
    const kcseFile = createMockFile('kcse_certificate.pdf');
    const idFile = createMockFile('national_id.pdf');
    const photoFile = createMockFile('passport_photo.jpg');

    // Read files and append to FormData
    const kcseContent = fs.readFileSync(kcseFile);
    const idContent = fs.readFileSync(idFile);
    const photoContent = fs.readFileSync(photoFile);

    // For Node.js fetch, we need to use a Blob
    formData.append('kcse_certificate', new Blob([kcseContent], { type: 'application/pdf' }), 'kcse_certificate.pdf');
    formData.append('national_id', new Blob([idContent], { type: 'application/pdf' }), 'national_id.pdf');
    formData.append('passport_photo', new Blob([photoContent], { type: 'image/jpeg' }), 'passport_photo.jpg');

    const submitRes = await uploadFormData('/applications/submit', formData, token);
    
    if (submitRes.status === 201) {
      console.log(`   ✓ Application submitted successfully`);
      const appId = submitRes.data.applicationId;
      testResults.push({ test: testNum, status: 'PASS', applicationId: appId });
      return true;
    } else if (submitRes.status === 400) {
      throw new Error(`Submit failed: ${submitRes.data.error || 'Unknown error'}`);
    } else {
      throw new Error(`Submit failed with status ${submitRes.status}`);
    }
  } catch (err) {
    console.log(`   ✗ FAILED: ${err.message}`);
    testResults.push({ test: testNum, status: 'FAIL', error: err.message });
    return false;
  }
}

async function runAllTests() {
  console.log(`Starting comprehensive payment + submission test (5 iterations)\n`);
  
  const results = [];
  for (let i = 1; i <= 5; i++) {
    const success = await runPaymentSubmissionTest(i);
    results.push(success);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log(`\n========== FINAL TEST SUMMARY ==========`);
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(2)}%`);

  if (passed === results.length) {
    console.log(`\n🎉 ALL TESTS PASSED - Payment + Submission flow is stable!`);
    process.exit(0);
  } else {
    console.log(`\nFailed Tests:`);
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  Test ${r.test}: ${r.error}`);
    });
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
