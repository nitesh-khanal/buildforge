require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const User = require('../models/User');
const products = require('./products');

const DEV_ADMIN = {
  name: 'BuildForge Admin',
  email: 'admin@buildforge.com',
  password: 'ChangeMe123!',
  role: 'admin',
};

const DEV_CUSTOMER = {
  name: 'Test Customer',
  email: 'customer@buildforge.com',
  password: 'ChangeMe123!',
  role: 'customer',
};

async function run() {
  await connectDB();

  console.log('Clearing existing products...');
  await Product.deleteMany({});

  console.log(`Inserting ${products.length} products...`);
  await Product.insertMany(products);

  console.log('Seeding development accounts...');
  await User.deleteMany({ email: { $in: [DEV_ADMIN.email, DEV_CUSTOMER.email] } });
  await User.create(DEV_ADMIN);
  await User.create(DEV_CUSTOMER);

  console.log('\n=== Development credentials (CHANGE BEFORE PRODUCTION) ===');
  console.log(`Admin:    ${DEV_ADMIN.email} / ${DEV_ADMIN.password}`);
  console.log(`Customer: ${DEV_CUSTOMER.email} / ${DEV_CUSTOMER.password}`);
  console.log('============================================================\n');

  console.log('Seed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
