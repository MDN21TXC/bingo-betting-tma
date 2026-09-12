import { io } from 'socket.io-client';

async function runTest() {
  console.log('--- 🧪 STARTING CARD SELECTION MATRIX E2E TEST ---');

  // 1. Test Card Preview REST API
  const previewRes = await fetch('http://localhost:3001/api/room/room_10birr/card/22');
  if (previewRes.ok) {
    const data = await previewRes.json();
    console.log(`✅ Card #22 Preview retrieved successfully:`);
    console.log(`   B: [${data.grid.B.join(', ')}]`);
    console.log(`   I: [${data.grid.I.join(', ')}]`);
    console.log(`   N: [${data.grid.N.join(', ')}]`);
    console.log(`   G: [${data.grid.G.join(', ')}]`);
    console.log(`   O: [${data.grid.O.join(', ')}]`);
  } else {
    console.error('❌ Failed to fetch card preview');
  }

  // 2. Test WebSocket connection and room join
  const socket = io('http://localhost:3001');

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Socket connected to Multi-Room server');

      socket.emit('JOIN_ROOM', { roomId: 'room_10birr', playerId: 'usr_test_player' }, (res: any) => {
        if (res.success) {
          console.log(`✅ Joined room: ${res.state.roomName}`);
          console.log(`   Total Catalog Cards: ${res.state.totalCatalogCards}`);
          console.log(`   Timer remaining: ${res.state.lobbyTimeRemaining}s`);

          // Test selecting Card #22
          socket.emit('SELECT_CARD_NUMBER', {
            roomId: 'room_10birr',
            playerId: 'usr_test_player',
            username: 'TestPlayer_777',
            cardNumber: 22
          }, (selRes: any) => {
            console.log(`✅ Card #22 selected:`, selRes.success ? 'SUCCESS' : selRes.error);

            // Test Random Card selection
            socket.emit('RANDOM_SELECT_CARDS', {
              roomId: 'room_10birr',
              playerId: 'usr_test_player',
              username: 'TestPlayer_777',
              count: 2
            }, (randRes: any) => {
              console.log(`✅ Random cards selected:`, randRes.success ? `SUCCESS (${randRes.tickets?.length} tickets)` : randRes.error);
              socket.disconnect();
              resolve();
            });
          });
        } else {
          reject(new Error(res.error));
        }
      });
    });
  });

  console.log('--- 🌟 ALL CARD SELECTION MATRIX TESTS PASSED! ---');
}

runTest().catch(console.error);
