const baseUrl = 'http://localhost:5001/api';

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
    console.log(`   [DEBUG] ${method} ${fullUrl}`);
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

async function runPaymentSubmissionTest(testNum) {
  console.log(`\n========== TEST ${testNum} ==========`);
  const timestamp = Date.now();
  const email = `test${timestamp}-${testNum}@eduadmit.test`;
  const password = 'TestPass123!';

  try {
    // 1. Register user
    console.log(`1. Registering user: ${email}`);
    const registerRes = await makeRequest('POST', '/auth/register', { email, password, fullName: `Test User ${testNum}` });
    if (registerRes.status !== 201) {
      throw new Error(`Register failed: ${registerRes.status} - ${JSON.stringify(registerRes.data)}`);
    }
    console.log(`   ✓ Registered`);

    // 2. Login to get token
    console.log(`2. Logging in`);
    const loginRes = await makeRequest('POST', '/auth/login', { email, password });
    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${loginRes.status} - ${JSON.stringify(loginRes.data)}`);
    }
    const token = loginRes.data.token;
    console.log(`   ✓ Logged in, token: ${token.substring(0, 20)}...`);

    // 3. Get programmes
    console.log(`3. Fetching programmes`);
    const progsRes = await makeRequest('GET', '/programmes');
    if (progsRes.status !== 200 || !progsRes.data.length) {
      throw new Error(`Get programmes failed: ${progsRes.status}`);
    }
    const programmeId = progsRes.data[0].id;
    console.log(`   ✓ Found programmes, selecting ID ${programmeId}`);

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
      throw new Error(`Create payment failed: ${payRes.status} - ${JSON.stringify(payRes.data)}`);
    }
    const paymentId = payRes.data.paymentId;
    console.log(`   ✓ Payment created, ID: ${paymentId}`);

    // 6. Confirm payment manually (simulate successful M-PESA)
    console.log(`6. Confirming payment`);
    const confirmRes = await makeRequest('POST', `/payments/${paymentId}/confirm`, {}, { 'Authorization': `Bearer ${token}` });
    if (confirmRes.status !== 200) {
      throw new Error(`Confirm payment failed: ${confirmRes.status} - ${JSON.stringify(confirmRes.data)}`);
    }
    console.log(`   ✓ Payment confirmed`);

    // 7. Verify payment status is now completed
    console.log(`7. Verifying payment status`);
    const statusRes = await makeRequest('GET', `/payments/${paymentId}`, null, { 'Authorization': `Bearer ${token}` });
    if (statusRes.status !== 200) {
      throw new Error(`Get payment status failed: ${statusRes.status}`);
    }
    const paymentStatus = statusRes.data.status;
    console.log(`   ✓ Payment status: ${paymentStatus}`);
    if (paymentStatus !== 'completed') {
      throw new Error(`Payment status is ${paymentStatus}, expected completed`);
    }

    // 8. Submit application (without files for now - just test the submission logic)
    console.log(`8. Submitting application`);
    const submitData = {
      programmeId,
      paymentId,
      fullName: `Test User ${testNum}`,
      dateOfBirth: '2000-01-15',
      gender: 'M',
      idNumber: `ID${timestamp}${testNum}`,
      email,
      phone: '254700686117',
      address: 'Test Address',
      county: 'Nairobi',
      emergencyContactName: 'Emergency Contact',
      emergencyContactPhone: '254700686118',
      kcseIndex: 'A12345',
      kcseGrade: 'A',
      previousSchool: 'Test School',
    };

    // Note: For simplicity, we're testing without actual file uploads
    // In production, the frontend handles file upload via FormData
    const submitRes = await makeRequest('POST', '/applications/submit', submitData, { 'Authorization': `Bearer ${token}` });
    
    if (submitRes.status === 201) {
      console.log(`   ✓ Application submitted successfully`);
      testResults.push({ test: testNum, status: 'PASS', applicationId: submitRes.data.applicationId });
      return true;
    } else if (submitRes.status === 400) {
      const error = submitRes.data.error || 'Unknown error';
      throw new Error(`Submit failed (400): ${error}`);
    } else {
      throw new Error(`Submit failed: ${submitRes.status} - ${JSON.stringify(submitRes.data)}`);
    }
  } catch (err) {
    console.log(`   ✗ FAILED: ${err.message}`);
    testResults.push({ test: testNum, status: 'FAIL', error: err.message });
    return false;
  }
}

async function runAllTests() {
  console.log(`Starting payment + submission stability test (5 iterations)\n`);
  
  const results = [];
  for (let i = 1; i <= 5; i++) {
    const success = await runPaymentSubmissionTest(i);
    results.push(success);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }

  // Summary
  console.log(`\n========== TEST SUMMARY ==========`);
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  console.log(`\nTotal: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(2)}%`);

  if (failed > 0) {
    console.log(`\nFailed Tests:`);
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  Test ${r.test}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log(`\n✓ All tests passed!`);
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
