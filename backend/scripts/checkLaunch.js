require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const { productionErrors } = require('../config/production');
async function run() {
  const errors = productionErrors({ ...process.env, NODE_ENV: 'production' });
  if (errors.length) throw new Error(errors.join('\n'));
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.exists({ role: 'admin', email: { $nin: ['admin@buildforge.com', 'customer@buildforge.com'] } });
  if (!admin) throw new Error('Create a non-demo administrator.');
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Checkout transactions require a MongoDB replica set (Atlas works).');
  const verified = await Product.countDocuments({ catalogVerified: true, isArchived: { $ne: true }, stock: { $gt: 0 } });
  if (!verified) throw new Error('Import at least one verified product with real stock before launch.');
  if (process.env.CHECKOUT_ENABLED !== 'true') throw new Error('Checkout is closed. Configure policies and fulfillment, then set CHECKOUT_ENABLED=true.');
  console.log(`Launch configuration checks passed; ${verified} verified stocked products. Test HTTPS, order email, payment and backup restoration on staging before announcing the store.`);
}
run().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
