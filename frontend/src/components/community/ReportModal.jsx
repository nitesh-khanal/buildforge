import { useState } from 'react';
import api from '../../lib/api';
import Modal from '../admin/Modal';
import { REPORT_REASONS } from '../../utils/community';

// `target` is { targetType: 'communityBuild' | 'comment', targetId }.
export default function ReportModal({ target, onClose }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/community/reports', {
        targetType: target.targetType,
        targetId: target.targetId,
        reason,
        details: details.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={target.targetType === 'comment' ? 'Report comment' : 'Report build'} onClose={onClose} width="max-w-sm">
      {done ? (
        <div>
          <p className="text-sm text-muted">Thanks — our moderators will take a look.</p>
          <div className="flex justify-end mt-6">
            <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-faint mb-1.5">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field w-full">
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-faint mb-1.5">Additional details (optional)</label>
            <textarea
              className="input-field w-full min-h-[70px] resize-y"
              value={details}
              maxLength={1000}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else moderators should know?"
            />
          </div>
          {error && <p className="text-sm text-stock-out">{error}</p>}
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm" disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
              {saving ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
