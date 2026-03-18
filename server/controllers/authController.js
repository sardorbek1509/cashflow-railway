/**
 * Authentication Controller
 * Handles user registration and login
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Generate JWT token for authenticated user
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user account
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({
        success: false,
        message: `This ${field} is already registered.`
      });
    }

    // Create user (password will be hashed by pre-save hook)
    const user = new User({
      username,
      email,
      passwordHash: password
    });

    await user.save();

    const token = generateToken(user._id);

    logger.info('New user registered', { userId: user._id, username });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token,
        user: user.toPublicJSON()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    const token = generateToken(user._id);

    logger.info('User logged in', { userId: user._id, username: user.username });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: user.toPublicJSON()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 */
const getMe = async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user.toPublicJSON() }
  });
};

module.exports = { register, login, getMe };
