const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'CompetitionEntry', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  liked: { type: Boolean, default: false },
  rating: { type: Number, min: 1, max: 5, default: null },
}, { timestamps: true });
schema.index({ entry: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('CompetitionVote', schema);
