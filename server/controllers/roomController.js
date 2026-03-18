/**
 * Game Room Controller
 * Handles room creation, joining, and listing
 */

const GameRoom = require('../models/GameRoom');
const PlayerState = require('../models/PlayerState');
const logger = require('../utils/logger');

/**
 * POST /api/rooms
 * Create a new game room
 */
const createRoom = async (req, res, next) => {
  try {
    const { maxPlayers = 6 } = req.body;

    const room = new GameRoom({
      hostId: req.user._id,
      hostUsername: req.user.username,
      maxPlayers,
      players: [{
        userId: req.user._id,
        username: req.user.username,
        isReady: false,
        isConnected: true
      }]
    });

    await room.save();

    logger.info('Room created', { roomId: room.roomId, hostId: req.user._id });

    res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      data: { room }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms
 * List all waiting rooms
 */
const listRooms = async (req, res, next) => {
  try {
    const rooms = await GameRoom.find({ status: 'waiting' })
      .select('roomId hostUsername players maxPlayers status createdAt')
      .sort('-createdAt')
      .limit(20);

    res.json({
      success: true,
      data: { rooms }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms/:roomId
 * Get a specific room's details
 */
const getRoom = async (req, res, next) => {
  try {
    const room = await GameRoom.findOne({ roomId: req.params.roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    res.json({
      success: true,
      data: { room }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms/:roomId/state
 * Get the full game state for a room (all player states)
 */
const getRoomState = async (req, res, next) => {
  try {
    const room = await GameRoom.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const playerStates = await PlayerState.find({ roomId: req.params.roomId });

    res.json({
      success: true,
      data: { room, playerStates }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createRoom, listRooms, getRoom, getRoomState };
