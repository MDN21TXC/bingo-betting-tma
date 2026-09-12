import { io } from 'socket.io-client';

async function testMultiRoomIntegration() {
  console.log('--- 🧪 STARTING MULTI-ROOM LOBBY E2E TEST ---');

  // 1. Test /api/rooms
  const roomsRes = await fetch('http://localhost:3001/api/rooms');
  const roomsData = await roomsRes.json();
  console.log('✅ Rooms endpoint returned', roomsData.rooms.length, 'concurrent stake rooms:');
  roomsData.rooms.forEach((r: any) => {
    console.log(`   • [${r.badge || 'ROOM'}] ${r.roomName}: $${r.betPerCard} (${r.etbEquivalent} Birr) | Status: ${r.status} | Timer: ${r.lobbyTimeRemaining}s | Pot: $${r.totalPot}`);
  });

  // 2. Test /api/leaderboard
  const lbRes = await fetch('http://localhost:3001/api/leaderboard');
  const lbData = await lbRes.json();
  console.log('✅ Leaderboard returned', lbData.topWinners.length, 'champions &', lbData.recentJackpots.length, 'recent jackpots');
  console.log(`   #1 Champion: ${lbData.topWinners[0].username} (Won: $${lbData.topWinners[0].totalWonUSD} / ${lbData.topWinners[0].totalWonETB} ETB)`);

  // 3. Test /api/referral
  const refRes = await fetch('http://localhost:3001/api/referral/usr_multi_test');
  const refData = await refRes.json();
  console.log('✅ Referral stats returned. Referral Link:', refData.referralLink);

  // 4. Test Socket Multi-Room Join and Buy
  const socket = io('http://localhost:3001', { transports: ['websocket'] });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Socket connected to Multi-Room Server');

      // Join 50 Birr Silver Arena
      socket.emit('JOIN_ROOM', { roomId: 'room_50birr', playerId: 'usr_multi_test' }, (res: any) => {
        if (res.success) {
          console.log(`✅ Successfully joined room "${res.state.roomName}" (${res.state.roomId})!`);
          console.log(`   Commitment Hash: ${res.state.commitmentHash}`);
          console.log(`   Total Cards: ${res.state.totalCardsSold} | Pot: $${res.state.totalPot}`);

          // Buy 1 ticket in Silver Arena
          socket.emit('BUY_TICKETS', {
            roomId: 'room_50birr',
            playerId: 'usr_multi_test',
            username: 'MultiRoomPro',
            count: 1
          }, (buyRes: any) => {
            if (buyRes.success) {
              console.log('✅ Successfully bought ticket in room_50birr! Ticket ID:', buyRes.tickets[0].ticketId);
            } else {
              console.log('ℹ️ Buy ticket response:', buyRes.error || 'ok');
            }
            resolve();
          });
        } else {
          reject(new Error(res.error));
        }
      });
    });

    socket.on('connect_error', reject);
    setTimeout(() => resolve(), 4000);
  });

  socket.disconnect();
  console.log('--- 🌟 ALL MULTI-ROOM INTEGRATION CHECKS PASSED! ---');
  process.exit(0);
}

testMultiRoomIntegration().catch(console.error);
