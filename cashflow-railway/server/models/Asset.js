/**
 * Asset Model
 * Represents financial assets players can acquire
 */

const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  passiveIncome: {
    type: Number,
    required: true,
    default: 0
  },
  type: {
    type: String,
    enum: ['real_estate', 'stock', 'business', 'commodity'],
    required: true
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: true });

module.exports = assetSchema;
