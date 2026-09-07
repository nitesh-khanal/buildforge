import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { resolveImageUrl } from '../../utils/format';

// Phase 10 — Category Management. Deliberately no create/delete here: the
// 8 category slugs are structurally fixed by the PC builder's 8 slots and
// the compatibility engine (see backend/models/Category.js's design note)
// — this page only edits each fixed category's *display* metadata
// (label/description/image/order/storefront visibility), inline, one row
// at a time, same spirit as AdminProducts' inline stock editor.
export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({}); // slug -> { label, description, image, displayOrder }
  const [saving, setSaving] = useState(null);
  const [uploading, setUploading] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get('/admin/categories')
      .then(({ data }) => {
        setCategories(data.categories);
        setDrafts(
          Object.fromEntries(
            data.categories.map((c) => [
              c.slug,
              { label: c.label, description: c.description, image: c.image, displayOrder: c.displayOrder },
            ])
          )
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function setDraft(slug, field, value) {
    setDrafts((prev) => ({ ...prev, [slug]: { ...prev[slug], [field]: value } }));
  }

  async function save(slug) {
    setSaving(slug);
    setError(null);
    try {
      const draft = drafts[slug];
      const { data } = await api.put(`/admin/categories/${slug}`, {
        label: draft.label,
        description: draft.description,
        image: draft.image,
        displayOrder: Number(draft.displayOrder) || 0,
      });
      setCategories((prev) => prev.map((c) => (c.slug === slug ? data.category : c)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  // Phase 11 — real upload, replacing the plain URL/path text input (the
  // text field below is kept as a fallback for an already-hosted image
  // URL, e.g. a CDN link, rather than removed outright).
  async function uploadImage(slug, file) {
    if (!file) return;
    setUploading(slug);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post(`/admin/categories/${slug}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCategories((prev) => prev.map((c) => (c.slug === slug ? data.category : c)));
      setDraft(slug, 'image', data.category.image);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(null);
    }
  }

  async function toggleActive(category) {
    setSaving(category.slug);
    setError(null);
    try {
      const { data } = await api.put(`/admin/categories/${category.slug}`, { isActive: !category.isActive });
      setCategories((prev) => prev.map((c) => (c.slug === category.slug ? data.category : c)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-lg font-semibold text-ink">Categories</h2>
        <p className="text-sm text-faint mt-1">
          Edit how each category appears on the storefront. The 8 categories themselves are fixed — they're wired
          into the PC builder's 8 slots and the compatibility engine, so this only manages display metadata, not the
          category list itself.
        </p>
      </div>

      {error && (
        <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : (
        <div className="space-y-4">
          {categories.map((c) => {
            const draft = drafts[c.slug] || {};
            const dirty =
              draft.label !== c.label ||
              draft.description !== c.description ||
              draft.image !== c.image ||
              Number(draft.displayOrder) !== c.displayOrder;
            return (
              <div key={c.slug} className="border border-border-soft rounded p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-canvas border border-border-soft rounded overflow-hidden flex items-center justify-center">
                      {draft.image ? (
                        <img src={resolveImageUrl(draft.image)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-faint">None</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-mono text-faint">{c.slug}</p>
                      <p className="text-ink">{c.label}</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted shrink-0">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      onChange={() => toggleActive(c)}
                      disabled={saving === c.slug}
                      className="accent-accent"
                    />
                    Shown on storefront
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-muted">Label</span>
                    <input
                      className="input-field w-full mt-1"
                      value={draft.label || ''}
                      onChange={(e) => setDraft(c.slug, 'label', e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Display order</span>
                    <input
                      type="number"
                      className="input-field w-full mt-1"
                      value={draft.displayOrder ?? 0}
                      onChange={(e) => setDraft(c.slug, 'displayOrder', e.target.value)}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted">Description</span>
                    <input
                      className="input-field w-full mt-1"
                      value={draft.description || ''}
                      onChange={(e) => setDraft(c.slug, 'description', e.target.value)}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted">Image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="input-field w-full mt-1"
                      disabled={uploading === c.slug}
                      onChange={(e) => uploadImage(c.slug, e.target.files?.[0])}
                    />
                    {uploading === c.slug && <span className="text-xs text-faint">Uploading…</span>}
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted">Or image URL (e.g. a CDN link)</span>
                    <input
                      className="input-field w-full mt-1"
                      placeholder="/uploads/… or https://…"
                      value={draft.image || ''}
                      onChange={(e) => setDraft(c.slug, 'image', e.target.value)}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-faint">{c.count} product{c.count === 1 ? '' : 's'} in this category</p>
                  <button
                    type="button"
                    onClick={() => save(c.slug)}
                    disabled={!dirty || saving === c.slug}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    {saving === c.slug ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
