import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationRow({ notification, onRead }) {
  const content = (
    <div
      className={`border rounded p-4 transition-colors ${
        notification.isRead ? 'border-border-soft' : 'border-accent bg-raised'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink">{notification.title}</span>
        <span className="text-xs text-faint shrink-0">{timeAgo(notification.createdAt)}</span>
      </div>
      <p className="text-sm text-muted mt-1">{notification.message}</p>
    </div>
  );

  if (!notification.link) return content;

  return (
    <Link to={notification.link} onClick={() => !notification.isRead && onRead(notification._id)}>
      {content}
    </Link>
  );
}

export default function Notifications() {
  const { notifications, loading, error, refreshList, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Notifications</h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllAsRead} className="btn-secondary py-2 px-3 text-xs">
            Mark all as read
          </button>
        )}
      </div>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-faint">Nothing here yet — order and account updates will show up here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <NotificationRow key={n._id} notification={n} onRead={markAsRead} />
          ))}
        </div>
      )}
    </div>
  );
}
