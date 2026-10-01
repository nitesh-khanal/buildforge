require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
async function run() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
  if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters.');
  await mongoose.connect(process.env.MONGODB_URI);
  if (await User.exists({ email: email.trim().toLowerCase() })) throw new Error('Account already exists; no password or role was changed.');
  await User.create({ name: process.env.ADMIN_NAME || 'Store administrator', email, password, role: 'admin' });
  console.log('Administrator created. Remove ADMIN_PASSWORD from the environment now.');
}
run().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
