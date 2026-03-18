/**
 * Socket.io Authentication Middleware
 * Validates JWT tokens for WebSocket connections
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return next(new Error('User not found or deactivated'));
    }

    socket.user = user;
    next();
  } catch (error) {
    logger.warn('Socket auth failed', { error: error.message, socketId: socket.id });
    next(new Error('Invalid or expired token'));
  }
};

module.exports = { socketAuth };
