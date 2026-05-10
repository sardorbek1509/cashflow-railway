#!/bin/bash
# ──────────────────────────────────────────────────────────
#  CashFlow Game — Quick Start Script
#  Usage: bash start.sh
# ──────────────────────────────────────────────────────────

set -e

echo ""
echo "🎮  CashFlow Multiplayer Game"
echo "────────────────────────────"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌  Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "✅  Node.js $(node -v)"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
  echo "⚠️   MongoDB not found locally. Make sure MONGODB_URI in .env points to a running instance."
else
  echo "✅  MongoDB found"
fi

# Setup .env
if [ ! -f "server/.env" ]; then
  cp server/.env.example server/.env
  echo "📝  Created server/.env — edit it to set JWT_SECRET and MONGODB_URI"
fi

# Install dependencies
echo ""
echo "📦  Installing dependencies..."
cd server && npm install
cd ..

# Start
echo ""
echo "🚀  Starting development server on http://localhost:3000"
echo ""
cd server && npm run dev
