import { useState } from 'react';
import Modal from './Modal';
import api from '../../lib/api';
import { CATEGORY_LABELS } from '../../utils/specs';
import ProductPickerField from './ProductPickerField';

const CATEGORIES = Object.entries(CATEGORY_LABELS);

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function toDisplay(coupon) {
  return {
    code: coupon?.code || '',
    discountType: coupon?.discountType || 'percentage',
    discountValue: coupon?.discountValue ?? '',
    minOrderAmount: coupon?.minOrderAmount ?? 0,
    maxDiscountAmount: coupon?.maxDiscountAmount ?? '',
    startDate: toDateInput(coupon?.startDate) || toDateInput(new Date()),
    expiryDate: toDateInput(coupon?.expiryDate),
    usageLimit: coupon?.usageLimit ?? '',
    usageLimitPerUser: coupon?.usageLimitPerUser ?? 1,
    isActive: coupon?.isActive ?? true,
    applicableCategories: coupon?.applicableCategories || [],
    applicableProducts: (coupon?.applicableProducts || []).map((p) => (typeof p === 'string' ? p : p._id)),
  };
}

// Create AND edit share this form. Phase 10 added a product picker
// (`ProductPickerField`) for `applicableProducts` — previously this form
// only exposed category-level restriction, per its own comment (now
// out of date, see BUILD_FORGE_PROGRESS.md's Phase 5/9 "Known bugs" note);
// the backend/couponService.js has fully supported specific-product
// restriction since Phase 5.
export default function CouponFormModal({ coupon, onClose, onSaved }) {
  const isEdit = Boolean(coupon);
  const [form, setForm] = useState(() => toDisplay(coupon));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleCategory(slug) {
    setForm((f) => ({
      ...f,
      applicableCategories: f.applicableCategories.includes(slug)
        ? f.applicableCategories.filter((c) => c !== slug)
        : [...f.applicableCategories, slug],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.code.trim() || form.discountValue === '' || Number(form.discountValue) < 0) {
      setError('Code and a non-negative discount value are required.');
      return;
    }
    if (form.discountType === 'percentage' && Number(form.discountValue) > 100) {
      setError('A percentage discount cannot exceed 100.');
      return;
    }
    if (!form.expiryDate) {
      setError('Expiry date is required.');
      return;
    }
    if (form.startDate && new Date(form.expiryDate) <= new Date(form.startDate)) {
      setError('Expiry date must be after the start date.');
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount) || 0,
      maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      expiryDate: new Date(form.expiryDate).toISOString(),
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      usageLimitPerUser: Number(form.usageLimitPerUser) || 1,
      isActive: form.isActive,
      applicableCategories: form.applicableCategories,
      applicableProducts: form.applicableProducts,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const { data } = await api.put(`/admin/coupons/${coupon._id}`, payload);
        onSaved(data.coupon);
      } else {
        const { data } = await api.post('/admin/coupons', payload);
        onSaved(data.coupon);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${coupon.code}` : 'Create coupon'} onClose={onClose} width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2">{error}</p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="text-xs text-muted">Code</span>
            <input
              className="input-field w-full mt-1 font-mono uppercase"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Discount type</span>
            <select
              className="input-field w-full mt-1"
              value={form.discountType}
              onChange={(e) => set('discountType', e.target.value)}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed (NPR)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">{form.discountType === 'percentage' ? 'Discount (%)' : 'Discount (NPR)'}</span>
            <input
              type="number"
              min="0"
              max={form.discountType === 'percentage' ? 100 : undefined}
              className="input-field w-full mt-1"
              value={form.discountValue}
              onChange={(e) => set('discountValue', e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Minimum order (NPR)</span>
            <input
              type="number"
              min="0"
              className="input-field w-full mt-1"
              value={form.minOrderAmount}
              onChange={(e) => set('minOrderAmount', e.target.value)}
            />
          </label>
          {form.discountType === 'percentage' && (
            <label className="block">
              <span className="text-xs text-muted">Max discount (NPR, optional)</span>
              <input
                type="number"
                min="0"
                className="input-field w-full mt-1"
                placeholder="No cap"
                value={form.maxDiscountAmount}
                onChange={(e) => set('maxDiscountAmount', e.target.value)}
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs text-muted">Start date</span>
            <input
              type="date"
              className="input-field w-full mt-1"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Expiry date</span>
            <input
              type="date"
              className="input-field w-full mt-1"
              value={form.expiryDate}
              onChange={(e) => set('expiryDate', e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Total usage limit (optional)</span>
            <input
              type="number"
              min="1"
              className="input-field w-full mt-1"
              placeholder="Unlimited"
              value={form.usageLimit}
              onChange={(e) => set('usageLimit', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Uses per customer</span>
            <input
              type="number"
              min="1"
              className="input-field w-full mt-1"
              value={form.usageLimitPerUser}
              onChange={(e) => set('usageLimitPerUser', e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="accent-accent" />
          Active
        </label>

        <div>
          <span className="text-xs text-muted">Restrict to categories (optional — leave empty for all products)</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {CATEGORIES.map(([slug, label]) => (
              <button
                key={slug}
                type="button"
                onClick={() => toggleCategory(slug)}
                className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                  form.applicableCategories.includes(slug)
                    ? 'border-accent text-accent bg-accent-soft/30'
                    : 'border-border-soft text-faint hover:text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ProductPickerField
          label="Restrict to specific products (optional — combines with the category restriction above; leave empty to allow every product)"
          selectedIds={form.applicableProducts}
          onChange={(ids) => set('applicableProducts', ids)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
