/**
 * eSewa ePay v2 sandbox integration.
 *
 * Replaces the Phase 2 "always Pending" stub with a real redirect-based
 * gateway flow against eSewa's UAT (sandbox) environment:
 *
 *   1. `buildPaymentPayload(order)` — signs the order with HMAC-SHA256 and
 *      returns the form fields + action URL the frontend auto-submits the
 *      customer to (POST /api/epay/main/v2/form).
 *   2. eSewa redirects the browser back to our `success_url` / `failure_url`
 *      with a base64-encoded `data` query param (success) or plain query
 *      params (failure). `decodeCallbackData` / `verifySignature` validate
 *      that payload wasn't tampered with.
 *   3. `checkTransactionStatus` hits eSewa's independent status-check API —
 *      used both as a fallback if the redirect never lands (user closes the
 *      tab) and as a defense-in-depth double-check before trusting a
 *      callback.
 *
 * Defaults to eSewa's published UAT test credentials (`EPAYTEST` /
 * `8gBm/:&EnhH.1/q`) so the flow works out of the box against the sandbox
 * with zero configuration — same spirit as Phase 2's dummy card flow, but
 * this one actually talks to eSewa's real test environment instead of
 * simulating it locally. Override via ESEWA_MERCHANT_ID / ESEWA_SECRET_KEY
 * once you have real sandbox (or production) merchant credentials.
 */

const crypto = require('crypto');

const SIGNED_FIELDS = 'total_amount,transaction_uuid,product_code';

const UAT_FORM_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const UAT_STATUS_URL = 'https://rc-epay.esewa.com.np/api/epay/transaction/status';
const LIVE_FORM_URL = 'https://epay.esewa.com.np/api/epay/main/v2/form';
const LIVE_STATUS_URL = 'https://epay.esewa.com.np/api/epay/transaction/status';

function isTestMode() {
  return process.env.ESEWA_TEST_MODE !== 'false';
}

function config() {
  return {
    productCode: process.env.ESEWA_MERCHANT_ID || 'EPAYTEST',
    secretKey: process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q', // eSewa's published UAT secret
    formUrl: isTestMode() ? UAT_FORM_URL : LIVE_FORM_URL,
    statusUrl: isTestMode() ? UAT_STATUS_URL : LIVE_STATUS_URL,
  };
}

function sign(message, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

// total_amount must match exactly (including decimal formatting) what's
// posted in the form and what comes back in the callback, or eSewa's own
// signature check fails on their end.
function formatAmount(n) {
  return Number(n).toFixed(2).replace(/\.00$/, '.00');
}

// Builds the signed form fields for the eSewa v2 payment form. `order` needs
// orderId (used as the eSewa transaction_uuid — already globally unique)
// and total. successPath/failurePath are backend callback routes; the
// backend verifies + updates the order, then bounces the browser on to the
// frontend's CLIENT_URL.
function buildPaymentPayload(order, { backendUrl }) {
  const { productCode, secretKey, formUrl } = config();
  const totalAmount = formatAmount(order.total);
  const transactionUuid = order.orderId;

  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = sign(message, secretKey);

  const fields = {
    amount: totalAmount,
    tax_amount: '0',
    total_amount: totalAmount,
    transaction_uuid: transactionUuid,
    product_code: productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: `${backendUrl}/api/orders/esewa/success`,
    failure_url: `${backendUrl}/api/orders/esewa/failure`,
    signed_field_names: SIGNED_FIELDS,
    signature,
  };

  return { formUrl, fields };
}

// Recomputes the signature over whichever fields eSewa says it signed
// (`signed_field_names`) and compares it against the one they sent back.
// This is the mandatory integrity check per eSewa's docs — never trust the
// `status` field in a callback without doing this first.
function verifySignature(payload) {
  const { secretKey } = config();
  if (!payload || !payload.signed_field_names || !payload.signature) return false;

  const fieldNames = payload.signed_field_names.split(',');
  const message = fieldNames.map((f) => `${f}=${payload[f]}`).join(',');
  const expected = sign(message, secretKey);

  // Timing-safe comparison of two base64 strings.
  const a = Buffer.from(expected);
  const b = Buffer.from(payload.signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// eSewa's success redirect carries `?data=<base64 JSON>`.
function decodeCallbackData(base64Data) {
  try {
    const json = Buffer.from(base64Data, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

// Independent server-to-server reconciliation call — doesn't rely on the
// user's browser ever completing the redirect. Safe to call any time to
// find out what eSewa's own ledger says about a transaction.
async function checkTransactionStatus({ transactionUuid, totalAmount }) {
  const { productCode, statusUrl } = config();
  const url = new URL(statusUrl);
  url.searchParams.set('product_code', productCode);
  url.searchParams.set('total_amount', formatAmount(totalAmount));
  url.searchParams.set('transaction_uuid', transactionUuid);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const err = new Error(`eSewa status check failed with HTTP ${response.status}`);
    err.statusCode = 502;
    throw err;
  }
  return response.json(); // { product_code, transaction_uuid, status, ref_id, total_amount }
}

module.exports = {
  isTestMode,
  buildPaymentPayload,
  verifySignature,
  decodeCallbackData,
  checkTransactionStatus,
};
