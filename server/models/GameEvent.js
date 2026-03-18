/**
 * GameEvent Model
 * Logs all game events for audit trail and replay
 */

const mongoose = require('mongoose');

const gameEventSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: [
      'game_started',
      'game_ended',
      'player_joined',
      'player_left',
      'dice_rolled',
      'player_moved',
      'payday',
      'deal_offered',
      'deal_accepted',
      'deal_declined',
      'event_triggered',
      'asset_purchased',
      'liability_added',
      'player_won',
      'turn_changed',
      'loan_taken'
    ],
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  actorUsername: String,
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// TTL index: auto-delete events older than 30 days
gameEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('GameEvent', gameEventSchema);
