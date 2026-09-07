import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
  const { notifications, unreadCount, refreshList, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) refreshList();
  }

  const recent = notifications.slice(0, 5);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-ink rounded transition-colors"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 14.5 6 13 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[11px] font-mono flex items-center justify-center text-ink">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-surface border border-border-soft rounded shadow-lg py-1 z-50">
          {recent.length === 0 ? (
            <p className="px-3 py-4 text-sm text-faint text-center">No notifications yet.</p>
          ) : (
            recent.map((n) => (
              <Link
                key={n._id}
                to={n.link || '/notifications'}
                onClick={() => {
                  setOpen(false);
                  if (!n.isRead) markAsRead(n._id);
                }}
                className={`block px-3 py-2.5 border-b border-border-soft last:border-b-0 hover:bg-raised transition-colors ${
                  n.isRead ? '' : 'bg-raised/60'
                }`}
              >
                <span className="block text-sm text-ink truncate">{n.title}</span>
                <span className="block text-xs text-faint mt-0.5 line-clamp-2">{n.message}</span>
              </Link>
            ))
          )}
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-xs text-center text-accent hover:text-accent-hover transition-colors border-t border-border-soft"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
