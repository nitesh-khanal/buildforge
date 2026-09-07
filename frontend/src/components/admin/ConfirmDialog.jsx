import Modal from './Modal';

export default function ConfirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = true, busy, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} width="max-w-sm">
      <p className="text-sm text-muted">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={
            danger
              ? 'inline-flex items-center justify-center gap-2 bg-stock-out hover:brightness-110 text-ink font-body font-medium text-sm px-5 py-2.5 rounded transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none'
              : 'btn-primary'
          }
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
