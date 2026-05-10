/**
 * Logger utility using Winston
 * Provides structured logging with daily log rotation for production use
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
require('dotenv').config();

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length) log += ` | ${JSON.stringify(meta)}`;
    if (stack) log += `\n${stack}`;
    return log;
  })
);

// JSON format for file logs
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  // Console transport
  new winston.transports.Console({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

// Add file transports only when LOG_DIR is explicitly set (not on Render/cloud)
if (process.env.LOG_DIR && process.env.NODE_ENV !== 'production') {
  transports.push(
    // Rotating file for all logs
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: LOG_LEVEL,
      format: jsonFormat
    }),
    // Separate file for errors
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: jsonFormat
    })
  );
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false
});

module.exports = logger;
