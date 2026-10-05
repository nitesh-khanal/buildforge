const Competition = require('../models/Competition');
const Entry = require('../models/CompetitionEntry');
const Vote = require('../models/CompetitionVote');
const CommunityBuild = require('../models/CommunityBuild');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const asyncHandler = require('../utils/asyncHandler');
const pagination = require('../utils/pagination');
const { fail, phase, leaderboard, withOpenCompetition, finalizeCompetition, finalizeDueCompetitions } = require('../services/competitionService');
function publicCompetition(c) {
  const obj = c.toObject ? c.toObject() : c;
  return { ...obj, phase: phase(obj), winners: (obj.winners || []).map(({ rank, entry, user, title, likes }) => ({ rank, entry, user, title, likes })) };
}
const list = asyncHandler(async (req,res) => {
  await finalizeDueCompetitions();
  const { skip, limit, page } = pagination(req.query, 50);
  const [competitions, total] = await Promise.all([Competition.find().sort('-startsAt').skip(skip).limit(limit), Competition.countDocuments()]);
  res.json({ success: true, competitions: competitions.map(publicCompetition), page, pages: Math.max(1, Math.ceil(total/limit)) });
});
const create = asyncHandler(async (req,res) => {
  const { title, description, startsAt, endsAt, rewards } = req.body;
  if (typeof title !== 'string' || !title.trim() || (description != null && typeof description !== 'string')) fail('Enter a competition title and description.');
  if (typeof startsAt !== 'string' || typeof endsAt !== 'string' || !startsAt || !endsAt || !Number.isFinite(new Date(startsAt).getTime()) || !Number.isFinite(new Date(endsAt).getTime()) || new Date(endsAt) <= new Date() || new Date(endsAt) <= new Date(startsAt)) fail('Choose valid dates with the end in the future and after the start.');
  if (!Array.isArray(rewards) || rewards.length !== 3 || rewards.some(r => !r || !['percentage','fixed'].includes(r.discountType) || typeof r.discountValue !== 'number' || !Number.isFinite(r.discountValue) || r.discountValue < 1 || (r.discountType === 'percentage' && r.discountValue > 100) || !Number.isInteger(r.validityDays) || r.validityDays < 1 || r.validityDays > 365 || (r.minOrderAmount != null && (typeof r.minOrderAmount !== 'number' || !Number.isFinite(r.minOrderAmount) || r.minOrderAmount < 0)) || (r.maxDiscountAmount != null && (typeof r.maxDiscountAmount !== 'number' || !Number.isFinite(r.maxDiscountAmount) || r.maxDiscountAmount < 1)))) fail('Set valid coupon rewards for all three places.');
  const competition = await Competition.create({ title, description, startsAt, endsAt, createdBy: req.user._id, rewards: rewards.map(r => ({ discountType:r.discountType, discountValue:r.discountValue, validityDays:r.validityDays, minOrderAmount:r.minOrderAmount || 0, maxDiscountAmount:r.maxDiscountAmount ?? null })) });
  res.status(201).json({ success: true, competition: publicCompetition(competition) });
});
const detail = asyncHandler(async (req,res) => {
  await finalizeCompetition(req.params.id);
  const c = await Competition.findById(req.params.id);
  if (!c) fail('Competition not found.',404);
  const entries = await leaderboard(c._id);
  const votes = req.user ? await Vote.find({competition:c._id,user:req.user._id}).lean() : [];
  const own = new Map(votes.map(v=>[String(v.entry),v]));
  // Public views never expose voters or coupon codes.
  res.json({ success:true, competition:publicCompetition(c), entries:entries.map(e=>({...e,isOwner:String(e.user?._id)===String(req.user?._id),isLiked:!!own.get(String(e._id))?.liked,myRating:own.get(String(e._id))?.rating||null})) });
});
const enter = asyncHandler(async(req,res)=>{
  if (req.user.role !== 'customer') fail('Only customer accounts can enter competitions.',403);
  const entry = await withOpenCompetition(req.params.id, async(c,session)=>{
    if (await Entry.exists({competition:c._id,user:req.user._id}).session(session)) fail('You already entered this competition.',409);
    const b = await CommunityBuild.findById(req.body.buildId).session(session);
    if (!b || String(b.user)!==String(req.user._id)) fail('Choose one of your own published builds.',403);
    if (b.visibility!=='public' || b.status!=='visible' || b.compatibilityStatus==='error') fail('Choose a public, visible build without compatibility errors.');
    const products = await Product.find({_id:{$in:Object.values(b.components.toObject()).filter(v=>v && typeof v!=='string')}}).select('name category').session(session).lean();
    if (!products.length) fail('An empty build cannot enter a competition.');
    const [e] = await Entry.create([{competition:c._id,user:req.user._id,build:b._id,title:b.title,description:b.description,totalPrice:b.totalPrice,parts:products.map(p=>({name:p.name,category:p.category}))}],{session});return e;
  });
  res.status(201).json({success:true,entry});
});
const vote = asyncHandler(async(req,res)=>{
  if (req.user.role !== 'customer') fail('Use a customer account to like or rate entries.',403);
  const { liked, rating } = req.body;
  if ((liked === undefined && rating === undefined) || (liked !== undefined && typeof liked!=='boolean') || (rating !== undefined && rating !== null && (!Number.isInteger(rating) || rating<1 || rating>5))) fail('Send a like or a rating from 1 to 5.');
  await withOpenCompetition(req.params.id, async(c,session)=>{
    const e = await Entry.findOne({_id:req.params.entryId,competition:c._id}).session(session);
    if (!e) fail('Entry not found.',404);
    if (String(e.user)===String(req.user._id)) fail('You cannot like or rate your own entry.',403);
    if (!await CommunityBuild.exists({_id:e.build,status:'visible',visibility:'public'}).session(session)) fail('This entry is no longer eligible.',409);
    const patch={};if(liked!==undefined)patch.liked=liked;if(rating!==undefined)patch.rating=rating;
    await Vote.findOneAndUpdate({entry:e._id,user:req.user._id},{$set:{...patch,competition:c._id}},{session,upsert:true,runValidators:true,setDefaultsOnInsert:true});
  });
  res.json({success:true});
});
const myCoupons = asyncHandler(async(req,res)=>{
  await finalizeDueCompetitions();
  const coupons = await Coupon.find({awardedTo:req.user._id}).populate('sourceCompetition','title').sort('-createdAt').lean();
  const used = await CouponUsage.find({user:req.user._id,coupon:{$in:coupons.map(c=>c._id)}}).select('coupon').lean();
  const usedIds = new Set(used.map(u=>String(u.coupon)));
  res.json({success:true,coupons:coupons.map(c=>({...c,used:usedIds.has(String(c._id))}))});
});
module.exports={list,create,detail,enter,vote,myCoupons};
