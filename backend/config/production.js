function productionErrors(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];
  const errors = [];
  if (!env.MONGODB_URI || !/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI)) errors.push('Set MONGODB_URI to a MongoDB replica set or Atlas database.');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /change_this|changeme|example|replace|placeholder/i.test(env.JWT_SECRET)) errors.push('JWT_SECRET must be a random secret of at least 32 characters.');
  for (const key of ['CLIENT_URL', 'BACKEND_URL']) {
    try {
      const url = new URL(env[key]);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || ['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error();
    } catch { errors.push(`${key} must be a public HTTPS origin (no path or query).`); }
  }
  if (env.KHALTI_ENABLED === 'true' && env.NODE_ENV === 'production' && (!env.KHALTI_SECRET_KEY || env.KHALTI_TEST_MODE !== 'false')) {
    errors.push('Live Khalti requires a merchant secret key and KHALTI_TEST_MODE=false.');
  }
  if (env.BANK_TRANSFER_ENABLED === 'true' && env.NODE_ENV === 'production' &&
      (!env.BANK_NAME?.trim() || !env.BANK_ACCOUNT_NAME?.trim() || !env.BANK_ACCOUNT_NUMBER?.trim())) {
    errors.push('Bank transfer requires real bank name, account name and account number.');
  }
  if (env.ESEWA_ENABLED === 'true') {
    if (env.ESEWA_TEST_MODE !== 'false' || !env.ESEWA_MERCHANT_ID || env.ESEWA_MERCHANT_ID === 'EPAYTEST' || !env.ESEWA_SECRET_KEY || env.ESEWA_SECRET_KEY === '8gBm/:&EnhH.1/q') errors.push('Live eSewa requires production merchant credentials and ESEWA_TEST_MODE=false.');
  }
  if (env.CHECKOUT_ENABLED === 'true') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL || '')) errors.push('SUPPORT_EMAIL must be a valid customer support address.');
    for (const key of ['STORE_NAME', 'SUPPORT_EMAIL', 'STORE_ADDRESS', 'SHIPPING_POLICY', 'RETURN_POLICY']) {
      if (!env[key]?.trim()) errors.push(`${key} is required before opening checkout.`);
    }
    for (const key of ['SHIPPING_FLAT_RATE_NPR', 'FREE_SHIPPING_THRESHOLD_NPR']) {
      if (env[key] === undefined || env[key] === '' || !Number.isFinite(Number(env[key])) || Number(env[key]) < 0) errors.push(`${key} must be an explicitly configured non-negative amount.`);
    }
    if (env.EMAIL_ENABLED !== 'true' || !env.EMAIL_HOST || !env.EMAIL_USER || !env.EMAIL_PASSWORD) errors.push('Configure order email before opening checkout.');
  }
  if (env.GA_MEASUREMENT_ID && !/^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID)) errors.push('GA_MEASUREMENT_ID must be a GA4 G- measurement ID.');
  if (env.META_PIXEL_ID && !/^\d{8,20}$/.test(env.META_PIXEL_ID)) errors.push('META_PIXEL_ID must be a numeric Meta Pixel ID.');
  return errors;
}

function paymentMethods(env = process.env) {
  const methods = [{ id: 'cod', label: 'Cash on delivery', hint: 'Pay when your order arrives.' }];
  if (env.NODE_ENV !== 'production') methods.push({ id: 'card', label: 'Card (demo)', hint: 'Simulated payment. Never enter a real card.' });
  if (env.NODE_ENV !== 'production' || env.KHALTI_ENABLED === 'true') methods.push({ id: 'khalti', label: 'Khalti', hint: env.KHALTI_SECRET_KEY ? (env.KHALTI_TEST_MODE === 'false' ? 'Pay on Khalti.' : 'Khalti sandbox — test payment.') : 'Local checkout sandbox — no charge.' });
  if (env.NODE_ENV !== 'production' || env.BANK_TRANSFER_ENABLED === 'true') methods.push({ id: 'bank', label: 'Bank transfer', hint: env.NODE_ENV === 'production' ? 'Transfer after placing your order. We confirm receipt before dispatch.' : 'Test bank instructions — do not transfer real money.' });
  if (env.NODE_ENV !== 'production' || env.ESEWA_ENABLED === 'true') methods.push({ id: 'esewa', label: 'eSewa', hint: env.ESEWA_TEST_MODE === 'false' ? 'Pay securely on eSewa.' : 'Sandbox payment — no real charge.' });
  return methods;
}

function siteConfig(env = process.env) {
  return {
    storeName: env.STORE_NAME || 'BuildForge',
    supportEmail: env.SUPPORT_EMAIL || '',
    storeAddress: env.STORE_ADDRESS || '',
    shippingPolicy: env.SHIPPING_POLICY || '',
    returnPolicy: env.RETURN_POLICY || '',
    shippingCost: Number.isFinite(Number(env.SHIPPING_FLAT_RATE_NPR)) && env.SHIPPING_FLAT_RATE_NPR !== '' ? Number(env.SHIPPING_FLAT_RATE_NPR) : 300,
    freeShippingThreshold: Number.isFinite(Number(env.FREE_SHIPPING_THRESHOLD_NPR)) && env.FREE_SHIPPING_THRESHOLD_NPR !== '' ? Number(env.FREE_SHIPPING_THRESHOLD_NPR) : 100000,
    checkoutEnabled: env.NODE_ENV !== 'production' || env.CHECKOUT_ENABLED === 'true',
    paymentMethods: paymentMethods(env),
    bankTransfer: env.NODE_ENV !== 'production' || env.BANK_TRANSFER_ENABLED === 'true'
      ? { bankName: env.NODE_ENV === 'production' ? env.BANK_NAME : 'BUILD FORGE TEST BANK — DO NOT PAY',
          accountName: env.NODE_ENV === 'production' ? env.BANK_ACCOUNT_NAME : 'TEST ACCOUNT',
          accountNumber: env.NODE_ENV === 'production' ? env.BANK_ACCOUNT_NUMBER : '0000000000' }
      : null,
    analyticsId: /^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID || '') ? env.GA_MEASUREMENT_ID : '',
    metaPixelId: /^\d{8,20}$/.test(env.META_PIXEL_ID || '') ? env.META_PIXEL_ID : '',
    indexable: env.SITE_INDEXABLE === 'true',
    publicUrl: env.CLIENT_URL || 'http://localhost:5173',
  };
}

module.exports = { productionErrors, paymentMethods, siteConfig };
