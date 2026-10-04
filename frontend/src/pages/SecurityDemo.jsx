import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatNPR } from '../utils/format';
import ExternalPaymentDemo from '../components/security/ExternalPaymentDemo';
const canonicalize = value => Array.isArray(value) ? '[' + value.map(canonicalize).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}' : JSON.stringify(value);
const bytes = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

export default function SecurityDemo() {
  const [proof, setProof] = useState(null), [text, setText] = useState(''), [verification, setVerification] = useState(null);
  const [accounts, setAccounts] = useState([]), [from, setFrom] = useState('alice'), [amount, setAmount] = useState('100');
  const [transactions, setTransactions] = useState([]);
  const [cardScenario, setCardScenario] = useState('approved'), [payment, setPayment] = useState(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const secure = window.location.protocol === 'https:';
  const loadProof = p => { setProof(p); setText(JSON.stringify(p.transaction, null, 2)); setVerification(null); };
  useEffect(() => {
    let active = true;
    Promise.all([api.get('/security-demo/wallets'), api.get('/security-demo/transaction-proof')]).then(([w, p]) => {
      if (active) { setAccounts(w.data.accounts); setTransactions(w.data.transactions || []); loadProof(p.data); }
    }).catch(() => { if (active) setError('Start the classroom HTTPS server to enable this demonstration. See CLASS-DEMO.md.'); });
    return () => { active = false; };
  }, []);
  function amountMinor() {
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Use a positive amount with up to two decimal places.');
    return Math.round(Number(amount) * 100);
  }
  async function run(fn) { setBusy(true); setError(''); try { await fn(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function verify() {
    await run(async () => {
      const encoded = new TextEncoder().encode(canonicalize(JSON.parse(text)));
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)), b => b.toString(16).padStart(2, '0')).join('');
      const key = await crypto.subtle.importKey('spki', bytes(proof.publicKey), { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']);
      const signatureValid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, key, bytes(proof.signature), encoded);
      setVerification({ hash, hashMatches: hash === proof.hash, signatureValid });
    });
  }
  return <main className="max-w-content mx-auto px-4 sm:px-6 py-10 space-y-6">
    <div><h1 className="text-2xl font-semibold">E-payment classroom lab</h1><p className="text-muted mt-2">Simulated funds and dummy payments only. No real payment is processed. Demo balances and signing keys reset when this server restarts.</p></div>
    <section className="border border-border-soft rounded p-5"><h2 className="font-semibold">SSL/TLS checkout</h2><p className="mt-2">{secure ? 'This page uses HTTPS: traffic between the browser and this server is encrypted with TLS.' : 'This page uses HTTP. Open https://localhost:5443/security-demo for the TLS demonstration.'}</p><p className="text-sm text-muted mt-2">Certificate trust must be verified separately in the browser. Inspect the connection and certificate details to show the issuer, localhost identity, and expiry.</p><a href="/checkout" className="btn-secondary mt-3">Open checkout on this connection</a></section>
    {error && <p role="alert" className="text-stock-out">{error}</p>}
    <div className="grid md:grid-cols-2 gap-6">
      <section className="border border-border-soft rounded p-5 space-y-4"><h2 className="font-semibold">Lab 5 · Stored-value wallets and P2P transfer</h2>
        {accounts.map(a => <p key={a.id} className="flex justify-between"><span>{a.name}</span><strong>{formatNPR(a.balanceMinor / 100)}</strong></p>)}
        <label className="block text-sm">Sender<select className="input-field w-full mt-1" value={from} onChange={e=>setFrom(e.target.value)}><option value="alice">Alice → Bob</option><option value="bob">Bob → Alice</option></select></label>
        <label className="block text-sm">Amount (NPR)<input className="input-field w-full mt-1" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} /></label>
        <button disabled={busy || !accounts.length} className="btn-primary" onClick={()=>run(async()=>{ const {data}=await api.post('/security-demo/transfers',{from,to:from==='alice'?'bob':'alice',amountMinor:amountMinor(),requestId:crypto.randomUUID()});setAccounts(data.accounts);setTransactions(previous=>[data.proof.transaction,...previous].slice(0,5));loadProof(data.proof); })}>Transfer demo funds</button>
        <p className="text-xs text-muted">Transfers debit one wallet and credit the other. Insufficient funds are rejected. Repeated request IDs cannot transfer twice.</p>
        <div className="border-t border-border-soft pt-4">
          <h3 className="font-semibold text-sm">Recent wallet transfers</h3>
          {transactions.filter(t=>t.type==='wallet-transfer').length ? <ol className="mt-3 space-y-3">
            {transactions.filter(t=>t.type==='wallet-transfer').slice(0,3).map(t=><li key={t.transactionId} className="rounded border border-border-soft bg-surface p-3 text-sm">
              <div className="flex justify-between gap-3"><span className="capitalize">{t.from} → {t.to}</span><strong>{formatNPR(t.amountMinor/100)}</strong></div>
              <p className="mt-1 font-mono text-xs text-muted break-all">ID: {t.transactionId}</p>
            </li>)}
          </ol> : <p className="mt-2 text-sm text-muted">No transfers yet.</p>}
        </div>
      </section>
      <section className="border border-border-soft rounded p-5 space-y-4"><h2 className="font-semibold">Lab 4 · Dummy credit-card gateway</h2>
        <p className="text-sm text-muted">Uses the amount entered in the wallet panel. Select a test token; no real card number, expiry, or CVV is collected.</p>
        <label className="block text-sm">Dummy card<select className="input-field w-full mt-1" value={cardScenario} onChange={e=>{setCardScenario(e.target.value);setPayment(null);}}><option value="approved">Test card ···· 4242 — approval</option><option value="declined">Test card ···· 0002 — decline</option></select></label>
        <button disabled={busy || !proof} className="btn-secondary" onClick={()=>run(async()=>{const {data}=await api.post('/security-demo/gateway/authorize',{amountMinor:amountMinor(),cardScenario});setPayment(data.payment);})}>Submit dummy card payment</button>
        {payment && <div aria-live="polite"><p className="font-semibold">Status: {payment.status} · {formatNPR(payment.amountMinor/100)}</p><ol className="list-decimal pl-5 text-sm text-muted mt-2 space-y-1">{payment.events.map((event,i)=><li key={i}>{event}</li>)}</ol>
          {payment.status==='authorized' && <button className="btn-primary mt-3" disabled={busy} onClick={()=>run(async()=>{const {data}=await api.post(`/security-demo/gateway/${payment.id}/capture`);setPayment(data.payment);loadProof(data.proof);})}>Capture authorized payment</button>}
        </div>}
      </section>
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      <ExternalPaymentDemo provider="khalti" amountMinor={amountMinor} onProof={loadProof} />
      <ExternalPaymentDemo provider="bank" amountMinor={amountMinor} onProof={loadProof} />
    </div>
    {proof && <section className="border border-border-soft rounded p-5 space-y-4"><h2 className="font-semibold">Transaction hashing and digital signature</h2><p className="text-sm text-muted">The server hashes canonical transaction JSON using SHA-256 and signs it with a private RSA key. Your browser verifies with the public key. Editing the amount below changes the hash and invalidates the signature.</p>
      <label className="block text-sm">Transaction data<textarea className="input-field w-full font-mono mt-2" rows="9" value={text} onChange={e=>{setText(e.target.value);setVerification(null);}} /></label>
      <p className="text-xs font-mono break-all">Original SHA-256: {proof.hash}</p>
      <details><summary className="cursor-pointer text-sm">View signature and public key (RSA-PSS / SHA-256)</summary><p className="text-xs font-mono break-all mt-2">Signature: {proof.signature}</p><p className="text-xs font-mono break-all mt-2">Public key (SPKI): {proof.publicKey}</p></details>
      <div className="flex flex-wrap gap-3"><button disabled={busy || !window.isSecureContext} className="btn-primary" onClick={verify}>Verify hash and signature</button><button className="btn-secondary" onClick={()=>{const t=JSON.parse(JSON.stringify(proof.transaction));t.amountMinor+=100;setText(JSON.stringify(t,null,2));setVerification(null);}}>Tamper: add NPR 1</button><button className="btn-secondary" onClick={()=>loadProof(proof)}>Restore original data</button></div>
      {verification && <div aria-live="polite" className={verification.signatureValid?'text-stock-in':'text-stock-out'}><p>Hash: {verification.hashMatches?'matches':'changed'}. Signature: {verification.signatureValid?'valid':'INVALID — data has changed'}.</p><p className="text-xs font-mono break-all mt-2">Recomputed SHA-256: {verification.hash}</p></div>}
      <p className="text-xs text-muted">A hash detects changes when compared with a trusted hash. A signature binds the data to the signing key. This demo key is delivered over the same TLS connection; independent identity verification requires a separately trusted public key. This is not a payment-provider signature or proof of a real payment.</p>
    </section>}
  </main>;
}
