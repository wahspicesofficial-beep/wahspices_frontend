import { safeHref } from '@/utils/safeUrl';
import { getImageUrl } from '@/utils/product';

/**
 * Screens where a broadcast banner must NOT pop up (it waits until the customer navigates elsewhere):
 * checkout + any payment / order-status flow (the Razorpay modal is opened from /checkout), and the
 * sign-in / sign-up / password / OTP / unsubscribe screens.
 */
const SUPPRESSED = /^\/(checkout|payment|payments|payment-status|order-success|order-confirmation|order-status|login|register|otp|reset-password|forgot-password|unsubscribe)(\/|$)/i;

export const isBannerSuppressedPath = (pathname = '') => SUPPRESSED.test(pathname);

/** True while the Razorpay payment popup is on screen (it can only be opened from checkout, but be safe). */
export function isPaymentModalOpen() {
  if (typeof document === 'undefined') return false;
  const els = document.querySelectorAll('.razorpay-container, .razorpay-checkout-frame, iframe[src*="razorpay"]');
  for (const el of els) {
    const style = window.getComputedStyle(el);
    if (style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0) return true;
  }
  return false;
}

/** Where a notification button points: { internal: '/products' } or { external: 'https://…' } or null. */
export function resolveLink(url) {
  if (!url) return null;
  const href = safeHref(url, '');
  if (!href) return null;
  if (href.startsWith('/')) return { internal: href };
  if (/^https:\/\//i.test(href)) return { external: href };
  return null;
}

export const imageSrc = (url) => (url ? getImageUrl(url) : '');

const TYPE_STYLES = {
  offer: 'bg-brand-orange/15 text-[#9a5b00]',
  newproduct: 'bg-brand-green/10 text-brand-green',
  sale: 'bg-red-50 text-brand-red',
  announcement: 'bg-sky-50 text-sky-700',
};
export const typeChipClass = (type) => TYPE_STYLES[String(type || '').toLowerCase()] || 'bg-gray-100 text-gray-600';

export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
