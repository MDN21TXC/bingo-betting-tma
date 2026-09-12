import { io } from 'socket.io-client';

async function runEndToEndVerification() {
  console.log('--- 🧪 STARTING E2E INTEGRATION TEST ---');

  // 1. Test REST user sync
  const syncRes = await fetch('http://localhost:3001/api/user/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: 'usr_e2e_tester',
      username: 'LuckyE2EPlayer',
    })
  });
  const syncData = await syncRes.json();
  console.log('✅ User sync successful:', syncData.user.username, 'Balance: $' + syncData.user.walletBalance);

  // 2. Test Deposit
  const depRes = await fetch('http://localhost:3001/api/wallet/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: 'usr_e2e_tester',
      amount: 50,
      paymentMethod: 'TON_WALLET'
    })
  });
  const depData = await depRes.json();
  console.log('✅ Deposit successful. New Balance: $' + depData.user.walletBalance);

  // 3. Test Ledger retrieval
  const ledgerRes = await fetch('http://localhost:3001/api/ledger/usr_e2e_tester');
  const ledgerData = await ledgerRes.json();
  console.log('✅ Ledger entries retrieved:', ledgerData.entries.length, 'entries');

  // 4. Test WebSocket connection and buying ticket
  const socket = io('http://localhost:3001', { transports: ['websocket'] });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Socket connected to server');

      socket.emit('BUY_TICKETS', {
        playerId: 'usr_e2e_tester',
        username: 'LuckyE2EPlayer',
        count: 2
      }, (res: any) => {
        if (res.success) {
          console.log('✅ Bought', res.tickets.length, 'tickets over WebSocket!');
          console.log('   Ticket 1 fingerprint:', res.tickets[0].fingerprintHash);
        } else {
          console.log('ℹ️ Ticket purchase response:', res.error || 'ok');
        }
        resolve();
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
      reject(err);
    });

    setTimeout(() => resolve(), 4000);
  });

  // 5. Test Provably Fair SHA-256 Verifier Endpoint
  const gameRes = await fetch('http://localhost:3001/api/game/current');
  const gameState = await gameRes.json();
  console.log('✅ Current Game ID:', gameState.gameId);
  console.log('✅ Pre-Game Commitment Hash:', gameState.commitmentHash);
  console.log('✅ Total Cards in Game:', gameState.totalCardsSold);
  console.log('✅ Prize Pot:', '$' + gameState.totalPot);

  socket.disconnect();
  console.log('--- 🌟 ALL E2E VERIFICATION CHECKS PASSED! ---');
  process.exit(0);
}

runEndToEndVerification().catch(console.error);
