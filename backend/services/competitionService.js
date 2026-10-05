const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const Competition = require('../models/Competition');
const Entry = require('../models/CompetitionEntry');
const Vote = require('../models/CompetitionVote');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');

function fail(message, statusCode = 400) { const e = new Error(message); e.statusCode = statusCode; throw e; }
function phase(c, now = new Date()) { return c.finalizedAt ? 'finished' : now < c.startsAt ? 'scheduled' : now < c.endsAt ? 'active' : 'closed'; }

async function leaderboard(id, session) {
  const query = Entry.find({ competition: id }).populate('user', 'name').lean();
  if (session) query.session(session);
  const entries = await query;
  const buildsQuery = require('../models/CommunityBuild').find({ _id: { $in: entries.map(e => e.build) }, visibility: 'public', status: 'visible' }).select('_id').lean();
  if (session) buildsQuery.session(session);
  const visible = new Set((await buildsQuery).map(b => String(b._id)));
  const aggregation = Vote.aggregate([{ $match: { competition: new mongoose.Types.ObjectId(String(id)) } }, { $group: {
    _id: '$entry', likes: { $sum: { $cond: ['$liked', 1, 0] } },
    averageRating: { $avg: '$rating' }, ratingCount: { $sum: { $cond: [{ $ne: ['$rating', null] }, 1, 0] } },
  } }]);
  if (session) aggregation.session(session);
  const counts = new Map((await aggregation).map(v => [String(v._id), v]));
  return entries.filter(e => e.user && visible.has(String(e.build))).map(e => ({ ...e, likes: counts.get(String(e._id))?.likes || 0, averageRating: counts.get(String(e._id))?.averageRating || 0, ratingCount: counts.get(String(e._id))?.ratingCount || 0 }))
    .sort((a,b) => b.likes - a.likes || a.createdAt - b.createdAt || String(a._id).localeCompare(String(b._id)));
}

// Every entry/vote mutation and finalization writes the competition document
// inside a transaction, serializing the closing boundary and duplicate awards.
async function withOpenCompetition(id, work) {
  return mongoose.connection.transaction(async session => {
    const now = new Date();
    const c = await Competition.findOneAndUpdate({ _id: id, startsAt: { $lte: now }, endsAt: { $gt: now }, finalizedAt: null }, { $inc: { revision: 1 } }, { new: true, session });
    if (!c) fail('This competition is not open for entries or voting.', 409);
    return work(c, session);
  });
}

async function finalizeCompetition(id) {
  return mongoose.connection.transaction(async session => {
    const now = new Date();
    const c = await Competition.findOneAndUpdate({ _id: id, endsAt: { $lte: now }, finalizedAt: null }, { $inc: { revision: 1 } }, { new: true, session });
    if (!c) return;
    const ranked = await leaderboard(id, session);
    // Hidden, private or deleted community posts are ineligible at closing.
    const CommunityBuild = require('../models/CommunityBuild');
    const eligible = await CommunityBuild.find({ _id: { $in: ranked.map(e => e.build) }, visibility: 'public', status: 'visible' }).select('_id').session(session).lean();
    const ids = new Set(eligible.map(b => String(b._id)));
    const winners = ranked.filter(e => e.user && ids.has(String(e.build))).slice(0, 3);
    c.winners = [];
    for (let i = 0; i < winners.length; i++) {
      const entry = winners[i];
      const reward = c.rewards[i].toObject();
      const [coupon] = await Coupon.create([{
        code: `WIN-${String(c._id).slice(-8)}-${i+1}-${randomBytes(6).toString('hex')}`,
        ...reward, startDate: now, expiryDate: new Date(now.getTime() + reward.validityDays * 86400000),
        usageLimit: 1, usageLimitPerUser: 1, createdBy: c.createdBy,
        awardedTo: entry.user._id, sourceCompetition: c._id, rewardRank: i + 1,
      }], { session });
      c.winners.push({ rank: i + 1, entry: entry._id, user: entry.user._id, title: entry.title, likes: entry.likes, coupon: coupon._id });
      await Notification.create([{ user: entry.user._id, type: 'competition_reward', title: `You placed #${i+1}!`, message: `Your build won a coupon in ${c.title}. Find it in My coupons.`, link: '/account/coupons', data: { competition: c._id, coupon: coupon._id } }], { session });
    }
    c.finalizedAt = now;
    await c.save({ session });
  });
}
let sweepRunning = false;
async function finalizeDueCompetitions() {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const due = await Competition.find({ finalizedAt: null, endsAt: { $lte: new Date() } }).select('_id').limit(100).lean();
    for (const c of due) await finalizeCompetition(c._id);
  } finally { sweepRunning = false; }
}
module.exports = { fail, phase, leaderboard, withOpenCompetition, finalizeCompetition, finalizeDueCompetitions };
