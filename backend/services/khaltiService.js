const SANDBOX = 'https://dev.khalti.com/api/v2/epayment/';
const LIVE = 'https://khalti.com/api/v2/epayment/';
function isLocalMock(env = process.env) {
  return env.NODE_ENV !== 'production' && !env.KHALTI_SECRET_KEY;
}
function amountPaisa(npr) {
  const paisa = Math.round(Number(npr) * 100);
  if (!Number.isSafeInteger(paisa) || paisa < 1000 || Math.abs(paisa / 100 - Number(npr)) > 0.000001) throw new Error('Khalti requires a valid total of at least NPR 10.');
  return paisa;
}
function endpoint(env = process.env) { return env.KHALTI_TEST_MODE === 'false' ? LIVE : SANDBOX; }
async function post(path, payload, env = process.env) {
  if (!env.KHALTI_SECRET_KEY) throw new Error('Khalti merchant key is not configured.');
  const response = await fetch(endpoint(env) + path, {
    method: 'POST',
    headers: { Authorization: `Key ${env.KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Khalti returned HTTP ${response.status}.`);
  return data;
}
async function initiate(order, { backendUrl, clientUrl }, env = process.env) {
  const amount = amountPaisa(order.total);
  if (isLocalMock(env)) return { pidx: `local-${order.orderId}`, payment_url: `${clientUrl.replace(/\/$/, '')}/khalti-test/${encodeURIComponent(order.orderId)}`, mock: true };
  const data = await post('initiate/', {
    return_url: `${backendUrl.replace(/\/$/, '')}/api/orders/khalti/return`,
    website_url: `${clientUrl.replace(/\/$/, '')}/`,
    amount, purchase_order_id: order.orderId, purchase_order_name: `BuildForge order ${order.orderId}`,
  }, env);
  if (!data.pidx || !/^https:\/\//.test(data.payment_url || '') || !new URL(data.payment_url).hostname.endsWith('.khalti.com')) throw new Error('Khalti returned an invalid payment link.');
  return { pidx: data.pidx, payment_url: data.payment_url, mock: false };
}
async function lookup(pidx, env = process.env) {
  const data = await post('lookup/', { pidx }, env);
  return { pidx: data.pidx, status: data.status, amount: Number(data.total_amount), transactionId: data.transaction_id, refunded: data.refunded === true };
}
function matches(order, result) {
  return result.pidx === order.khaltiDetails?.pidx && result.status === 'Completed' && !result.refunded && result.amount === amountPaisa(order.total) && Boolean(result.transactionId);
}
module.exports = { amountPaisa, isLocalMock, initiate, lookup, matches };
