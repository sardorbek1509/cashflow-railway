/**
 * PlayerState Model
 * Tracks the financial state of each player in a game room
 */

const mongoose = require('mongoose');
const assetSchema = require('./Asset');

const liabilitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  monthlyPayment: { type: Number, required: true }
}, { _id: true });

const playerStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  // Board position (0-23 spaces on the board)
  position: {
    type: Number,
    default: 0,
    min: 0,
    max: 23
  },
  // Financial state
  balance: {
    type: Number,
    default: 3000
  },
  salary: {
    type: Number,
    default: 3000
  },
  expenses: {
    type: Number,
    default: 2000
  },
  passiveIncome: {
    type: Number,
    default: 0
  },
  // Holdings
  assets: [assetSchema],
  liabilities: [liabilitySchema],
  // Turn management
  isActive: {
    type: Boolean,
    default: true
  },
  hasWon: {
    type: Boolean,
    default: false
  },
  // Track payday laps
  lapsCompleted: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual: calculate cashflow
playerStateSchema.virtual('cashflow').get(function () {
  return this.passiveIncome - this.expenses;
});

// Virtual: check win condition
playerStateSchema.virtual('hasAchievedFinancialFreedom').get(function () {
  return this.passiveIncome >= this.expenses;
});

// Method: recalculate derived financial values
playerStateSchema.methods.recalculate = function () {
  // Recalculate passive income from all assets
  this.passiveIncome = this.assets.reduce((sum, asset) => sum + (asset.passiveIncome || 0), 0);

  // Recalculate expenses from liabilities' monthly payments
  const baseExpenses = this.salary * 0.5; // Base living expenses = 50% of salary
  const liabilityPayments = this.liabilities.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  this.expenses = baseExpenses + liabilityPayments;
};

playerStateSchema.set('toJSON', { virtuals: true });
playerStateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PlayerState', playerStateSchema);
