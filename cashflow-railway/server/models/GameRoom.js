/**
 * GameRoom Model
 * Manages the game room state, players, and turn order
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const gameRoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    default: () => uuidv4().substring(0, 8).toUpperCase(),
    unique: true,
    index: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostUsername: {
    type: String,
    required: true
  },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    socketId: { type: String },
    isReady: { type: Boolean, default: false },
    isConnected: { type: Boolean, default: true }
  }],
  status: {
    type: String,
    enum: ['waiting', 'in_progress', 'finished'],
    default: 'waiting'
  },
  maxPlayers: {
    type: Number,
    default: 6,
    min: 2,
    max: 6
  },
  // Turn management
  currentTurn: {
    type: Number,
    default: 0  // Index into players array
  },
  turnCount: {
    type: Number,
    default: 0
  },
  // Winner tracking
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  winnerUsername: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Get the current player whose turn it is
gameRoomSchema.methods.getCurrentPlayer = function () {
  return this.players[this.currentTurn % this.players.length];
};

// Advance to next active player
gameRoomSchema.methods.advanceTurn = function () {
  this.turnCount += 1;
  this.currentTurn = this.turnCount % this.players.length;
};

module.exports = mongoose.model('GameRoom', gameRoomSchema);
