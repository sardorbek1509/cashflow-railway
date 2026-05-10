# Cashflow Game — Render.com ga Yuklash

Real-time multiplayer Cashflow moliyaviy o'yini (Node.js + Socket.io + MongoDB).

## 1-QADAM: MongoDB Atlas (bepul)

1. mongodb.com/cloud/atlas ga boring → M0 Free tanlang
2. Region: Frankfurt (eu-central-1)
3. Network Access → "Allow Access from Anywhere" (0.0.0.0/0)
4. Connect → "Connect your application" → connection string nusxalang:
   mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/cashflow_game

## 2-QADAM: GitHub ga yuklash

  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/USERNAME/cashflow-game.git
  git branch -M main
  git push -u origin main

## 3-QADAM: Render Web Service

1. render.com → New + → Web Service → GitHub connect
2. Sozlamalar:
   - Build Command: npm install
   - Start Command: node server/server.js
   - Plan: Free

## 4-QADAM: Environment Variables (Render Dashboard)

  NODE_ENV          = production
  PORT              = 10000
  MONGODB_URI       = (Atlas connection string)
  JWT_SECRET        = (32+ tasodifiy belgi, Render Generate bosing)
  JWT_EXPIRES_IN    = 7d
  MAX_PLAYERS_PER_ROOM = 6
  MIN_PLAYERS_TO_START = 2
  STARTING_BALANCE  = 3000
  LOG_LEVEL         = info

  ⚠️ LOG_DIR ni KIRITMANG — Render ephemeral filesystem ishlatadi!

## 5-QADAM: Deploy va Tekshirish

  https://SIZNING-APP.onrender.com/api/health
  → {"success": true, "status": "healthy"}

## Muammolar

- MongoDB xatosi → MONGODB_URI va 0.0.0.0/0 network access tekshiring
- App ishlamasa → Render Logs ni tekshiring, barcha env vars borligini tasdiqlang
- Free tier 15 daqiqa keyin uxlaydi → UptimeRobot bilan /api/health ga ping yuboring
