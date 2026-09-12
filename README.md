# 🎰 BINGO BET — Live 75-Ball Multiplayer Bingo Web Application

A responsive, high-performance, real-time multiplayer 75-ball Ethiopian Bingo Betting web application built with **React**, **Vite**, **Tailwind CSS**, **Node.js / Express**, and **Socket.io**.

Features SHA-256 Provably Fair round verification, instant guest mode, multi-room lobbies (Addis Ababa Birr, Lucy Lucky 75, Rift Valley, Habesha High Roller), 5-player promo pots (0% rake), and full dual-currency support (ETB Birr & USD).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ or v20+
- npm or yarn

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Run both the Express backend (port 3001) & Vite frontend (port 5173)
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSockets**: [http://localhost:3001](http://localhost:3001)

### Running Tests
```bash
npm test
```

---

## 🌐 Deploying Online to the Web

The application is architected for **single-port cloud deployment**. When built (`npm run build`), Express serves the compiled React SPA from the `/dist` directory alongside all REST endpoints and Socket.io WebSocket connections on `process.env.PORT`.

### Option 1: Render.com (Recommended Free/Easy)
1. Push this project to GitHub or GitLab.
2. Sign in to [Render](https://render.com) and click **New + > Web Service**.
3. Select your repository.
4. Configure the service:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Click **Create Web Service**. Render will assign a public `https://your-app.onrender.com` URL.

### Option 2: Railway.app
1. Go to [Railway](https://railway.app) and create a **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Railway will automatically detect Node.js and run:
   - Build: `npm run build`
   - Start: `npm start`
4. Under project Settings > Networking, click **Generate Domain**.

### Option 3: VPS / Docker / Ubuntu
```bash
# Clone and enter directory
git clone <your-repo-url> bingo-app
cd bingo-app

# Install and build
npm install
npm run build

# Run in background with PM2
npm install -g pm2
pm2 start "npm start" --name "bingo-web"
pm2 save
pm2 startup
```

---

## 🔑 Environment Variables (Optional)

Create a `.env` file in the project root if you want to customize ports or enable optional integrations:

```env
# Server Port (default: 3001)
PORT=3001

# Optional: Telegram Bot Token (if you wish to enable the Telegram bot alongside the web app)
# TELEGRAM_BOT_TOKEN=your_token_here
```

---

## 🎮 Key Features

- **Responsive Web Layout**: Clean arcade gaming interface optimized for desktop, tablet, and mobile browsers.
- **Instant Guest Play**: One-click instant guest login with 1,000 Birr starting bankroll.
- **Provably Fair SHA-256**: Ball sequences and seeds are cryptographically hashed before draw #1; audit tools available client-side in the browser.
- **Auto-Daub**: Real-time automatic stamping of drawn numbers with audio cues and win animations.
- **5-Player Promo**: 100% pot payout with 0% platform rake when exactly 5 players participate.
- **Telebirr & CBE**: Native payment flow integration for Ethiopian Birr transactions.
