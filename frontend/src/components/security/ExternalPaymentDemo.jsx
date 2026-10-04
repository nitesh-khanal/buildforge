import { useState } from 'react';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';

export default function ExternalPaymentDemo({ provider, amountMinor, onProof }) {
  const [payment, setPayment] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const khalti = provider === 'khalti';

  async function perform(task) {
    setBusy(true); setError('');
    try { await task(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function initiate() {
    await perform(async () => {
      const { data } = await api.post('/security-demo/external/initiate', { provider, amountMinor: amountMinor() });
      setPayment(data.payment); setValue('');
    });
  }

  async function confirm() {
    await perform(async () => {
      const { data } = await api.post(`/security-demo/external/${payment.id}/confirm`, khalti ? { code: value.trim() } : { reference: value.trim() });
      setPayment(data.payment);
      if (data.proof) onProof(data.proof);
    });
  }

  return <section className="border border-border-soft rounded p-5 space-y-4">
    <h2 className="font-semibold">{khalti ? 'Khalti-style payment simulation' : 'Bank transfer simulation'}</h2>
    <p className="text-sm text-muted">{khalti
      ? 'Practice initiation, test verification, success, and decline. This demo never contacts Khalti.'
      : 'Practice generating a payment reference and manually confirming a fictional bank receipt. No bank account or real transfer is involved.'}</p>
    <button type="button" className="btn-secondary" disabled={busy} onClick={initiate}>
      {khalti ? 'Start simulated Khalti payment' : 'Create bank transfer instructions'}
    </button>
    {error && <p role="alert" className="text-stock-out text-sm">{error}</p>}
    {payment && <div className="border-t border-border-soft pt-4 space-y-3" aria-live="polite">
      <p className="text-sm">Status: <strong>{payment.status}</strong> · {formatNPR(payment.amountMinor / 100)}</p>
      <p className="text-xs font-mono break-all">Demo reference: {payment.reference}</p>
      <ol className="list-decimal pl-5 text-sm text-muted space-y-1">{payment.events.map((event, i) => <li key={i}>{event}</li>)}</ol>
      {payment.status === 'pending' && <>
        <label className="block text-sm">{khalti ? 'Test verification code' : 'Confirm the displayed demo reference'}
          <input className="input-field w-full mt-1" value={value} onChange={event => setValue(event.target.value)}
            placeholder={khalti ? '123456' : payment.reference} autoComplete="off" />
        </label>
        {khalti && <p className="text-xs text-muted">Use 123456 for success or 000000 for decline. These are fixed demo codes.</p>}
        <button type="button" className="btn-primary" disabled={busy || !value.trim()} onClick={confirm}>
          {khalti ? 'Verify test payment' : 'Confirm simulated receipt'}
        </button>
      </>}
      {payment.status === 'completed' && <p className="text-stock-in text-sm">A signed demo receipt is ready in the transaction proof panel below.</p>}
    </div>}
  </section>;
}
