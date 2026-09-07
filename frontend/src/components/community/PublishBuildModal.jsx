import { useState } from 'react';
import api from '../../lib/api';
import Modal from '../admin/Modal';
import { COMMUNITY_CATEGORIES, VISIBILITY_OPTIONS } from '../../utils/community';

// Two modes, one form: `sourceBuildId` publishes a fresh post
// (POST /api/community/builds); `existingBuild` edits an already-published
// post's metadata only (PUT /api/community/builds/:id) — the component
// snapshot itself is never touched here, per the backend's Phase 1 design
// note that a post doesn't stay live-linked to its source Build.
export default function PublishBuildModal({ sourceBuildId, existingBuild, onSaved, onClose }) {
  const isEdit = Boolean(existingBuild);

  const [title, setTitle] = useState(existingBuild?.title || '');
  const [description, setDescription] = useState(existingBuild?.description || '');
  const [category, setCategory] = useState(existingBuild?.category || 'custom');
  const [tagsInput, setTagsInput] = useState((existingBuild?.tags || []).join(', '));
  const [visibility, setVisibility] = useState(existingBuild?.visibility || 'public');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give your build a title.');
      return;
    }
    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = { title: title.trim(), description: description.trim(), category, tags, visibility };

    try {
      let data;
      if (isEdit) {
        ({ data } = await api.put(`/community/builds/${existingBuild._id}`, payload));
      } else {
        ({ data } = await api.post('/community/builds', { ...payload, sourceBuildId }));
      }
      onSaved(data.build);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit post' : 'Publish to community'} onClose={onClose} width="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!isEdit && (
          <p className="text-xs text-faint -mt-1">
            This publishes a snapshot of the build's current parts and price — editing it later only changes the
            title, description, category, tags, or visibility below, not the parts list.
          </p>
        )}

        <div>
          <label className="block text-xs text-faint mb-1.5">Title</label>
          <input
            className="input-field w-full"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Budget 1080p gaming rig"
          />
        </div>

        <div>
          <label className="block text-xs text-faint mb-1.5">Description (optional)</label>
          <textarea
            className="input-field w-full min-h-[80px] resize-y"
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this build for? Any notes on part choices?"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-faint mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-full">
              {COMMUNITY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-faint mb-1.5">Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="input-field w-full">
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-faint mb-1.5">Tags (comma-separated, optional)</label>
          <input
            className="input-field w-full"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. 1080p, ryzen, silent"
          />
        </div>

        {error && <p className="text-sm text-stock-out">{error}</p>}

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm" disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Publish'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
