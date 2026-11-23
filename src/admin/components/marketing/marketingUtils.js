// Non-component helpers for Admin → Marketing pages.
import { useEffect, useState } from 'react';

export const errMsg = (err, fallback) => err?.response?.data?.error?.message || fallback;
export const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

/** <input type="datetime-local"> value ↔ ISO (UTC) */
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Site path or https URL — mirrors MarketingRules.CheckLink on the server. */
export function linkError(url) {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/\\') && !/\s/.test(u)) return '';
  try {
    const p = new URL(u);
    if (p.protocol === 'https:' && p.hostname && !p.username && !/\s/.test(u)) return '';
  } catch { /* invalid */ }
  return 'Use a site path like /products or a full https:// link.';
}
