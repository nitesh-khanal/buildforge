import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useAddresses } from '../context/AddressContext';
import api from '../lib/api';
import { formatNPR } from '../utils/format';
import { SHIPPING_COST, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';

const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'];

const PAYMENT_METHODS = [
  { id: 'cod', label: 'Cash on delivery', hint: 'Pay when your order arrives.' },
  { id: 'card', label: 'Card (demo)', hint: 'Simulated for this demo — no real charge, no card data stored.' },
  { id: 'esewa', label: 'eSewa', hint: "You'll be redirected to eSewa's sandbox to complete payment." },
];

// eSewa needs a real browser POST + redirect (not an XHR) to send the
// customer to their hosted payment page, so this builds and submits a
// throwaway form rather than going through axios.
function submitEsewaForm({ formUrl, fields }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = formUrl;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function addressToShipping(a) {
  return {
    fullName: a.fullName || '',
    email: a.email || '',
    phone: a.phone || '',
    address: a.address || '',
    city: a.city || '',
    province: a.province || '',
    postalCode: a.postalCode || '',
  };
}

export default function Checkout() {
  const { cart, subtotal, itemCount, loading: cartLoading, refresh: refreshCart } = useCart();
  const { user } = useAuth();
  const { addresses, loading: addressesLoading } = useAddresses();
  const navigate = useNavigate();

  // 'new' shows the inline form; any other value is a saved Address _id
  // whose fields get copied into `address` below. Starts on 'new' so a
  // brand-new account (no saved addresses yet) sees the form immediately —
  // once addresses load, the effect below switches to the default one.
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [address, setAddress] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address?.address || '',
    city: user?.address?.city || '',
    province: user?.address?.province || '',
    postalCode: user?.address?.postalCode || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [card, setCard] = useState({ cardNumber: '', expiry: '', cvv: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Coupon (Phase 5). `appliedCoupon` is only a preview from
  // `POST /api/coupons/validate` — the order's real discount is always
  // recomputed authoritatively by the backend at submit time (see
  // orderController.createOrder), so a stale preview can never under/
  // overcharge anyone; at worst it fails at submit with a fresh reason.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount }
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState(null);

  // Once saved addresses load, default to picking the default one (or the
  // first) instead of the blank inline form — the whole point of this
  // phase's checkout change. A guest-adjacent brand-new account with zero
  // saved addresses simply stays on 'new', form untouched.
  useEffect(() => {
    if (addressesLoading || addresses.length === 0 || selectedAddressId !== 'new') return;
    const preferred = addresses.find((a) => a.isDefault) || addresses[0];
    setSelectedAddressId(preferred._id);
    setAddress(addressToShipping(preferred));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesLoading, addresses]);

  function selectAddress(id) {
    setSelectedAddressId(id);
    if (id === 'new') return;
    const found = addresses.find((a) => a._id === id);
    if (found) setAddress(addressToShipping(found));
  }

  const shippingEstimate = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const discountEstimate = appliedCoupon?.discount || 0;
  const totalEstimate = subtotal + shippingEstimate - discountEstimate;

  function updateAddress(field, value) {
    setAddress((a) => ({ ...a, [field]: value }));
  }

  async function applyCoupon(e) {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const { data } = await api.post('/coupons/validate', { code: couponInput.trim() });
      setAppliedCoupon({ code: data.code, discount: data.discount });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message);
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        shippingAddress: address,
        paymentMethod,
        cardDetails: paymentMethod === 'card' ? card : undefined,
        couponCode: appliedCoupon?.code || undefined,
      });

      if (data.esewaPayment) {
        submitEsewaForm(data.esewaPayment);
        return; // browser is navigating to eSewa now
      }

      await refreshCart();
      navigate(`/order-confirmation/${data.order.orderId}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (cartLoading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-sm text-faint">Loading…</div>;
  }

  if (itemCount === 0) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center">
        <p className="text-ink font-medium">Your cart is empty.</p>
        <p className="text-sm text-faint mt-1">Add something before checking out.</p>
        <Link to="/shop" className="btn-primary mt-6 inline-flex">
          Browse parts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_360px] gap-10 items-start">
        <div className="space-y-8">
          <section className="border border-border-soft rounded p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-ink">Shipping address</h2>
              {addresses.length > 0 && (
                <Link to="/account/addresses" className="text-xs text-faint hover:text-accent transition-colors">
                  Manage addresses
                </Link>
              )}
            </div>

            {addresses.length > 0 && (
              <div className="flex flex-col gap-2 mb-5">
                {addresses.map((a) => (
                  <label
                    key={a._id}
                    className={`flex items-start gap-3 border rounded p-3 cursor-pointer transition-colors ${
                      selectedAddressId === a._id ? 'border-accent' : 'border-border-soft hover:border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={selectedAddressId === a._id}
                      onChange={() => selectAddress(a._id)}
                      className="mt-0.5 accent-accent"
                    />
                    <span>
                      <span className="block text-sm text-ink">
                        {a.label || a.fullName}
                        {a.isDefault && <span className="text-xs text-faint ml-2">Default</span>}
                      </span>
                      <span className="block text-xs text-faint mt-0.5">
                        {a.address}, {a.city}, {a.province}
                      </span>
                    </span>
                  </label>
                ))}
                <label
                  className={`flex items-start gap-3 border rounded p-3 cursor-pointer transition-colors ${
                    selectedAddressId === 'new' ? 'border-accent' : 'border-border-soft hover:border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="savedAddress"
                    checked={selectedAddressId === 'new'}
                    onChange={() => selectAddress('new')}
                    className="mt-0.5 accent-accent"
                  />
                  <span className="text-sm text-ink">Use a different address</span>
                </label>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted mb-1.5">Full name</label>
                <input
                  required
                  readOnly={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  value={address.fullName}
                  onChange={(e) => updateAddress('fullName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  readOnly={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  value={address.email}
                  onChange={(e) => updateAddress('email', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Phone</label>
                <input
                  required
                  readOnly={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  value={address.phone}
                  onChange={(e) => updateAddress('phone', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted mb-1.5">Address</label>
                <input
                  required
                  readOnly={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  placeholder="Street, ward, landmark"
                  value={address.address}
                  onChange={(e) => updateAddress('address', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">City</label>
                <input
                  required
                  readOnly={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  value={address.city}
                  onChange={(e) => updateAddress('city', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Province</label>
                <select
                  required
                  disabled={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  value={address.province}
                  onChange={(e) => updateAddress('province', e.target.value)}
                >
                  <option value="" disabled>
                    Select province
                  </option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">
                  Postal code <span className="text-faint">(optional)</span>
                </label>
                <input
                  readOnly={selectedAddressId !== 'new'}
                  className="input-field w-full disabled:opacity-70"
                  value={address.postalCode}
                  onChange={(e) => updateAddress('postalCode', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="border border-border-soft rounded p-5">
            <h2 className="text-sm font-medium text-ink mb-4">Payment method</h2>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 border rounded p-3 cursor-pointer transition-colors ${
                    paymentMethod === m.id ? 'border-accent' : 'border-border-soft hover:border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m.id}
                    checked={paymentMethod === m.id}
                    onChange={() => setPaymentMethod(m.id)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="block text-sm text-ink">{m.label}</span>
                    <span className="block text-xs text-faint mt-0.5">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {paymentMethod === 'card' && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border-soft">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted mb-1.5">Card number</label>
                  <input
                    required
                    className="input-field w-full font-mono"
                    placeholder="4111 1111 1111 1111"
                    value={card.cardNumber}
                    onChange={(e) => setCard((c) => ({ ...c, cardNumber: e.target.value }))}
                  />
                  <p className="text-xs text-faint mt-1">End it in 0000 to test a declined payment.</p>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5">Expiry</label>
                  <input
                    required
                    className="input-field w-full font-mono"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5">CVV</label>
                  <input
                    required
                    className="input-field w-full font-mono"
                    placeholder="123"
                    value={card.cvv}
                    onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </section>

          {error && <p className="text-sm text-stock-out">{error}</p>}
        </div>

        <div className="border border-border-soft rounded p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-medium text-ink mb-4">Order summary</h2>

          <div className="max-h-64 overflow-y-auto pr-1 -mr-1">
            {(cart?.items || []).map((item) => (
              <div key={item._id} className="flex justify-between text-sm py-1.5 gap-2">
                <span className="text-muted truncate">
                  {item.name}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </span>
                <span className="font-mono text-ink shrink-0">{formatNPR(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 mb-1">
            {appliedCoupon ? (
              <div className="flex items-center justify-between gap-2 border border-accent/40 bg-accent-soft/30 rounded px-3 py-2">
                <span className="text-xs font-mono text-ink">{appliedCoupon.code} applied</span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs text-faint hover:text-ink transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="input-field flex-1 py-2 px-3 text-sm font-mono uppercase"
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponInput.trim()}
                  className="btn-secondary py-2 px-3 text-xs shrink-0"
                >
                  {couponBusy ? '…' : 'Apply'}
                </button>
              </div>
            )}
            {couponError && <p className="text-xs text-stock-out mt-1.5">{couponError}</p>}
          </div>

          <div className="spec-row mt-2">
            <span className="spec-label">Subtotal</span>
            <span className="spec-value">{formatNPR(subtotal)}</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Shipping</span>
            <span className="spec-value">{shippingEstimate === 0 ? 'Free' : formatNPR(shippingEstimate)}</span>
          </div>
          {discountEstimate > 0 && (
            <div className="spec-row">
              <span className="spec-label">Discount</span>
              <span className="spec-value">−{formatNPR(discountEstimate)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-4 mt-1">
            <span className="text-ink font-medium">Total</span>
            <span className="font-display text-xl font-semibold text-ink">{formatNPR(totalEstimate)}</span>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full mt-5">
            {submitting ? 'Placing order…' : 'Place order'}
          </button>
        </div>
      </form>
    </div>
  );
}
