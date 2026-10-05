const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  build: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityBuild', required: true },
  title: String,
  description: String,
  totalPrice: Number,
  parts: [{ name: String, category: String }],
}, { timestamps: true });
schema.index({ competition: 1, user: 1 }, { unique: true });
schema.index({ competition: 1, build: 1 }, { unique: true });
module.exports = mongoose.model('CompetitionEntry', schema);
