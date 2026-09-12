import { io } from 'socket.io-client';

async function runTelegramVerificationTests() {
  console.log('--- 🧪 STARTING TELEGRAM PHONE VERIFICATION & MATCHING TESTS ---');

  const testPhoneMatch = '0944112233';
  const testPhoneMismatch = '0988776655';
  const testPassword = 'testpassword123';
  const testName = 'Marta Haile';

  // 1. Initiate sign-up request
  console.log('\n1️⃣  Initiating sign-up request for:', testPhoneMatch);
  const initRes = await fetch('http://localhost:3001/api/auth/register-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      phone: testPhoneMatch,
      password: testPassword
    })
  });
  const initData = await initRes.json();
  if (!initData.success) {
    throw new Error('Registration initiation failed: ' + initData.error);
  }
  console.log('✅ Sign-up initiated successfully:', {
    pendingId: initData.pendingId,
    phone: initData.phone,
    botUrl: initData.botUrl
  });

  // 2. Check pending status
  console.log('\n2️⃣  Checking pending registration status before verification...');
  const statusRes1 = await fetch(`http://localhost:3001/api/auth/registration-status/${testPhoneMatch}`);
  const statusData1 = await statusRes1.json();
  console.log('✅ Status retrieved:', statusData1.status);
  if (statusData1.status !== 'pending') {
    throw new Error('Expected status to be pending, got ' + statusData1.status);
  }

  // 3. Test MISMATCH scenario (Telegram shares different number)
  console.log('\n3️⃣  Testing MISMATCH: Sharing mismatched phone number (0988776655) for request (0944112233)...');
  const mismatchRes = await fetch('http://localhost:3001/api/telegram/simulate-contact-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedPhone: testPhoneMatch,
      sharedPhone: testPhoneMismatch,
      tgUserId: 55667788,
      username: 'Marta Haile'
    })
  });
  const mismatchData = await mismatchRes.json();
  console.log('✅ Mismatch correctly denied by server:', mismatchData);
  if (mismatchRes.ok || mismatchData.success) {
    throw new Error('Mismatch should have been rejected!');
  }

  // Verify status is now 'denied'
  const statusResDenied = await fetch(`http://localhost:3001/api/auth/registration-status/${testPhoneMatch}`);
  const statusDataDenied = await statusResDenied.json();
  console.log('✅ Status is now denied:', statusDataDenied);
  if (statusDataDenied.status !== 'denied') {
    throw new Error('Expected status to be denied, got ' + statusDataDenied.status);
  }

  // Verify user cannot login
  const failedLoginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testPhoneMatch,
      password: testPassword
    })
  });
  if (failedLoginRes.status === 401) {
    console.log('✅ Verified: Account was NOT created (Login returned 401 Unauthorized)');
  } else {
    throw new Error('User should NOT exist after denial!');
  }

  // 4. Re-initiate and test MATCH scenario
  console.log('\n4️⃣  Re-initiating sign-up and testing MATCHING phone share...');
  const initRes2 = await fetch('http://localhost:3001/api/auth/register-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      phone: testPhoneMatch,
      password: testPassword
    })
  });
  const initData2 = await initRes2.json();
  console.log('✅ Re-initiated pending request:', initData2.pendingId);

  // Connect socket to verify real-time event
  const socket = io('http://localhost:3001', { transports: ['websocket'] });
  let socketEventReceived = false;

  const socketPromise = new Promise<void>((resolve) => {
    socket.on('REGISTRATION_SUCCESS', (data: any) => {
      console.log('⚡ Socket event received: REGISTRATION_SUCCESS for phone', data.phone);
      socketEventReceived = true;
      resolve();
    });
  });

  // Simulate contact share with MATCHING number
  const matchRes = await fetch('http://localhost:3001/api/telegram/simulate-contact-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedPhone: testPhoneMatch,
      sharedPhone: testPhoneMatch,
      tgUserId: 55667788,
      username: testName
    })
  });
  const matchData = await matchRes.json();
  if (!matchRes.ok || !matchData.success) {
    throw new Error('Matching share failed: ' + (matchData.error || 'unknown'));
  }
  console.log('✅ Account created upon phone match!');
  console.log('   User Player ID:', matchData.user.playerId);
  console.log('   Username:', matchData.user.username);
  console.log('   Wallet Balance:', matchData.user.walletBalance, 'Birr');
  console.log('   Token:', matchData.token);

  await Promise.race([socketPromise, new Promise((r) => setTimeout(r, 2000))]);
  socket.disconnect();

  // 5. Verify user can now log in
  console.log('\n5️⃣  Verifying login with new user credentials...');
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testPhoneMatch,
      password: testPassword
    })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.success) {
    throw new Error('Login failed for newly verified user');
  }
  console.log('✅ Login succeeded! Welcome', loginData.user.username, 'Balance: $' + loginData.user.walletBalance);

  console.log('\n🎉 ALL TELEGRAM VERIFICATION AND PHONE MATCHING TESTS PASSED PERFECTLY! 🎉\n');
  process.exit(0);
}

runTelegramVerificationTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
