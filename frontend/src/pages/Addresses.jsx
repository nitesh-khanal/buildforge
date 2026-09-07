import { useState } from 'react';
import { useAddresses } from '../context/AddressContext';

const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'];

const EMPTY_FORM = {
  label: '',
  fullName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
};

function AddressForm({ initial, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border-soft rounded p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">
            Label <span className="text-faint">(optional)</span>
          </label>
          <input
            className="input-field w-full"
            placeholder="Home, Office…"
            value={form.label}
            onChange={(e) => update('label', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Full name</label>
          <input
            required
            className="input-field w-full"
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Phone</label>
          <input
            required
            className="input-field w-full"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">
            Email <span className="text-faint">(optional)</span>
          </label>
          <input
            type="email"
            className="input-field w-full"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1.5">Address</label>
          <input
            required
            className="input-field w-full"
            placeholder="Street, ward, landmark"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">City</label>
          <input
            required
            className="input-field w-full"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Province</label>
          <select
            required
            className="input-field w-full"
            value={form.province}
            onChange={(e) => update('province', e.target.value)}
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
            className="input-field w-full"
            value={form.postalCode}
            onChange={(e) => update('postalCode', e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-stock-out">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Saving…' : 'Save address'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressCard({ address, onEdit, onDelete, onSetDefault }) {
  const [busy, setBusy] = useState(false);

  async function handle(action) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-border-soft rounded p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-ink font-medium">{address.label || 'Address'}</span>
            {address.isDefault && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">Default</span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">{address.fullName}</p>
          <p className="text-sm text-faint">{address.phone}</p>
          <p className="text-sm text-faint mt-1">
            {address.address}, {address.city}, {address.province}
            {address.postalCode ? ` ${address.postalCode}` : ''}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        {!address.isDefault && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handle(() => onSetDefault(address._id))}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            Set as default
          </button>
        )}
        <button type="button" onClick={() => onEdit(address)} className="btn-secondary py-1.5 px-3 text-xs">
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle(() => onDelete(address._id))}
          className="py-1.5 px-3 text-xs rounded border border-border-soft hover:border-stock-out text-muted hover:text-stock-out transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function Addresses() {
  const { addresses, loading, error, createAddress, updateAddress, setDefaultAddress, deleteAddress } =
    useAddresses();
  const [mode, setMode] = useState('list'); // 'list' | 'add' | { editing: address }
  const editing = mode !== 'list' && mode !== 'add' ? mode : null;

  async function handleCreate(form) {
    await createAddress(form);
    setMode('list');
  }

  async function handleUpdate(form) {
    await updateAddress(editing._id, form);
    setMode('list');
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Saved addresses</h1>
        {mode === 'list' && (
          <button type="button" onClick={() => setMode('add')} className="btn-primary">
            Add address
          </button>
        )}
      </div>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {mode === 'add' && (
        <div className="mb-8">
          <AddressForm onCancel={() => setMode('list')} onSubmit={handleCreate} />
        </div>
      )}
      {editing && (
        <div className="mb-8">
          <AddressForm initial={editing} onCancel={() => setMode('list')} onSubmit={handleUpdate} />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : addresses.length === 0 && mode === 'list' ? (
        <p className="text-sm text-faint">No saved addresses yet — add one to skip retyping it at checkout.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <AddressCard
              key={a._id}
              address={a}
              onEdit={(addr) => setMode(addr)}
              onDelete={deleteAddress}
              onSetDefault={setDefaultAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
