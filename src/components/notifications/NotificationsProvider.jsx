import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchNotificationSummary, notificationReceived, broadcastEnded, broadcastRemoved, notificationStateSynced,
  setLive, resetNotifications, dismissBanner,
} from '@/store/slices/notificationsSlice';
import { connectNotifications } from '@/services/notificationsHub';
import BroadcastBanner from './BroadcastBanner';
import { isBannerSuppressedPath, isPaymentModalOpen } from './notificationUtils';

const POLL_MS = 60_000;          // fallback polling while the socket is down
const FOCUS_REFRESH_MS = 15_000; // at most one refresh per 15 s when the tab regains focus
const SHOW_DELAY_MS = 900;       // let the page (and the route loader overlay) settle first
const AFTER_PAYMENT_DELAY_MS = 3000;

/**
 * Mounted once in the public layout. For a signed-in customer it:
 *  • loads the notification summary, opens the SignalR connection and keeps it alive;
 *  • polls every 60 s while the socket is down, and refreshes when the window regains focus;
 *  • shows queued banners one at a time — but never on checkout / payment / sign-in screens or while the
 *    Razorpay popup is open; they wait and appear once the customer is somewhere else.
 */
export default function NotificationsProvider() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const live = useAppSelector((s) => s.notifications.live);
  const banners = useAppSelector((s) => s.notifications.banners);

  // ── connection lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { dispatch(resetNotifications()); return undefined; }
    dispatch(fetchNotificationSummary());
    const hub = connectNotifications({
      onNotification: (n) => dispatch(notificationReceived(n)),
      onEnded: (id) => id && dispatch(broadcastEnded(id)),
      onRemoved: (id) => id && dispatch(broadcastRemoved(id)),
      onState: (p) => dispatch(notificationStateSynced(p)),
      onLiveChange: (on, info) => {
        dispatch(setLive(on));
        if (on && info?.reconnected) dispatch(fetchNotificationSummary());   // catch up on anything missed
      },
    });
    return () => { hub.stop(); dispatch(setLive(false)); };
  }, [dispatch, isAuthenticated, userId]);

  // ── polling fallback while the socket is down ──────────────────────────
  useEffect(() => {
    if (!isAuthenticated || live) return undefined;
    const t = setInterval(() => dispatch(fetchNotificationSummary()), POLL_MS);
    return () => clearInterval(t);
  }, [dispatch, isAuthenticated, live]);

  // ── refresh when the tab comes back into view ──────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState === 'hidden' || Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      dispatch(fetchNotificationSummary());
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [dispatch, isAuthenticated]);

  // ── banner gating ───────────────────────────────────────────────────────
  const suppressed = isBannerSuppressedPath(pathname);
  const prevSuppressed = useRef(suppressed);
  const [ready, setReady] = useState(false);
  const hasBanner = isAuthenticated && banners.length > 0;

  useEffect(() => {
    const cameFromBlocked = prevSuppressed.current && !suppressed;
    prevSuppressed.current = suppressed;
    setReady(false);
    if (!hasBanner || suppressed) return undefined;
    let timer;
    const check = () => {
      if (isPaymentModalOpen()) { timer = setTimeout(check, 2000); return; }
      setReady(true);
    };
    timer = setTimeout(check, cameFromBlocked ? AFTER_PAYMENT_DELAY_MS : SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, suppressed, hasBanner]);

  const current = ready && hasBanner && !suppressed ? banners[0] : null;

  // lock page scroll while a banner is open
  useEffect(() => {
    if (!current) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [current]);

  const close = useCallback(() => { if (current) dispatch(dismissBanner(current.id)); }, [current, dispatch]);
  const act = useCallback((link) => {
    if (!current) return;
    dispatch(dismissBanner(current.id));
    if (link.internal) navigate(link.internal);
    else if (link.external) window.open(link.external, '_blank', 'noopener,noreferrer');
  }, [current, dispatch, navigate]);

  if (!current) return null;
  return <BroadcastBanner key={current.id} item={current} onClose={close} onAction={act} />;
}
