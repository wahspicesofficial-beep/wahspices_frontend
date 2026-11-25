// Every admin dropdown comes from the backend (GET /api/admin/lookups):
//   enums  — fixed values the backend logic depends on (statuses, leave types, …)
//   lists  — admin-editable master data (locations, units, categories, payment modes, …)
//   years / financialYears — computed server-side from today
// Loaded once per session and cached; call reloadLookups() after editing master data.
import { useEffect } from 'react';
import { create } from 'zustand';
import api from '@/services/api';

const useLookupStore = create((set, get) => ({
  data: null,
  loading: false,
  error: null,
  load: async (force = false) => {
    if (get().loading || (get().data && !force)) return;
    set({ loading: true, error: null });
    try {
      const res = await api.get('/admin/lookups');
      set({ data: res.data.data, loading: false });
    } catch (err) {
      set({ loading: false, error: err.response?.data?.error?.message || 'Could not load dropdown values' });
    }
  },
}));

export const reloadLookups = () => useLookupStore.getState().load(true);

const EMPTY = [];

/**
 * const lk = useLookups();
 *   lk.list('InventoryLocation')   → [{ value, label }]   (active master-data values)
 *   lk.enumList('LeaveType')       → [{ value, label, number }]
 *   lk.values('Unit')              → ['pcs', 'kg', …]
 *   lk.label('PaymentMode', 'UPI') → 'UPI'
 *   lk.years, lk.financialYears, lk.currentYear, lk.currentMonth
 */
export function useLookups() {
  const { data, loading, error, load } = useLookupStore();
  useEffect(() => { if (!data) load(); }, [data, load]);

  const list = (type) => data?.lists?.[type] || EMPTY;
  const enumList = (name) => data?.enums?.[name] || EMPTY;
  const now = new Date();

  return {
    ready: !!data,
    loading,
    error,
    list,
    enumList,
    values: (type) => list(type).map((o) => o.value),
    enumValues: (name) => enumList(name).map((o) => o.value),
    label: (type, value) => list(type).find((o) => o.value === value)?.label
      ?? enumList(type).find((o) => o.value === value)?.label
      ?? value,
    years: data?.years || [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1],
    financialYears: data?.financialYears || EMPTY,
    currentYear: data?.currentYear || now.getFullYear(),
    currentMonth: data?.currentMonth || now.getMonth() + 1,
    types: data?.types || EMPTY,
    /** HSN master (Admin → GST & Tax): [{ code, description, gstRate }] */
    hsnCodes: data?.hsnCodes || EMPTY,
    /** Most specific HSN master entry for a code ("09109100" → "0910"), or null. */
    resolveHsn: (code) => resolveHsn(data?.hsnCodes, code),
    reload: reloadLookups,
  };
}

/** Longest HSN master code that is a prefix of `code` — the same rule the server uses for GST. */
export function resolveHsn(master, code) {
  const c = String(code || '').replace(/\D/g, '');
  if (!master?.length || c.length < 2) return null;
  let best = null;
  for (const h of master) if (h.code && c.startsWith(h.code) && (!best || h.code.length > best.code.length)) best = h;
  return best;
}

/** <option> elements for a lookup list, keeping an unknown current value selectable. */
export function lookupOptions(items, current) {
  const opts = items.map((o) => ({ value: o.value, label: o.label ?? o.value }));
  if (current != null && current !== '' && !opts.some((o) => String(o.value) === String(current))) {
    opts.unshift({ value: current, label: String(current) });
  }
  return opts;
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
