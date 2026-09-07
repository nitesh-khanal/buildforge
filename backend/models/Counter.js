const mongoose = require('mongoose');

// Used to atomically generate sequence numbers for order IDs like
// BF-20260902-00123. One counter document per day (_id = 'orders-YYYYMMDD').
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
