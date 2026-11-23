// Company finance & compliance — pure helpers (formatting, API, payer/split state).
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';

export const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const isoDay = (d) => (d ? String(d).substring(0, 10) : '');
export const today = () => new Date().toLocaleDateString('en-CA');
export const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA'); };
export const fyStart = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };
export const errMsg = (err, fallback = 'Something went wrong') => err?.response?.data?.error?.message || fallback;

/** GET helper returning `data` of the API envelope. */
export async function apiGet(url, params) {
  const res = await api.get(url, { params });
  return res.data.data;
}

/** Download a file endpoint (blob) and save it with the server's filename. */
export async function downloadFile(url, fallbackName, params) {
  try {
    const res = await api.get(url, { params, responseType: 'blob', timeout: 60000 });
    const cd = res.headers?.['content-disposition'] || '';
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1] || m[2]) : fallbackName;
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = href; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (err) {
    const d = err.response?.data;
    let msg = 'Download failed';
    if (d instanceof Blob) { try { msg = JSON.parse(await d.text())?.error?.message || msg; } catch { /* not JSON */ } }
    toast.error(msg);
  }
}

/** Open an attachment in a new tab (fetched with the admin token). */
export async function openFile(kind, id) {
  try {
    const res = await api.get(`/admin/company/files/${kind}/${id}`, { responseType: 'blob', timeout: 60000 });
    const href = URL.createObjectURL(res.data);
    window.open(href, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } catch { toast.error('Could not open the file'); }
}

export async function uploadFile(kind, id, file) {
  const fd = new FormData();
  fd.append('file', file);
  await api.post(`/admin/company/files/${kind}/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
}

export const ALLOWED_FILE = '.pdf,.jpg,.jpeg,.png,.webp';
export function checkFile(file) {
  if (!file) return null;
  if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) return 'Only PDF, JPG, PNG or WEBP files are allowed.';
  if (file.size > 10 * 1024 * 1024) return 'File must be 10 MB or smaller.';
  return null;
}

/** Partners list (+ share check) with reload. */
export function usePartners() {
  const [state, setState] = useState({ partners: [], shareTotal: 0, shareWarning: null, loading: true });
  const load = useCallback(async () => {
    try {
      const d = await apiGet('/admin/company/partners');
      setState({ ...d, loading: false });
    } catch (err) { setState((s) => ({ ...s, loading: false })); toast.error(errMsg(err, 'Could not load partners')); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export const ASSET_STATUS = [
  { value: 'InUse', label: 'In use', tone: 'success' },
  { value: 'UnderRepair', label: 'Under repair', tone: 'warning' },
  { value: 'Disposed', label: 'Disposed', tone: 'neutral' },
  { value: 'Lost', label: 'Lost', tone: 'danger' },
];
export const assetStatus = (v) => ASSET_STATUS.find((s) => s.value === v) || { label: v, tone: 'neutral' };

export const LICENCE_STATUS = {
  Active: { label: 'Active', tone: 'success' },
  Lifetime: { label: 'Lifetime', tone: 'info' },
  ExpiringSoon: { label: 'Expiring soon', tone: 'warning' },
  Expired: { label: 'Expired', tone: 'danger' },
  Renewed: { label: 'Renewed', tone: 'neutral' },
};

export function daysText(days) {
  if (days == null) return 'No expiry';
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}
export const daysTone = (days) => (days == null ? 'neutral' : days <= 0 ? 'danger' : days <= 7 ? 'warning' : days <= 30 ? 'accent' : 'success');

export const SPLIT_METHODS = [
  { value: 'Share', label: 'By share %' },
  { value: 'Equal', label: 'Equal' },
  { value: 'Custom', label: 'Custom' },
  { value: 'None', label: 'Company — no split' },
];
export const splitLabel = (v) => SPLIT_METHODS.find((m) => m.value === v)?.label || v;

/** Empty payer + split state. */
export const emptyPayment = (paidBy = '') => ({ payerType: 'Company', paidBy, paidByPartnerId: '', splitMethod: 'None', customMode: 'Amount', custom: {} });

/** From an expense returned by the API → form state. */
export function paymentFromExpense(e, fallbackPaidBy = '') {
  if (!e) return emptyPayment(fallbackPaidBy);
  const custom = {};
  (e.splits || []).forEach((s) => { custom[s.partnerId ?? ''] = { amount: String(s.amount), percent: String(s.percent) }; });
  return {
    payerType: e.payerType || 'Company',
    paidBy: e.payerType === 'Partner' ? fallbackPaidBy : (e.paidBy || fallbackPaidBy),
    paidByPartnerId: e.paidByPartnerId ? String(e.paidByPartnerId) : '',
    splitMethod: e.splitMethod || 'None',
    customMode: 'Amount',
    custom,
  };
}

/** Form state → API body fields. */
export function paymentToApi(p) {
  const splits = p.splitMethod === 'Custom'
    ? Object.entries(p.custom || {}).map(([k, v]) => ({
      partnerId: k === '' ? null : Number(k),
      amount: p.customMode === 'Amount' ? Number(v.amount || 0) : null,
      percent: p.customMode === 'Percent' ? Number(v.percent || 0) : null,
    })).filter((s) => (s.amount || 0) !== 0 || (s.percent || 0) !== 0)
    : null;
  return {
    payerType: p.payerType,
    paidBy: p.payerType === 'Company' ? p.paidBy : null,
    paidByPartnerId: p.payerType === 'Partner' && p.paidByPartnerId ? Number(p.paidByPartnerId) : null,
    splitMethod: p.splitMethod,
    customMode: p.customMode,
    splits,
  };
}

/** Client-side preview of the split (the server recomputes and validates). */
export function previewSplit(amount, p, partners) {
  const amt = Number(amount) || 0;
  const active = partners.filter((x) => x.isActive);
  const round = (n) => Math.round(n * 100) / 100;
  let rows = [];
  if (p.splitMethod === 'None') rows = [{ id: null, name: 'Company', pct: 100 }];
  else if (p.splitMethod === 'Equal') rows = active.map((x) => ({ id: x.id, name: x.name, pct: 100 / (active.length || 1) }));
  else if (p.splitMethod === 'Share') {
    const tot = active.reduce((s, x) => s + Number(x.sharePercent || 0), 0) || 1;
    rows = active.filter((x) => Number(x.sharePercent) > 0).map((x) => ({ id: x.id, name: x.name, pct: (Number(x.sharePercent) * 100) / tot }));
  } else {
    const names = { '': 'Company', ...Object.fromEntries(partners.map((x) => [String(x.id), x.name])) };
    rows = Object.entries(p.custom || {}).map(([k, v]) => {
      const a = Number(v.amount || 0); const pc = Number(v.percent || 0);
      return p.customMode === 'Amount'
        ? { id: k, name: names[k] || k, pct: amt ? (a * 100) / amt : 0, fixed: a }
        : { id: k, name: names[k] || k, pct: pc };
    }).filter((r) => r.pct || r.fixed);
  }
  const out = rows.map((r) => ({ ...r, amount: r.fixed ?? round((amt * r.pct) / 100) }));
  const sum = round(out.reduce((s, r) => s + r.amount, 0));
  return { rows: out, sum, diff: round(amt - sum) };
}

