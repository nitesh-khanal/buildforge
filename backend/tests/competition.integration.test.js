// Runs only against an explicitly named disposable competition test database.
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const uri = process.env.COMPETITION_TEST_URI;
const run = uri && /\/buildforge_competition_test_[a-z0-9_]+\?/.test(uri) ? describe : describe.skip;
const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Build = require('../models/CommunityBuild');
const Competition = require('../models/Competition');
const Entry = require('../models/CompetitionEntry');
const Vote = require('../models/CompetitionVote');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const Notification = require('../models/Notification');
const { finalizeCompetition, finalizeDueCompetitions } = require('../services/competitionService');
const { evaluateCouponForUser } = require('../controllers/couponController');
const { evaluateCoupon } = require('../services/couponService');

run('competition entry, voting and automatic coupon awards', () => {
  let users, admin, product, builds, c, entries;
  const rewards = [30,20,10].map(discountValue => ({ discountType:'percentage', discountValue, validityDays:30, minOrderAmount:100 }));
  const auth = u => ({ Authorization: `Bearer ${jwt.sign({ id: u._id }, process.env.JWT_SECRET)}` });
  beforeAll(async()=>{
    await mongoose.connect(uri);
    await Promise.all([User,Product,Build,Competition,Entry,Vote,Coupon,Cart,Notification,require('../models/CouponUsage')].map(M=>M.init()));
    admin = await User.create({name:'Competition admin',email:'admin@competition.test',password:'TestPass123!',role:'admin'});
    users = await User.create([0,1,2,3,4].map(i=>({name:`Entrant ${i}`,email:`user${i}@competition.test`,password:'TestPass123!'})));
    product = await Product.create({name:'Competition CPU',brand:'Test',category:'cpu',sku:'COMP-CPU',price:1000,stock:10,catalogVerified:true});
    builds = await Build.create(users.map((u,i)=>({user:u._id,title:`Build ${i}`,components:{cpu:product._id},totalPrice:1000,compatibilityStatus:'compatible'})));
  });
  afterAll(async()=>{if(mongoose.connection.readyState){await mongoose.connection.dropDatabase();await mongoose.disconnect();}});
  it('requires an admin and valid period/rewards',async()=>{
    const body={title:'October challenge',startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),rewards};
    expect((await request(app).post('/api/admin/competitions').send(body)).status).toBe(401);
    expect((await request(app).post('/api/admin/competitions').set(auth(users[0])).send(body)).status).toBe(403);
    expect((await request(app).post('/api/admin/competitions').set(auth(admin)).send({...body,rewards:rewards.slice(0,2)})).status).toBe(400);
    expect((await request(app).post('/api/admin/competitions').set(auth(admin)).send({...body,endsAt:body.startsAt})).status).toBe(400);
    const r=await request(app).post('/api/admin/competitions').set(auth(admin)).send(body);expect(r.status).toBe(201);c=r.body.competition;
  });
  it('accepts owned published builds once, taking a snapshot',async()=>{
    expect((await request(app).post(`/api/competitions/${c._id}/entries`).set(auth(users[0])).send({buildId:builds[1]._id})).status).toBe(403);
    for(let i=0;i<4;i++){const r=await request(app).post(`/api/competitions/${c._id}/entries`).set(auth(users[i])).send({buildId:builds[i]._id});expect(r.status).toBe(201);}
    expect((await request(app).post(`/api/competitions/${c._id}/entries`).set(auth(users[0])).send({buildId:builds[0]._id})).status).toBe(409);
    entries=await Entry.find({competition:c._id}).sort('createdAt');
    await Build.updateOne({_id:builds[0]._id},{$set:{title:'Changed after entry'}});
    expect((await Entry.findById(entries[0]._id)).title).toBe('Build 0');
    expect(entries[0].parts[0].name).toBe('Competition CPU');
  });
  it('allows likes and ratings, rejects self-votes, deduplicates simultaneous votes',async()=>{
    const url=i=>`/api/competitions/${c._id}/entries/${entries[i]._id}/vote`;
    expect((await request(app).put(url(0)).set(auth(users[0])).send({liked:true})).status).toBe(403);
    expect((await request(app).put(url(0)).set(auth(users[4])).send({rating:6})).status).toBe(400);
    const duplicate=await Promise.all([1,2].map(()=>request(app).put(url(0)).set(auth(users[4])).send({liked:true,rating:4})));expect(duplicate.map(r=>r.status)).toEqual([200,200]);
    expect(await Vote.countDocuments({entry:entries[0]._id,user:users[4]._id})).toBe(1);
    await request(app).put(url(0)).set(auth(users[1])).send({liked:true});
    await request(app).put(url(0)).set(auth(users[2])).send({liked:true});
    await request(app).put(url(1)).set(auth(users[0])).send({liked:true});
    await request(app).put(url(1)).set(auth(users[4])).send({liked:true});
    await request(app).put(url(2)).set(auth(users[4])).send({liked:true,rating:5});
    await request(app).put(url(3)).set(auth(users[4])).send({liked:true,rating:5});
    const d=(await request(app).get(`/api/competitions/${c._id}`)).body;expect(d.entries.map(e=>e.likes)).toEqual([3,2,1,1]);expect(d.entries[0].averageRating).toBe(4);
  });
  it('closes voting and awards exactly three account-bound coupons atomically',async()=>{
    await finalizeCompetition(c._id);expect(await Coupon.countDocuments({sourceCompetition:c._id})).toBe(0);
    await Competition.updateOne({_id:c._id},{$set:{endsAt:new Date(Date.now()-1000)}});
    expect((await request(app).put(`/api/competitions/${c._id}/entries/${entries[0]._id}/vote`).set(auth(users[4])).send({liked:false})).status).toBe(409);
    expect((await request(app).post(`/api/competitions/${c._id}/entries`).set(auth(users[4])).send({buildId:builds[4]._id})).status).toBe(409);
    await Promise.all([finalizeCompetition(c._id),finalizeCompetition(c._id)]);await finalizeDueCompetitions();
    const finished=await Competition.findById(c._id);expect(finished.winners.map(w=>String(w.user))).toEqual(users.slice(0,3).map(u=>String(u._id)));
    expect(finished.winners.map(w=>w.likes)).toEqual([3,2,1]);
    const coupons=await Coupon.find({sourceCompetition:c._id}).sort('rewardRank');expect(coupons.map(r=>r.discountValue)).toEqual([30,20,10]);
    expect(await Notification.countDocuments({type:'competition_reward'})).toBe(3);
    const mine=await request(app).get('/api/coupons/mine').set(auth(users[0]));expect(mine.body.coupons).toHaveLength(1);expect(mine.body.coupons[0].code).toBe(coupons[0].code);
    const other=await request(app).get('/api/coupons/mine').set(auth(users[4]));expect(other.body.coupons).toHaveLength(0);
    const publicDetail=(await request(app).get(`/api/competitions/${c._id}`)).body;expect(publicDetail.competition.phase).toBe('finished');expect(publicDetail.competition.winners[0].coupon).toBeUndefined();
    const items=[{product:product._id,name:product.name,price:1000,quantity:1}];
    expect(evaluateCoupon({coupon:coupons[0],userId:users[4]._id,items,subtotal:1000}).valid).toBe(false);
    await Cart.create({user:users[0]._id,items});
    const result=await evaluateCouponForUser({code:coupons[0].code,userId:users[0]._id});expect(result.result.valid).toBe(true);expect(result.result.discount).toBe(300);
    await Cart.create({user:users[4]._id,items});
    expect((await request(app).post('/api/coupons/validate').set(auth(users[4])).send({code:coupons[0].code})).status).toBe(400);
    const shippingAddress={fullName:'Test Winner',email:'winner@competition.test',phone:'9800000000',address:'Test ward',city:'Kathmandu',province:'Bagmati'};
    expect((await request(app).post('/api/orders').set(auth(users[4])).send({shippingAddress,paymentMethod:'cod',couponCode:coupons[0].code})).status).toBe(400);
    const checkout=await request(app).post('/api/orders').set(auth(users[0])).send({shippingAddress,paymentMethod:'cod',couponCode:coupons[0].code});expect(checkout.status).toBe(201);expect(checkout.body.order.discount).toBe(300);
    expect((await request(app).get('/api/coupons/mine').set(auth(users[0]))).body.coupons[0].used).toBe(true);

  });
  it('rolls back a failed award batch and recovers without duplicates',async()=>{
    const recovering=await Competition.create({title:'Recovery',startsAt:new Date(Date.now()-60000),endsAt:new Date(Date.now()-1000),rewards,createdBy:admin._id});
    await Entry.create({competition:recovering._id,user:users[4]._id,build:builds[4]._id,title:'Recovery entry'});
    const broken=jest.spyOn(Notification,'create').mockRejectedValueOnce(new Error('Simulated interruption'));
    await expect(finalizeCompetition(recovering._id)).rejects.toThrow('Simulated interruption');broken.mockRestore();
    expect((await Competition.findById(recovering._id)).finalizedAt).toBeNull();
    expect(await Coupon.countDocuments({sourceCompetition:recovering._id})).toBe(0);
    await finalizeDueCompetitions();await finalizeCompetition(recovering._id);
    expect(await Coupon.countDocuments({sourceCompetition:recovering._id})).toBe(1);
    expect((await Competition.findById(recovering._id)).winners).toHaveLength(1);
  });
  it('disqualifies hidden entries before awarding',async()=>{
    const moderated=await Competition.create({title:'Moderation',startsAt:new Date(Date.now()-60000),endsAt:new Date(Date.now()-1000),rewards,createdBy:admin._id});
    await Entry.create({competition:moderated._id,user:users[3]._id,build:builds[3]._id,title:'Hidden entry'});
    await Build.updateOne({_id:builds[3]._id},{$set:{status:'hidden'}});
    await finalizeCompetition(moderated._id);expect((await Competition.findById(moderated._id)).winners).toHaveLength(0);
    expect((await request(app).get(`/api/competitions/${moderated._id}`)).body.entries).toHaveLength(0);
  });
  it('rejects scheduled entries and finishes empty contests without inventing winners',async()=>{
    const scheduled=await Competition.create({title:'Future',startsAt:new Date(Date.now()+3600000),endsAt:new Date(Date.now()+7200000),rewards,createdBy:admin._id});
    expect((await request(app).post(`/api/competitions/${scheduled._id}/entries`).set(auth(users[4])).send({buildId:builds[4]._id})).status).toBe(409);
    await Competition.updateOne({_id:scheduled._id},{$set:{startsAt:new Date(Date.now()-2000),endsAt:new Date(Date.now()-1000)}});
    await finalizeDueCompetitions();expect((await Competition.findById(scheduled._id)).winners).toHaveLength(0);
  });
});
