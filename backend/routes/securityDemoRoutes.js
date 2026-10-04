const router = require('express').Router();
const crypto = require('crypto');
const { createProof } = require('../services/transactionProof');
const ClassPayments = require('../services/classPayments');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ledger = new ClassPayments();
const proof = transaction => createProof(transaction, privateKey, publicKey);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/transaction-proof', (req, res) => res.json(proof({ demo: true, transactionId: 'CLASS-DEMO-001', currency: 'NPR', amountMinor: 6800000, items: [{ sku: 'DEMO-CPU', quantity: 1, unitPriceMinor: 6800000 }] })));
router.get('/wallets', (req, res) => res.json({ accounts: ledger.accounts, transactions: ledger.transactions }));
function action(fn) {
  return (req, res) => { try { res.json(fn(req)); } catch (error) { res.status(400).json({ success: false, message: error.message }); } };
}
router.post('/transfers', action(req => ({ proof: proof(ledger.transfer(req.body)), accounts: ledger.accounts })));
router.post('/gateway/authorize', action(req => ({ payment: ledger.authorize(req.body) })));
router.post('/gateway/:id/capture', action(req => {
  const payment = ledger.capture(req.params.id);
  return { payment, proof: proof(payment.transaction) };
}));
router.post('/external/initiate', action(req => ({ payment: ledger.initiateExternal(req.body) })));
router.post('/external/:id/confirm', action(req => {
  const payment = ledger.confirmExternal(req.params.id, req.body);
  return { payment, proof: payment.transaction ? proof(payment.transaction) : null };
}));
module.exports = router;
