import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
export default function KhaltiTest() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function finish(choice) {
    setBusy(true); setError('');
    try {
      await api.post(`/orders/khalti-local/${encodeURIComponent(orderId)}`, { choice });
      navigate(`/order-confirmation/${encodeURIComponent(orderId)}`);
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return <main className="max-w-lg mx-auto px-4 sm:px-6 py-16">
    <div className="border border-border-soft rounded p-6 space-y-5">
      <h1 className="font-display text-2xl font-semibold">Khalti local checkout test</h1>
      <p className="text-sm text-muted">This test completes the order in BuildForge’s local development database. It does not contact Khalti or charge money. Live checkout requires a merchant key.</p>
      <p className="text-xs font-mono text-faint">Order {orderId}</p>
      {error && <p role="alert" className="text-stock-out text-sm">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => finish('approve')}>Approve test payment</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => finish('cancel')}>Return without paying</button>
      </div>
      <Link to={`/order-confirmation/${encodeURIComponent(orderId)}`} className="text-sm text-muted underline">View pending order</Link>
    </div>
  </main>;
}
