/**
 * URL guards for anything admin-editable or API-provided that ends up in href / src / iframe.
 * React 18 still renders `javascript:` URLs (it only warns), so every link that comes from
 * site content, settings, social links, courier tracking URLs, etc. goes through safeHref().
 */

const SAFE_SCHEMES = /^(https?:|mailto:|tel:)/i;

/**
 * Returns the URL if it is a relative site path ("/x", "#x", "?x") or an http(s)/mailto/tel URL,
 * otherwise `fallback`. Strips control chars/whitespace browsers ignore (e.g. "java\tscript:").
 */
export function safeHref(url, fallback = '#') {
  if (url === null || url === undefined) return fallback;
  // eslint-disable-next-line no-control-regex
  const s = String(url).replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (!s) return fallback;
  if (s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\')) return String(url).trim();
  if (s.startsWith('#') || s.startsWith('?')) return String(url).trim();
  if (SAFE_SCHEMES.test(s)) return String(url).trim();
  // Bare domains like "instagram.com/wahspices" → https://
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(s)) return `https://${String(url).trim()}`;
  return fallback;
}

/** Hosts allowed inside <iframe> (Contact page map embed). Keep in sync with frame-src in index.html CSP. */
const EMBED_HOSTS = ['www.google.com', 'maps.google.com', 'google.com'];

/** Returns an https URL on an allowed embed host, else '' (caller should hide the iframe). */
export function safeEmbedUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (u.protocol !== 'https:') return '';
    if (!EMBED_HOSTS.includes(u.hostname)) return '';
    return u.toString();
  } catch {
    return '';
  }
}
