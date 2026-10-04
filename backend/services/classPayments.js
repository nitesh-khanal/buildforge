const crypto = require('crypto');
class ClassPayments {
  constructor() { this.reset(); }
  reset() {
    this.accounts = [{ id: 'alice', name: 'Alice', balanceMinor: 100000 }, { id: 'bob', name: 'Bob', balanceMinor: 50000 }];
    this.transactions = []; this.payments = new Map(); this.requests = new Map(); this.externalPayments = new Map();
  }
  amount(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000000) throw new Error('Enter an amount from NPR 0.01 to NPR 100,000.');
  }
  record(type, data) {
    const transaction = { transactionId: crypto.randomUUID(), demo: true, type, currency: 'NPR', createdAt: new Date().toISOString(), ...data };
    this.transactions.unshift(transaction); this.transactions = this.transactions.slice(0, 100); return transaction;
  }
  transfer({ from, to, amountMinor, requestId }) {
    this.amount(amountMinor);
    if (!requestId || typeof requestId !== 'string' || requestId.length > 100) throw new Error('A transfer request ID is required.');
    const fingerprint = JSON.stringify({ from, to, amountMinor });
    if (this.requests.has(requestId)) {
      const previous = this.requests.get(requestId);
      if (previous.fingerprint !== fingerprint) throw new Error('This request ID was already used for a different transfer.');
      return previous.transaction;
    }
    const sender = this.accounts.find(a => a.id === from), receiver = this.accounts.find(a => a.id === to);
    if (!sender || !receiver || sender === receiver) throw new Error('Choose two different demo accounts.');
    if (sender.balanceMinor < amountMinor) throw new Error('Insufficient wallet balance.');
    sender.balanceMinor -= amountMinor; receiver.balanceMinor += amountMinor;
    const transaction = this.record('wallet-transfer', { from, to, amountMinor });
    this.requests.set(requestId, { fingerprint, transaction }); return transaction;
  }
  authorize({ amountMinor, cardScenario }) {
    this.amount(amountMinor);
    if (!['approved', 'declined'].includes(cardScenario)) throw new Error('Select a dummy card scenario.');
    const payment = { id: crypto.randomUUID(), amountMinor, currency: 'NPR', cardLast4: cardScenario === 'approved' ? '4242' : '0002', status: cardScenario === 'approved' ? 'authorized' : 'declined', events: ['Checkout submitted', 'Dummy card token created', 'Gateway authorization requested', cardScenario === 'approved' ? 'Authorization approved; awaiting capture' : 'Authorization declined; no funds moved'] };
    this.payments.set(payment.id, payment); return payment;
  }
  initiateExternal({ provider, amountMinor }) {
    this.amount(amountMinor);
    if (!['khalti', 'bank'].includes(provider)) throw new Error('Choose a supported demo payment method.');
    const id = crypto.randomUUID();
    const payment = {
      id, provider, amountMinor, currency: 'NPR', status: 'pending',
      reference: `BF-DEMO-${id.slice(0, 8).toUpperCase()}`,
      events: provider === 'khalti'
        ? ['Khalti-style demo checkout initiated', 'Awaiting test verification code; no request sent to Khalti']
        : ['Bank transfer instructions generated', 'Awaiting manual simulated receipt confirmation; no bank was contacted'],
    };
    this.externalPayments.set(id, payment);
    return payment;
  }
  confirmExternal(id, { code, reference } = {}) {
    const payment = this.externalPayments.get(id);
    if (!payment) throw new Error('Demo payment not found.');
    if (payment.status === 'completed') return payment;
    if (payment.status !== 'pending') throw new Error('This demo payment cannot be confirmed.');
    if (payment.provider === 'khalti') {
      if (code === '000000') {
        payment.status = 'failed'; payment.events.push('Test verification rejected; no funds moved');
        return payment;
      }
      if (code !== '123456') throw new Error('Invalid demo code. Use 123456 to approve or 000000 to decline.');
      payment.events.push('Test code accepted; simulated Khalti settlement recorded');
    } else {
      if (reference !== payment.reference) throw new Error('Bank reference does not match the pending payment.');
      payment.events.push('Manual demo receipt confirmed; simulated bank settlement recorded');
    }
    payment.status = 'completed';
    payment.transaction = this.record(`${payment.provider}-demo-payment`, {
      paymentId: id, amountMinor: payment.amountMinor, reference: payment.reference,
      merchant: 'BuildForge classroom merchant',
    });
    return payment;
  }

  capture(id) {
    const payment = this.payments.get(id);
    if (!payment) throw new Error('Payment not found.');
    if (payment.status === 'captured') return payment;
    if (payment.status !== 'authorized') throw new Error('Only an authorized payment can be captured.');
    payment.status = 'captured'; payment.events.push('Capture completed; simulated merchant settlement recorded');
    payment.transaction = this.record('card-capture', { paymentId: id, amountMinor: payment.amountMinor, cardLast4: payment.cardLast4, merchant: 'BuildForge classroom merchant' });
    return payment;
  }
}
module.exports = ClassPayments;
