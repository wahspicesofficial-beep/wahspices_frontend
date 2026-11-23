// Regional Flavours: API helpers + small formatting utilities shared by the home carousel,
// the /regions pages and the admin editor.
import api from '@/services/api';
import { getImageUrl } from '@/utils/product';

/** Published regions (summary). home=true → only "show on home" ones. */
export async function fetchRegions({ home } = {}) {
  const res = await api.get('/regions', { params: home ? { home: true } : undefined });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

/** One region with sections, products and the other regions. previewId → admin preview (drafts too). */
export async function fetchRegion(slug, { previewId } = {}) {
  const url = previewId ? `/admin/regions/${encodeURIComponent(previewId)}/preview` : `/regions/${encodeURIComponent(slug)}`;
  const res = await api.get(url);
  return res.data?.data || null;
}

/** Accent colours are validated server-side; never trust them into style strings unchecked. */
export const safeColor = (c, fallback = '#1a5c2e') => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : fallback);

/** Image URL for display: site paths stay as they are, /uploads/… gets the API origin. */
export const regionImage = (url) => getImageUrl(url) || null;

/** The ~800px thumbnail shipped next to seeded photos (…-sm.jpg); other images are used as they are. */
export function regionThumb(url) {
  if (!url) return null;
  if (/^\/images\/(regions|hero)\/[\w/.-]+\.jpg$/i.test(url) && !/-sm\.jpg$/i.test(url)) return url.replace(/\.jpg$/i, '-sm.jpg');
  return regionImage(url);
}

/** Plain-text story body → paragraphs (blank lines separate paragraphs; single newlines are kept as line breaks). */
export const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Mix a hex colour with white (amount 0..1 of white) — for soft tints of the accent colour. */
export function tint(hex, amount) {
  const c = safeColor(hex).slice(1);
  const n = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  const m = n.map((v) => Math.round(v + (255 - v) * amount));
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
