import { useState } from 'react';
import Modal from './Modal';
import api from '../../lib/api';
import { CATEGORY_LABELS } from '../../utils/specs';
import { resolveImageUrl } from '../../utils/format';

const CATEGORIES = Object.entries(CATEGORY_LABELS);

function toDisplay(product) {
  return {
    name: product?.name || '',
    brand: product?.brand || '',
    category: product?.category || 'cpu',
    price: product?.price ?? '',
    stock: product?.stock ?? 0,
    rating: product?.rating ?? '',
    isFeatured: product?.isFeatured || false,
    description: product?.description || '',
    image: product?.image || '',
    specifications: JSON.stringify(product?.specifications || {}, null, 2),
    compatibilityData: JSON.stringify(product?.compatibilityData || {}, null, 2),
  };
}

// Create AND edit share this form. specifications/compatibilityData are
// edited as raw JSON — every category shapes them differently (see
// backend/seed/products.js), so a fixed set of fields here would either
// hide category-specific specs or need eight separate forms.
export default function ProductFormModal({ product, onClose, onSaved }) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState(() => toDisplay(product));
  const [image, setImage] = useState(product?.image || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function parseJsonField(field, label) {
    const raw = form[field].trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        throw new Error();
      }
      return parsed;
    } catch {
      throw new Error(`${label} must be valid JSON (an object).`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    let specifications;
    let compatibilityData;
    try {
      specifications = parseJsonField('specifications', 'Specifications');
      compatibilityData = parseJsonField('compatibilityData', 'Compatibility data');
    } catch (err) {
      setError(err.message);
      return;
    }

    if (!form.name.trim() || !form.brand.trim() || form.price === '' || Number(form.price) < 0) {
      setError('Name, brand, and a non-negative price are required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock) || 0,
      rating: form.rating === '' ? 0 : Number(form.rating),
      isFeatured: form.isFeatured,
      description: form.description,
      image: image || undefined,
      specifications,
      compatibilityData,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const { data } = await api.put(`/admin/products/${product._id}`, payload);
        onSaved(data.product);
      } else {
        const { data } = await api.post('/admin/products', payload);
        onSaved(data.product);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file || !isEdit) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      // Don't set Content-Type manually — axios drops it for FormData in the
      // browser so the request gets the correct multipart boundary itself.
      const { data } = await api.post(`/admin/products/${product._id}/image`, fd);
      setImage(data.product.image);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${product.name}` : 'Add product'} onClose={onClose} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2">{error}</p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-muted">Name</span>
            <input className="input-field w-full mt-1" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Brand</span>
            <input className="input-field w-full mt-1" value={form.brand} onChange={(e) => set('brand', e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Category</span>
            <select className="input-field w-full mt-1" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Price (NPR)</span>
            <input
              type="number"
              min="0"
              className="input-field w-full mt-1"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Stock</span>
            <input
              type="number"
              min="0"
              className="input-field w-full mt-1"
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Rating (0–5)</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              className="input-field w-full mt-1"
              value={form.rating}
              onChange={(e) => set('rating', e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} className="accent-accent" />
          Featured on homepage
        </label>

        <label className="block">
          <span className="text-xs text-muted">Description</span>
          <textarea
            rows={2}
            className="input-field w-full mt-1 resize-none"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <div>
          <span className="text-xs text-muted">Image</span>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-14 h-14 shrink-0 bg-raised border border-border-soft rounded overflow-hidden flex items-center justify-center">
              {image ? (
                <img src={resolveImageUrl(image)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-faint">None</span>
              )}
            </div>
            <input
              className="input-field flex-1"
              placeholder="/uploads/placeholder.png or full URL"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>
          {isEdit ? (
            <label className="inline-block mt-2 text-xs text-accent hover:text-accent-hover cursor-pointer transition-colors">
              {uploading ? 'Uploading…' : 'Upload a file instead'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageFile} disabled={uploading} />
            </label>
          ) : (
            <p className="text-xs text-faint mt-2">Save the product first to upload an image file.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-muted">Specifications (JSON)</span>
            <textarea
              rows={6}
              spellCheck={false}
              className="input-field w-full mt-1 font-mono text-xs resize-y"
              value={form.specifications}
              onChange={(e) => set('specifications', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Compatibility data (JSON)</span>
            <textarea
              rows={6}
              spellCheck={false}
              className="input-field w-full mt-1 font-mono text-xs resize-y"
              value={form.compatibilityData}
              onChange={(e) => set('compatibilityData', e.target.value)}
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
