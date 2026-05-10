/**
 * Input Validation Middleware
 * Validation rules for API endpoints
 */

const { body, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// Auth validation rules
const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const loginRules = [
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

// Game room validation rules
const createRoomRules = [
  body('maxPlayers')
    .optional()
    .isInt({ min: 2, max: 6 }).withMessage('Max players must be between 2 and 6')
];

const joinRoomRules = [
  body('roomId')
    .trim()
    .notEmpty().withMessage('Room ID is required')
    .isLength({ min: 6, max: 10 }).withMessage('Invalid room ID format')
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  createRoomRules,
  joinRoomRules
};
