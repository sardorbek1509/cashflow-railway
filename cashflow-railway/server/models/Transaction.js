/**
 * Transaction Model
 * Records all financial transactions during gameplay
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  roomId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'salary',        // Payday received
      'expense',       // Regular expense paid
      'asset_purchase', // Bought an asset
      'passive_income', // Received passive income
      'liability',     // Took on debt
      'event_gain',    // Won money from event
      'event_loss',    // Lost money from event
      'loan'           // Borrowed from bank
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  balanceBefore: {
    type: Number
  },
  balanceAfter: {
    type: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
