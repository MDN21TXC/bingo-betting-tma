const token = process.env.TELEGRAM_BOT_TOKEN || '';
const webAppUrl = process.env.WEBAPP_URL || '';

if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN is required. Set it in .env or environment.');
  process.exit(1);
}

async function setupBot() {
  // 1. Set Commands
  const commands = [
    { command: 'play', description: '🎮 Launch BINGO BET Mini App' },
    { command: 'start', description: '👋 Start and Welcome' },
    { command: 'help', description: 'ℹ️ Game Rules and Support' }
  ];
  const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands })
  }).then(r => r.json());
  console.log('setMyCommands:', cmdRes);

  // 2. Set Description
  const descRes = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: "Welcome to BINGO BET 🇪🇹! Ethiopia's premier live 75-ball multiplayer bingo betting game on Telegram. Play live rooms, win real Birr pools, enjoy 100% fair gaming with instant payouts."
    })
  }).then(r => r.json());
  console.log('setMyDescription:', descRes);

  // 3. Set Short Description
  const shortDescRes = await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_description: '🇪🇹 Live 75-Ball Multiplayer Bingo Betting Game. Play live and win ETB!'
    })
  }).then(r => r.json());
  console.log('setMyShortDescription:', shortDescRes);

  // 4. Set Menu Button
  const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: '🎮 Play BINGO BET',
        web_app: { url: webAppUrl }
      }
    })
  }).then(r => r.json());
  console.log('setChatMenuButton:', menuRes);
}

setupBot();
