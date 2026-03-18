/**
 * Cashflow Game Server - Main Entry Point
 * Express + Socket.io + MongoDB
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authenticateSocket, registerGameHandlers } = require('./sockets/gameHandler');
const { ensureSuperAdmin } = require('./utils/userSetup');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');

const app = express();
const httpServer = http.createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*', methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 30000,
  pingInterval: 10000
});

io.use(authenticateSocket);
io.on('connection', (socket) => {
  logger.info('New socket connection', { socketId: socket.id, username: socket.user.username });
  registerGameHandlers(io, socket);
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Static client files
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.get('/api/health', (req, res) => res.json({ success: true, status: 'healthy', uptime: process.uptime() }));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientPath, 'html', 'index.html'));
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  await ensureSuperAdmin();
  httpServer.listen(PORT, () => {
    logger.info(`Cashflow Game Server running on port ${PORT}`, { env: process.env.NODE_ENV || 'development' });
  });
};

process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection', { reason: reason?.message || reason }));
process.on('uncaughtException', (err) => { logger.error('Uncaught Exception', { error: err.message }); process.exit(1); });
process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)); });

startServer();
module.exports = { app, io };
