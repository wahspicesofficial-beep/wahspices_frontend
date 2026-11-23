import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { markNotificationRead, markAllNotificationsRead } from '@/store/slices/notificationsSlice';
import { imageSrc, resolveLink, timeAgo, typeChipClass } from './notificationUtils';

/**
 * Header bell (signed-in customers): unread badge + dropdown of unread notifications.
 * Clicking an item marks it read (it leaves the list) and follows its link; "Mark all read" clears the list.
 * On phones the panel spans the screen width under the header.
 */
export default function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, unreadCount } = useAppSelector((s) => s.notifications);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n) => {
    dispatch(markNotificationRead(n.id));
    const link = resolveLink(n.buttonUrl);
    setOpen(false);
    if (link?.internal) navigate(link.internal);
    else if (link?.external) window.open(link.external, '_blank', 'noopener,noreferrer');
  };

  const badge = unreadCount > 9 ? '9+' : unreadCount;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 hover:text-brand-green"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-brand-red text-white text-[10px] rounded-full flex items-center justify-center font-bold font-body" data-testid="notification-badge">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-[4.25rem] z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 motion-safe:animate-scale-in"
          data-testid="notification-panel"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden font-body">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-900 text-sm">Notifications</span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => dispatch(markAllNotificationsRead())}
                  className="flex items-center gap-1 text-xs font-medium text-brand-green hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="w-8 h-8 mx-auto text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-700">You&apos;re all caught up</p>
                <p className="text-xs text-gray-400">Offers and new launches will show up here.</p>
              </div>
            ) : (
              <ul className="max-h-[min(70vh,28rem)] overflow-y-auto divide-y divide-gray-50">
                {items.map((n) => {
                  const link = resolveLink(n.buttonUrl);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className="w-full flex gap-3 px-4 py-3 text-left hover:bg-brand-green/5 transition-colors focus:outline-none focus-visible:bg-brand-green/5"
                        data-testid="notification-item"
                      >
                        {n.imageUrl ? (
                          <img src={imageSrc(n.imageUrl)} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-brand-cream" loading="lazy" />
                        ) : (
                          <span className="w-12 h-12 rounded-xl flex-shrink-0 bg-brand-cream flex items-center justify-center text-brand-green">
                            <Bell className="w-5 h-5" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeChipClass(n.type)}`}>{n.typeLabel || n.type}</span>
                            <span className="text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{n.title}</span>
                          {n.message && <span className="mt-0.5 block text-xs text-gray-500 leading-relaxed line-clamp-2">{n.message}</span>}
                          {link && n.buttonLabel && (
                            <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-brand-green">
                              {n.buttonLabel} <ChevronRight className="w-3 h-3" />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
