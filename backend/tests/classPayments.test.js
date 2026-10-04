const crypto = require('crypto');
const ClassPayments = require('../services/classPayments');
const { canonicalize, createProof } = require('../services/transactionProof');
describe('classroom payment simulations', () => {
  it('conserves stored value and rejects duplicate debit or insufficient funds', () => {
    const ledger = new ClassPayments();
    const request = { from: 'alice', to: 'bob', amountMinor: 10000, requestId: 'once' };
    const transfer = ledger.transfer(request);
    expect(ledger.accounts.map(a=>a.balanceMinor)).toEqual([90000,60000]);
    expect(ledger.transfer(request)).toBe(transfer);
    expect(()=>ledger.transfer({...request,amountMinor:20000})).toThrow('different transfer');
    expect(()=>ledger.transfer({...request,amountMinor:100000,requestId:'overdraw'})).toThrow('Insufficient');
    expect(ledger.accounts.reduce((s,a)=>s+a.balanceMinor,0)).toBe(150000);
  });
  it('rejects negative, fractional, self and unknown-account transfers', () => {
    const ledger = new ClassPayments();
    for(const amountMinor of [-1,0,1.5,NaN]) expect(()=>ledger.transfer({from:'alice',to:'bob',amountMinor,requestId:'bad'})).toThrow();
    expect(()=>ledger.transfer({from:'alice',to:'alice',amountMinor:100,requestId:'self'})).toThrow();
    expect(()=>ledger.transfer({from:'stranger',to:'bob',amountMinor:100,requestId:'unknown'})).toThrow();
  });
  it('captures once after authorization and never captures a decline', () => {
    const ledger = new ClassPayments();
    const approved=ledger.authorize({amountMinor:10000,cardScenario:'approved'});
    expect(approved.status).toBe('authorized');
    ledger.capture(approved.id); ledger.capture(approved.id);
    expect(ledger.transactions).toHaveLength(1);
    const declined=ledger.authorize({amountMinor:10000,cardScenario:'declined'});
    expect(()=>ledger.capture(declined.id)).toThrow('authorized');
  });
  it('settles a Khalti-style demo only after the approved test code, once', () => {
    const ledger = new ClassPayments();
    const payment = ledger.initiateExternal({ provider: 'khalti', amountMinor: 25000 });
    expect(payment.status).toBe('pending');
    expect(() => ledger.confirmExternal(payment.id, { code: '999999' })).toThrow('Invalid demo code');
    expect(ledger.transactions).toHaveLength(0);
    const completed = ledger.confirmExternal(payment.id, { code: '123456' });
    expect(completed.status).toBe('completed');
    expect(completed.transaction.amountMinor).toBe(25000);
    expect(ledger.confirmExternal(payment.id, { code: '123456' })).toBe(completed);
    expect(ledger.transactions).toHaveLength(1);
  });
  it('declines a Khalti-style test payment without producing a receipt', () => {
    const ledger = new ClassPayments();
    const payment = ledger.initiateExternal({ provider: 'khalti', amountMinor: 25000 });
    expect(ledger.confirmExternal(payment.id, { code: '000000' }).status).toBe('failed');
    expect(() => ledger.confirmExternal(payment.id, { code: '123456' })).toThrow();
    expect(ledger.transactions).toHaveLength(0);
  });
  it('requires the matching bank reference and records a single demo receipt', () => {
    const ledger = new ClassPayments();
    const payment = ledger.initiateExternal({ provider: 'bank', amountMinor: 35000 });
    expect(() => ledger.confirmExternal(payment.id, { reference: 'wrong' })).toThrow('does not match');
    expect(ledger.transactions).toHaveLength(0);
    const completed = ledger.confirmExternal(payment.id, { reference: payment.reference });
    expect(completed.status).toBe('completed');
    expect(completed.transaction.type).toBe('bank-demo-payment');
    ledger.confirmExternal(payment.id, { reference: payment.reference });
    expect(ledger.transactions).toHaveLength(1);
  });
  it('rejects unsupported providers and invalid payment amounts', () => {
    const ledger = new ClassPayments();
    expect(() => ledger.initiateExternal({ provider: 'unknown', amountMinor: 1000 })).toThrow();
    expect(() => ledger.initiateExternal({ provider: 'bank', amountMinor: 0 })).toThrow();
  });
  it('verifies original signatures and rejects changed transaction amounts', () => {
    const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
    const transaction={demo:true,amountMinor:10000,currency:'NPR'};
    const proof=createProof(transaction,privateKey,publicKey);
    const options={key:publicKey,padding:crypto.constants.RSA_PKCS1_PSS_PADDING,saltLength:32};
    expect(crypto.verify('sha256',Buffer.from(canonicalize(transaction)),options,Buffer.from(proof.signature,'base64'))).toBe(true);
    expect(crypto.verify('sha256',Buffer.from(canonicalize({...transaction,amountMinor:10100})),options,Buffer.from(proof.signature,'base64'))).toBe(false);
    expect(canonicalize({b:2,a:1})).toBe(canonicalize({a:1,b:2}));
  });
});
