// Raw material → packing (repacking).
//   Raw materials: bulk stock in kg (bought via Purchase → GRN, or opening stock / adjustments).
//   Packing entry: X kg of one raw material packed into packets of one or more pack sizes →
//     raw stock − X kg, finished stock of each product variant + packets (what the website's in-stock uses).
//   Reverse: restores both sides (refused if the packets were already sold).
// Backend: /api/admin/packing/* (AdminPackingController). Calls the api instance directly.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Wheat, PackageCheck, BookOpen, Plus, RefreshCw, Edit2, Trash2, SlidersHorizontal, Undo2, Eye,
  AlertTriangle, Scale, Boxes, X,
} from 'lucide-react';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, SearchInput, Toolbar,
  EmptyState, Skeleton, usePagination, Pagination, DialogPanel, Field,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';
import api from '@/services/api';

const BASE = '/admin/packing';
const inp = 'input-field w-full';
const cellInp = 'h-8 w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-2 text-[13px]';
const muted = 'text-[color:var(--text-muted)]';

const TABS = [
  { value: 'raw',     label: 'Raw materials',   icon: Wheat },
  { value: 'entries', label: 'Packing entries', icon: PackageCheck },
  { value: 'ledger',  label: 'Raw ledger',      icon: BookOpen },
];

const RAW_TYPES = ['Opening', 'Purchase', 'Adjustment', 'Damage', 'PackingConsumption', 'PackingReversal'];
const TYPE_LABEL = { PackingConsumption: 'Packing (used)', PackingReversal: 'Packing reversed', Opening: 'Opening stock' };

const errOf = (e, fallback = 'Something went wrong') => e?.response?.data?.error?.message || e?.response?.data?.message || fallback;
const errCode = e => e?.response?.data?.error?.code;
const num = v => (v === '' || v == null ? null : Number(v));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
const fmtDateTime = d => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const fmtMoney = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
/** 0.25 → "250 g", 12.5 → "12.5 kg" (unit 'g' forces grams) */
const fmtKg = (kg, unit) => {
  const v = Number(kg || 0);
  if (unit === 'g' || (Math.abs(v) < 1 && v !== 0)) return `${(v * 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} g`;
  return `${v.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`;
};
const toKg = (q, unit) => (unit === 'g' ? Number(q || 0) / 1000 : Number(q || 0));

const Modal = ({ title, onClose, children, footer, width = 'max-w-lg' }) => (
  <AdminModal onClose={onClose}>
    <DialogPanel title={title} onClose={onClose} footer={footer} width={width}>
      <div className="space-y-3">{children}</div>
    </DialogPanel>
  </AdminModal>
);

const UnitSelect = ({ value, onChange }) => (
  <select className={`${inp} !w-20`} value={value} onChange={onChange} aria-label="Unit">
    <option value="kg">kg</option>
    <option value="g">g</option>
  </select>
);

function Grid({ list, noun, icon, emptyTitle, emptyHint, head, row, loading }) {
  const pg = usePagination(list, 20);
  if (loading && list.length === 0) {
    return <Card bodyClassName="p-3 space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="block h-7 w-full" />)}</Card>;
  }
  return (
    <Card bodyClassName="p-3">
      {list.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle}>{emptyHint}</EmptyState>
      ) : (
        <>
          <div className="grid-box overflow-x-auto">
            <table>
              <thead><tr>{head}</tr></thead>
              <tbody>{pg.items.map(row)}</tbody>
            </table>
          </div>
          <Pagination {...pg} noun={noun} />
        </>
      )}
    </Card>
  );
}

const emptyRaw = {
  name: '', code: '', category: '', displayUnit: 'kg', openingStock: '', openingUnit: 'kg',
  reorderLevel: '', reorderUnit: 'kg', costPerKg: '', hsnCode: '', location: '', defaultProductId: '', notes: '', batchNumber: '', isActive: true,
};
const emptyAdjust = { direction: 'in', type: 'Adjustment', quantity: '', unit: 'kg', reason: '', batchNumber: '', costPerKg: '' };
const emptyLine = { productId: '', variantId: '', packWeightGrams: '', packets: '' };
const emptyPack = {
  rawMaterialId: '', rawQuantityUsed: '', rawUnit: 'kg', wastage: '', wastageUnit: 'kg',
  packedOn: today(), batchNumber: '', packedBy: '', notes: '',
};

export default function AdminPacking() {
  const lk = useLookups();
  const locations = lk.list('InventoryLocation');

  const [tab, setTab] = useState('raw');
  const [summary, setSummary] = useState(null);
  const [raws, setRaws] = useState([]);
  const [entries, setEntries] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [ledgerRaw, setLedgerRaw] = useState('');
  const [ledgerType, setLedgerType] = useState('');

  const [modal, setModal] = useState(null);       // raw | adjust | pack | entry | reverse
  const [target, setTarget] = useState(null);
  const [rawForm, setRawForm] = useState(emptyRaw);
  const [adjForm, setAdjForm] = useState(emptyAdjust);
  const [packForm, setPackForm] = useState(emptyPack);
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [mismatch, setMismatch] = useState(null);   // server QUANTITY_MISMATCH details
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(() => api.get(`${BASE}/summary`).then(r => setSummary(r.data.data)).catch(() => {}), []);
  const loadRaws = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`${BASE}/raw-materials`, { params: { includeInactive: true } });
      setRaws(r.data.data || []);
    } catch (e) { toast.error(errOf(e, 'Could not load raw materials')); }
    setLoading(false);
  }, []);
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`${BASE}/entries`, { params: { limit: 500, status: statusFilter || undefined } });
      setEntries(r.data.data?.items || []);
    } catch (e) { toast.error(errOf(e, 'Could not load packing entries')); }
    setLoading(false);
  }, [statusFilter]);
  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`${BASE}/raw-ledger`, { params: { limit: 500, rawMaterialId: ledgerRaw || undefined, type: ledgerType || undefined } });
      setLedger(r.data.data?.items || []);
    } catch (e) { toast.error(errOf(e, 'Could not load the ledger')); }
    setLoading(false);
  }, [ledgerRaw, ledgerType]);
  const loadProducts = useCallback(() => api.get(`${BASE}/products`).then(r => setProducts(r.data.data || [])).catch(() => {}), []);

  useEffect(() => { loadSummary(); loadRaws(); loadProducts(); }, [loadSummary, loadRaws, loadProducts]);
  useEffect(() => { if (tab === 'entries') loadEntries(); }, [tab, loadEntries]);
  useEffect(() => { if (tab === 'ledger') loadLedger(); }, [tab, loadLedger]);

  const refreshAll = () => {
    loadSummary(); loadRaws(); loadProducts();
    if (tab === 'entries') loadEntries();
    if (tab === 'ledger') loadLedger();
  };

  const closeModal = () => {
    setModal(null); setTarget(null); setMismatch(null); setConfirmMismatch(false); setDetail(null); setReverseReason('');
  };

  // ── Raw material create / edit ──
  const openRaw = (rm) => {
    setTarget(rm || null);
    setRawForm(rm ? {
      ...emptyRaw, name: rm.name, code: rm.code, category: rm.category || '', displayUnit: rm.displayUnit || 'kg',
      reorderLevel: rm.displayUnit === 'g' ? Number(rm.reorderLevelKg) * 1000 : rm.reorderLevelKg, reorderUnit: rm.displayUnit === 'g' ? 'g' : 'kg',
      costPerKg: rm.costPerKg, hsnCode: rm.hsnCode || '', location: rm.location || '', defaultProductId: rm.defaultProductId || '',
      notes: rm.notes || '', isActive: rm.isActive,
    } : { ...emptyRaw, location: locations[0]?.value || '' });
    setModal('raw');
  };
  const saveRaw = async () => {
    if (!rawForm.name.trim()) return toast.error('Name is required');
    if (Number(rawForm.openingStock || 0) < 0 || Number(rawForm.reorderLevel || 0) < 0 || Number(rawForm.costPerKg || 0) < 0)
      return toast.error('Quantities and cost cannot be negative');
    const body = {
      name: rawForm.name.trim(), code: rawForm.code.trim() || null, category: rawForm.category || null, displayUnit: rawForm.displayUnit,
      reorderLevel: num(rawForm.reorderLevel) ?? 0, reorderUnit: rawForm.reorderUnit, costPerKg: num(rawForm.costPerKg),
      hsnCode: rawForm.hsnCode || null, location: rawForm.location || null,
      defaultProductId: rawForm.defaultProductId ? Number(rawForm.defaultProductId) : null, notes: rawForm.notes || null,
      isActive: rawForm.isActive,
      ...(target ? {} : { openingStock: num(rawForm.openingStock) ?? 0, openingUnit: rawForm.openingUnit, batchNumber: rawForm.batchNumber || null }),
    };
    setSaving(true);
    try {
      const r = target ? await api.put(`${BASE}/raw-materials/${target.id}`, body) : await api.post(`${BASE}/raw-materials`, body);
      toast.success(r.data.message || 'Saved');
      closeModal(); loadRaws(); loadSummary();
    } catch (e) { toast.error(errOf(e, 'Could not save')); }
    setSaving(false);
  };
  const removeRaw = async (rm) => {
    if (!window.confirm(`Remove ${rm.name}? (Only possible when its stock is zero. History is kept.)`)) return;
    try {
      const r = await api.delete(`${BASE}/raw-materials/${rm.id}`);
      toast.success(r.data.message || 'Removed'); loadRaws(); loadSummary();
    } catch (e) { toast.error(errOf(e, 'Could not remove')); }
  };

  // ── Raw stock adjustment ──
  const openAdjust = (rm) => { setTarget(rm); setAdjForm({ ...emptyAdjust, unit: rm.displayUnit === 'g' ? 'g' : 'kg' }); setModal('adjust'); };
  const saveAdjust = async () => {
    if (!(Number(adjForm.quantity) > 0)) return toast.error('Enter a quantity');
    if (!adjForm.reason.trim()) return toast.error('Give a reason');
    setSaving(true);
    try {
      const r = await api.post(`${BASE}/raw-materials/${target.id}/adjust`, {
        direction: adjForm.type === 'Damage' ? 'out' : adjForm.direction, type: adjForm.type,
        quantity: Number(adjForm.quantity), unit: adjForm.unit, reason: adjForm.reason.trim(),
        batchNumber: adjForm.batchNumber || null, costPerKg: num(adjForm.costPerKg),
      });
      toast.success(`${target.name}: now ${fmtKg(r.data.data.currentStockKg)}`);
      closeModal(); loadRaws(); loadSummary();
      if (tab === 'ledger') loadLedger();
    } catch (e) { toast.error(errOf(e, 'Could not adjust')); }
    setSaving(false);
  };

  // ── Packing ──
  const productById = useMemo(() => Object.fromEntries(products.map(p => [String(p.id), p])), [products]);
  const rawById = useMemo(() => Object.fromEntries(raws.map(r => [String(r.id), r])), [raws]);

  const openPack = (rm) => {
    const raw = rm || raws.find(r => r.isActive && r.currentStockKg > 0);
    setPackForm({ ...emptyPack, rawMaterialId: raw ? String(raw.id) : '', rawUnit: raw?.displayUnit === 'g' ? 'g' : 'kg', wastageUnit: raw?.displayUnit === 'g' ? 'g' : 'kg' });
    setLines([{ ...emptyLine, productId: raw?.defaultProductId ? String(raw.defaultProductId) : '' }]);
    setMismatch(null); setConfirmMismatch(false);
    setModal('pack');
  };
  const setLine = (i, patch) => { setLines(p => p.map((l, j) => (j === i ? { ...l, ...patch } : l))); setMismatch(null); setConfirmMismatch(false); };
  const lineGrams = (l) => {
    const p = productById[l.productId];
    if (!p) return 0;
    if (p.variants.length > 0) return p.variants.find(v => String(v.id) === String(l.variantId))?.weightGrams || 0;
    return Number(l.packWeightGrams || 0);
  };
  const calc = useMemo(() => {
    const packedKg = lines.reduce((s, l) => s + (Number(l.packets || 0) * lineGrams(l)) / 1000, 0);
    const wastageKg = toKg(packForm.wastage, packForm.wastageUnit);
    const usedKg = packForm.rawQuantityUsed === '' ? packedKg + wastageKg : toKg(packForm.rawQuantityUsed, packForm.rawUnit);
    const variance = usedKg - packedKg - wastageKg;
    const tolerance = Math.max(0.01, usedKg * 0.005);
    const raw = rawById[packForm.rawMaterialId];
    return {
      packedKg, wastageKg, usedKg, variance, tolerance,
      packets: lines.reduce((s, l) => s + Number(l.packets || 0), 0),
      stock: raw?.currentStockKg ?? 0, after: (raw?.currentStockKg ?? 0) - usedKg, raw,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, packForm, productById, rawById]);

  const savePack = async () => {
    if (!packForm.rawMaterialId) return toast.error('Choose the raw material');
    const valid = lines.filter(l => l.productId && Number(l.packets) > 0);
    if (valid.length === 0) return toast.error('Add at least one pack size with the number of packets');
    if (valid.some(l => !Number.isInteger(Number(l.packets)))) return toast.error('Packets must be whole numbers');
    for (const l of valid) {
      const p = productById[l.productId];
      if (p.variants.length > 0 && !l.variantId) return toast.error(`Choose the pack size of ${p.name}`);
      if (p.variants.length === 0 && !(Number(l.packWeightGrams) > 0)) return toast.error(`Enter the pack weight (g) for ${p.name}`);
    }
    if (calc.usedKg > calc.stock) return toast.error(`Only ${fmtKg(calc.stock)} in stock — this needs ${fmtKg(calc.usedKg)}`);
    setSaving(true);
    try {
      const r = await api.post(`${BASE}/entries`, {
        rawMaterialId: Number(packForm.rawMaterialId),
        rawQuantityUsed: num(packForm.rawQuantityUsed), rawUnit: packForm.rawUnit,
        wastage: num(packForm.wastage), wastageUnit: packForm.wastageUnit,
        lines: valid.map(l => ({
          productId: Number(l.productId), variantId: l.variantId ? Number(l.variantId) : null,
          packWeightGrams: l.packWeightGrams ? Number(l.packWeightGrams) : null, packets: Number(l.packets),
        })),
        packedOn: packForm.packedOn || null, batchNumber: packForm.batchNumber || null,
        packedBy: packForm.packedBy || null, notes: packForm.notes || null, confirmMismatch,
      });
      toast.success(r.data.message || 'Packing saved');
      (r.data.data?.warnings || []).forEach(w => toast(w, { icon: '⚠️' }));
      closeModal(); refreshAll();
    } catch (e) {
      if (errCode(e) === 'QUANTITY_MISMATCH') {
        setMismatch({ message: errOf(e), ...(e.response.data.data || {}) });
      } else toast.error(errOf(e, 'Could not save the packing entry'));
    }
    setSaving(false);
  };

  // ── Entry detail / reverse ──
  const openEntry = async (en) => {
    setTarget(en); setDetail(null); setModal('entry');
    try { const r = await api.get(`${BASE}/entries/${en.id}`); setDetail(r.data.data); }
    catch (e) { toast.error(errOf(e, 'Could not load the entry')); }
  };
  const doReverse = async () => {
    if (!reverseReason.trim()) return toast.error('Give a reason');
    setSaving(true);
    try {
      const r = await api.post(`${BASE}/entries/${target.id}/reverse`, { reason: reverseReason.trim() });
      toast.success(r.data.message || 'Reversed');
      closeModal(); refreshAll();
    } catch (e) { toast.error(errOf(e, 'Could not reverse')); }
    setSaving(false);
  };

  // ── Filters ──
  const q = search.trim().toLowerCase();
  const rawList = raws.filter(r => (showInactive || r.isActive) && (!lowOnly || r.isLowStock)
    && (!q || [r.name, r.code, r.category].some(x => x?.toLowerCase().includes(q))));
  const entryList = entries.filter(e => !q || [e.packingNumber, e.rawMaterialName, e.batchNumber, e.packedBy, ...e.lines.map(l => l.productName)]
    .some(x => x?.toLowerCase().includes(q)));
  const ledgerList = ledger.filter(l => !q || [l.rawMaterialName, l.referenceId, l.reason, l.performedBy].some(x => x?.toLowerCase().includes(q)));

  const lowList = raws.filter(r => r.isActive && r.isLowStock);
  const footer = (onSave, label = 'Save', variant) => (
    <>
      <Button variant="secondary" onClick={closeModal}>Cancel</Button>
      <Button variant={variant} onClick={onSave} disabled={saving}>{saving ? 'Saving…' : label}</Button>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Raw material & packing"
        description="Bulk raw stock (kg) → packed into retail packets. Packing deducts raw stock and adds finished packets to the product's pack size."
        actions={(
          <>
            <Button variant="secondary" onClick={refreshAll}><RefreshCw className="size-4" />Refresh</Button>
            <Button variant="secondary" onClick={() => openRaw(null)}><Plus className="size-4" />Raw material</Button>
            <Button onClick={() => openPack(null)} disabled={raws.length === 0}><PackageCheck className="size-4" />New packing</Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Raw materials" value={summary?.rawMaterials ?? '—'} icon={Wheat} loading={!summary} />
        <Stat label="Raw stock" value={summary ? fmtKg(summary.rawStockKg) : '—'} hint={summary ? fmtMoney(summary.rawStockValue) : ''} icon={Scale} loading={!summary} />
        <Stat label="Low raw stock" value={summary?.lowStock ?? '—'} tone={summary?.lowStock ? 'danger' : 'neutral'} icon={AlertTriangle} loading={!summary} />
        <Stat label="Packed this month" value={summary ? fmtKg(summary.month.packedKg) : '—'} hint={summary ? `${summary.month.packets} packets · ${summary.month.entries} entries` : ''} tone="success" icon={Boxes} loading={!summary} />
        <Stat label="Loss this month" value={summary ? fmtKg(summary.month.wastageKg) : '—'} hint="wastage + unexplained" tone="warning" icon={Trash2} loading={!summary} />
      </div>

      {lowList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[color:var(--danger)] bg-[color:var(--danger-bg)] px-3 py-2 text-[13px] text-[color:var(--danger)]">
          <AlertTriangle className="size-4" />
          <b>Low raw stock:</b>
          {lowList.map(r => <span key={r.id}>{r.name} ({fmtKg(r.currentStockKg, r.displayUnit)} / reorder {fmtKg(r.reorderLevelKg, r.displayUnit)})</span>)}
        </div>
      )}

      <Tabs items={TABS.map(t => ({ ...t, count: t.value === 'raw' ? raws.filter(r => r.isActive).length : undefined }))} value={tab} onChange={setTab} />

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder={tab === 'raw' ? 'Search raw materials…' : tab === 'entries' ? 'Search packing no, batch, product…' : 'Search ledger…'} className="w-72" />
        {tab === 'raw' && (
          <>
            <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />Low stock only</label>
            <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Show inactive</label>
          </>
        )}
        {tab === 'entries' && (
          <select className={`${inp} !w-40`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Completed">Completed</option>
            <option value="Reversed">Reversed</option>
          </select>
        )}
        {tab === 'ledger' && (
          <>
            <select className={`${inp} !w-52`} value={ledgerRaw} onChange={e => setLedgerRaw(e.target.value)}>
              <option value="">All raw materials</option>
              {raws.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className={`${inp} !w-44`} value={ledgerType} onChange={e => setLedgerType(e.target.value)}>
              <option value="">All movements</option>
              {RAW_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}
            </select>
          </>
        )}
      </Toolbar>

      {tab === 'raw' && (
        <Grid
          list={rawList} noun="raw materials" icon={Wheat} loading={loading}
          emptyTitle="No raw materials yet" emptyHint="Add the bulk materials you buy (e.g. Jeera 500 kg). Purchases received through GRN add to this stock."
          head={<>
            <th className="text-left">Raw material</th><th className="text-left">Category</th>
            <th className="text-right">In stock</th><th className="text-right">Reorder at</th>
            <th className="text-right">Cost / kg</th><th className="text-right">Value</th>
            <th className="text-left">Packs into</th><th className="text-left">Last packed</th><th />
          </>}
          row={r => (
            <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
              <td>
                <div className="font-bold">{r.name}</div>
                <div className={`text-[12px] ${muted}`}>{r.code} · {r.location}{!r.isActive && ' · inactive'}</div>
              </td>
              <td>{r.category || '—'}</td>
              <td className="text-right tabular-nums">
                <span className={r.isLowStock ? 'font-bold text-[color:var(--danger)]' : 'font-bold'}>{fmtKg(r.currentStockKg, r.displayUnit)}</span>
                {r.isLowStock && <div><Badge tone={r.currentStockKg <= 0 ? 'danger' : 'warning'}>{r.currentStockKg <= 0 ? 'Out of stock' : 'Low'}</Badge></div>}
              </td>
              <td className="text-right tabular-nums">{fmtKg(r.reorderLevelKg, r.displayUnit)}</td>
              <td className="text-right tabular-nums">{fmtMoney(r.costPerKg)}</td>
              <td className="text-right tabular-nums">{fmtMoney(r.stockValue)}</td>
              <td>{r.defaultProductName || '—'}</td>
              <td>{fmtDate(r.lastPackedOn)}</td>
              <td className="whitespace-nowrap text-right">
                <Button size="sm" variant="tertiary" onClick={() => openPack(r)} disabled={!r.isActive || r.currentStockKg <= 0}><PackageCheck className="size-3.5" />Pack</Button>
                <IconButton label="Adjust stock" onClick={() => openAdjust(r)}><SlidersHorizontal className="size-3.5" /></IconButton>
                <IconButton label="Ledger" onClick={() => { setLedgerRaw(String(r.id)); setTab('ledger'); }}><BookOpen className="size-3.5" /></IconButton>
                <IconButton label="Edit" onClick={() => openRaw(r)}><Edit2 className="size-3.5" /></IconButton>
                <IconButton label="Remove" tone="danger" onClick={() => removeRaw(r)}><Trash2 className="size-3.5" /></IconButton>
              </td>
            </tr>
          )}
        />
      )}

      {tab === 'entries' && (
        <Grid
          list={entryList} noun="entries" icon={PackageCheck} loading={loading}
          emptyTitle="No packing entries yet" emptyHint="Record each packing run: raw material used and the packets produced per pack size."
          head={<>
            <th className="text-left">Packing no</th><th className="text-left">Date</th><th className="text-left">Raw material</th>
            <th className="text-right">Used</th><th className="text-left">Packets</th><th className="text-right">Loss</th>
            <th className="text-left">Batch</th><th className="text-left">Packed by</th><th className="text-left">Status</th><th />
          </>}
          row={e => (
            <tr key={e.id} className={e.status === 'Reversed' ? 'opacity-60' : ''}>
              <td className="font-bold">{e.packingNumber}</td>
              <td>{fmtDate(e.packedOn)}</td>
              <td>{e.rawMaterialName}</td>
              <td className="text-right tabular-nums">{fmtKg(e.rawUsedKg)}</td>
              <td className="text-[12px]">{e.lines.map(l => <div key={l.id}>{l.packets} × {l.productName} {l.packLabel}</div>)}</td>
              <td className="text-right tabular-nums">{fmtKg(Number(e.wastageKg) + Math.max(0, Number(e.varianceKg)))}</td>
              <td>{e.batchNumber || '—'}</td>
              <td>{e.packedBy || '—'}</td>
              <td><Badge tone={e.status === 'Reversed' ? 'danger' : 'success'}>{e.status}</Badge></td>
              <td className="whitespace-nowrap text-right">
                <IconButton label="View" onClick={() => openEntry(e)}><Eye className="size-3.5" /></IconButton>
                {e.status === 'Completed' && (
                  <IconButton label="Reverse" tone="danger" onClick={() => { setTarget(e); setReverseReason(''); setModal('reverse'); }}><Undo2 className="size-3.5" /></IconButton>
                )}
              </td>
            </tr>
          )}
        />
      )}

      {tab === 'ledger' && (
        <Grid
          list={ledgerList} noun="movements" icon={BookOpen} loading={loading}
          emptyTitle="No raw stock movements" emptyHint="Opening stock, purchases (GRN), adjustments and packing appear here."
          head={<>
            <th className="text-left">When</th><th className="text-left">Raw material</th><th className="text-left">Movement</th>
            <th className="text-right">Qty</th><th className="text-right">Balance</th><th className="text-left">Reference</th>
            <th className="text-left">Details</th><th className="text-left">By</th>
          </>}
          row={l => (
            <tr key={l.id}>
              <td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
              <td>{l.rawMaterialName}</td>
              <td><Badge tone={l.quantityKg >= 0 ? 'success' : 'warning'}>{TYPE_LABEL[l.type] || l.type}</Badge></td>
              <td className={`text-right tabular-nums font-bold ${l.quantityKg >= 0 ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}`}>
                {l.quantityKg >= 0 ? '+' : '−'}{fmtKg(Math.abs(l.quantityKg))}
              </td>
              <td className="text-right tabular-nums">{fmtKg(l.balanceAfterKg)}</td>
              <td>{l.referenceId || '—'}{l.batchNumber && <div className={`text-[12px] ${muted}`}>Batch {l.batchNumber}</div>}</td>
              <td className="max-w-[320px] text-[12px]">{l.reason || '—'}</td>
              <td>{l.performedBy}</td>
            </tr>
          )}
        />
      )}

      {/* ── Raw material form ── */}
      {modal === 'raw' && (
        <Modal title={target ? `Edit ${target.name}` : 'Add raw material'} onClose={closeModal} footer={footer(saveRaw)} width="max-w-2xl">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required><input className={inp} value={rawForm.name} onChange={e => setRawForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jeera (whole)" /></Field>
            <Field label="Code" hint={target ? undefined : 'Leave empty to auto-number (RM-0001)'}><input className={inp} value={rawForm.code} onChange={e => setRawForm(f => ({ ...f, code: e.target.value }))} /></Field>
            <Field label="Category"><input className={inp} value={rawForm.category} onChange={e => setRawForm(f => ({ ...f, category: e.target.value }))} placeholder="Whole spice, Powder…" /></Field>
            <Field label="Show quantities in">
              <select className={inp} value={rawForm.displayUnit} onChange={e => setRawForm(f => ({ ...f, displayUnit: e.target.value }))}>
                <option value="kg">kg</option><option value="g">g</option>
              </select>
            </Field>
            {!target && (
              <Field label="Opening stock" hint="Stock you already have today (optional)">
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" className={inp} value={rawForm.openingStock} onChange={e => setRawForm(f => ({ ...f, openingStock: e.target.value }))} />
                  <UnitSelect value={rawForm.openingUnit} onChange={e => setRawForm(f => ({ ...f, openingUnit: e.target.value }))} />
                </div>
              </Field>
            )}
            <Field label="Reorder level" hint="Low-stock alert at or below this">
              <div className="flex gap-2">
                <input type="number" min="0" step="any" className={inp} value={rawForm.reorderLevel} onChange={e => setRawForm(f => ({ ...f, reorderLevel: e.target.value }))} />
                <UnitSelect value={rawForm.reorderUnit} onChange={e => setRawForm(f => ({ ...f, reorderUnit: e.target.value }))} />
              </div>
            </Field>
            <Field label="Cost per kg (₹)" hint={target ? 'Purchases (GRN) update this as a weighted average' : undefined}>
              <input type="number" min="0" step="any" className={inp} value={rawForm.costPerKg} onChange={e => setRawForm(f => ({ ...f, costPerKg: e.target.value }))} />
            </Field>
            <Field label="HSN code"><input className={inp} value={rawForm.hsnCode} onChange={e => setRawForm(f => ({ ...f, hsnCode: e.target.value }))} /></Field>
            <Field label="Location">
              <select className={inp} value={rawForm.location} onChange={e => setRawForm(f => ({ ...f, location: e.target.value }))}>
                {lookupOptions(locations, rawForm.location).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Usually packed into" hint="Pre-selects the product on the packing form">
              <select className={inp} value={rawForm.defaultProductId} onChange={e => setRawForm(f => ({ ...f, defaultProductId: e.target.value }))}>
                <option value="">—</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {!target && <Field label="Opening batch no"><input className={inp} value={rawForm.batchNumber} onChange={e => setRawForm(f => ({ ...f, batchNumber: e.target.value }))} /></Field>}
            <Field label="Notes" className="col-span-2"><input className={inp} value={rawForm.notes} onChange={e => setRawForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            {target && (
              <label className="col-span-2 flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={rawForm.isActive} onChange={e => setRawForm(f => ({ ...f, isActive: e.target.checked }))} /> Active (inactive materials can't be packed)
              </label>
            )}
          </div>
          {target && <p className={`text-[12px] ${muted}`}>Stock is changed only through Adjust, Purchase GRN and Packing, so every change is in the ledger.</p>}
        </Modal>
      )}

      {/* ── Adjust raw stock ── */}
      {modal === 'adjust' && target && (
        <Modal title={`Adjust stock — ${target.name}`} onClose={closeModal} footer={footer(saveAdjust)}>
          <p className="text-[13px]">Current stock: <b>{fmtKg(target.currentStockKg, target.displayUnit)}</b></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inp} value={adjForm.type} onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))}>
                <option value="Adjustment">Adjustment (count correction)</option>
                <option value="Damage">Damage / spoilage (out)</option>
              </select>
            </Field>
            <Field label="Direction">
              <select className={inp} value={adjForm.type === 'Damage' ? 'out' : adjForm.direction} disabled={adjForm.type === 'Damage'} onChange={e => setAdjForm(f => ({ ...f, direction: e.target.value }))}>
                <option value="in">Add to stock</option>
                <option value="out">Remove from stock</option>
              </select>
            </Field>
            <Field label="Quantity" required>
              <div className="flex gap-2">
                <input type="number" min="0" step="any" className={inp} value={adjForm.quantity} onChange={e => setAdjForm(f => ({ ...f, quantity: e.target.value }))} />
                <UnitSelect value={adjForm.unit} onChange={e => setAdjForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </Field>
            {adjForm.type !== 'Damage' && adjForm.direction === 'in' && (
              <Field label="Cost per kg (₹)" hint="Optional — updates average cost"><input type="number" min="0" step="any" className={inp} value={adjForm.costPerKg} onChange={e => setAdjForm(f => ({ ...f, costPerKg: e.target.value }))} /></Field>
            )}
            <Field label="Reason" required className="col-span-2"><input className={inp} value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Physical count 12 Nov" /></Field>
            <Field label="Batch no"><input className={inp} value={adjForm.batchNumber} onChange={e => setAdjForm(f => ({ ...f, batchNumber: e.target.value }))} /></Field>
          </div>
          {Number(adjForm.quantity) > 0 && (
            <p className={`text-[13px] ${muted}`}>
              New stock: <b>{fmtKg(Number(target.currentStockKg) + (adjForm.type === 'Damage' || adjForm.direction === 'out' ? -1 : 1) * toKg(adjForm.quantity, adjForm.unit), target.displayUnit)}</b>
            </p>
          )}
        </Modal>
      )}

      {/* ── New packing ── */}
      {modal === 'pack' && (
        <Modal title="New packing entry" onClose={closeModal} width="max-w-4xl"
          footer={footer(savePack, mismatch && confirmMismatch ? 'Save with difference' : 'Save packing')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Raw material" required className="col-span-2">
              <select className={inp} value={packForm.rawMaterialId} onChange={e => {
                const r = rawById[e.target.value];
                setPackForm(f => ({ ...f, rawMaterialId: e.target.value }));
                if (r?.defaultProductId && lines.length === 1 && !lines[0].productId) setLine(0, { productId: String(r.defaultProductId) });
                setMismatch(null);
              }}>
                <option value="">Select…</option>
                {raws.filter(r => r.isActive).map(r => <option key={r.id} value={r.id}>{r.name} — {fmtKg(r.currentStockKg, r.displayUnit)} in stock</option>)}
              </select>
            </Field>
            <Field label="Raw used" hint="Empty = packets + wastage">
              <div className="flex gap-2">
                <input type="number" min="0" step="any" className={inp} value={packForm.rawQuantityUsed} placeholder={calc.packedKg ? String(+(calc.packedKg + calc.wastageKg).toFixed(3)) : ''}
                  onChange={e => { setPackForm(f => ({ ...f, rawQuantityUsed: e.target.value })); setMismatch(null); setConfirmMismatch(false); }} />
                <UnitSelect value={packForm.rawUnit} onChange={e => setPackForm(f => ({ ...f, rawUnit: e.target.value }))} />
              </div>
            </Field>
            <Field label="Wastage / loss">
              <div className="flex gap-2">
                <input type="number" min="0" step="any" className={inp} value={packForm.wastage}
                  onChange={e => { setPackForm(f => ({ ...f, wastage: e.target.value })); setMismatch(null); setConfirmMismatch(false); }} />
                <UnitSelect value={packForm.wastageUnit} onChange={e => setPackForm(f => ({ ...f, wastageUnit: e.target.value }))} />
              </div>
            </Field>
            <Field label="Packing date"><input type="date" className={inp} max={today()} value={packForm.packedOn} onChange={e => setPackForm(f => ({ ...f, packedOn: e.target.value }))} /></Field>
            <Field label="Batch no"><input className={inp} value={packForm.batchNumber} onChange={e => setPackForm(f => ({ ...f, batchNumber: e.target.value }))} placeholder="e.g. JR-1125" /></Field>
            <Field label="Packed by"><input className={inp} value={packForm.packedBy} onChange={e => setPackForm(f => ({ ...f, packedBy: e.target.value }))} placeholder="Name of packer" /></Field>
            <Field label="Notes"><input className={inp} value={packForm.notes} onChange={e => setPackForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-[color:var(--text-secondary)]">Packets produced <span className="text-[color:var(--danger)]">*</span></p>
              <Button size="sm" variant="tertiary" onClick={() => setLines(p => [...p, { ...emptyLine, productId: p[p.length - 1]?.productId || '' }])}><Plus className="size-3.5" />Add pack size</Button>
            </div>
            <div className="grid-box overflow-x-auto">
              <table>
                <thead><tr>
                  <th className="text-left">Product</th><th className="text-left">Pack size</th><th className="text-right">Packets</th>
                  <th className="text-right">Weight</th><th className="text-right">Stock now → after</th><th />
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const p = productById[l.productId];
                    const v = p?.variants.find(x => String(x.id) === String(l.variantId));
                    const kg = (Number(l.packets || 0) * lineGrams(l)) / 1000;
                    const now = p ? (p.variants.length ? (v?.stock ?? 0) : (p.productLevelStock ?? 0)) : null;
                    return (
                      <tr key={i}>
                        <td className="!px-1.5 !py-1 min-w-[180px]">
                          <select className={cellInp} value={l.productId} onChange={e => setLine(i, { productId: e.target.value, variantId: '', packWeightGrams: '' })}>
                            <option value="">Select product…</option>
                            {products.map(x => <option key={x.id} value={x.id}>{x.name}{x.isDraft ? ' (draft)' : ''}</option>)}
                          </select>
                        </td>
                        <td className="!px-1.5 !py-1 min-w-[120px]">
                          {p && p.variants.length > 0 ? (
                            <select className={cellInp} value={l.variantId} onChange={e => setLine(i, { variantId: e.target.value })}>
                              <option value="">Pack size…</option>
                              {p.variants.map(x => <option key={x.id} value={x.id}>{x.weight}</option>)}
                            </select>
                          ) : (
                            <input type="number" min="1" className={cellInp} placeholder="grams" value={l.packWeightGrams} disabled={!p} onChange={e => setLine(i, { packWeightGrams: e.target.value })} />
                          )}
                        </td>
                        <td className="!px-1.5 !py-1 w-28"><input type="number" min="1" step="1" className={`${cellInp} text-right`} value={l.packets} onChange={e => setLine(i, { packets: e.target.value })} /></td>
                        <td className="text-right tabular-nums">{kg ? fmtKg(kg) : '—'}</td>
                        <td className="text-right tabular-nums">{now == null ? '—' : <>{now} → <b>{now + Number(l.packets || 0)}</b></>}</td>
                        <td className="!px-1 text-center">
                          {lines.length > 1 && <IconButton label="Remove row" tone="danger" onClick={() => setLines(p2 => p2.filter((_, j) => j !== i))}><X className="size-3.5" /></IconButton>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3 text-[13px] md:grid-cols-5">
            <div><div className={muted}>Packets</div><b>{calc.packets}</b> ({fmtKg(calc.packedKg)})</div>
            <div><div className={muted}>Wastage</div><b>{fmtKg(calc.wastageKg)}</b></div>
            <div><div className={muted}>Raw used</div><b>{fmtKg(calc.usedKg)}</b></div>
            <div><div className={muted}>Difference</div>
              <b className={Math.abs(calc.variance) > calc.tolerance ? 'text-[color:var(--danger)]' : ''}>{fmtKg(calc.variance)}</b>
            </div>
            <div><div className={muted}>Raw stock after</div>
              <b className={calc.after < 0 ? 'text-[color:var(--danger)]' : calc.raw && calc.after <= calc.raw.reorderLevelKg ? 'text-[color:var(--warning)]' : ''}>{calc.raw ? fmtKg(calc.after, calc.raw.displayUnit) : '—'}</b>
            </div>
          </div>
          {calc.after < 0 && <p className="text-[13px] text-[color:var(--danger)]">Not enough raw stock — only {fmtKg(calc.stock)} available.</p>}
          {calc.variance < -calc.tolerance && <p className="text-[13px] text-[color:var(--danger)]">Packets + wastage are more than the raw material used — check the numbers.</p>}
          {calc.variance > calc.tolerance && !mismatch && <p className="text-[13px] text-[color:var(--warning)]">{fmtKg(calc.variance)} is not accounted for. Enter it as wastage, or you will be asked to confirm it as unexplained loss.</p>}
          {mismatch && (
            <div className="rounded-[8px] border border-[color:var(--warning)] bg-[color:var(--warning-bg)] p-3 text-[13px]">
              <p className="font-bold text-[color:var(--warning)]">{mismatch.message}</p>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={confirmMismatch} onChange={e => setConfirmMismatch(e.target.checked)} />
                Save anyway and record {fmtKg(mismatch.varianceKg)} as unexplained loss
              </label>
            </div>
          )}
        </Modal>
      )}

      {/* ── Entry detail ── */}
      {modal === 'entry' && target && (
        <Modal title={`Packing ${target.packingNumber}`} onClose={closeModal} width="max-w-3xl"
          footer={(
            <>
              {target.status === 'Completed' && <Button variant="danger" onClick={() => { setReverseReason(''); setModal('reverse'); }}><Undo2 className="size-4" />Reverse</Button>}
              <Button variant="secondary" onClick={closeModal}>Close</Button>
            </>
          )}>
          {!detail ? <Skeleton className="block h-40 w-full" /> : (
            <>
              <div className="grid grid-cols-2 gap-2 text-[13px] md:grid-cols-4">
                <div><div className={muted}>Status</div><Badge tone={detail.entry.status === 'Reversed' ? 'danger' : 'success'}>{detail.entry.status}</Badge></div>
                <div><div className={muted}>Date</div><b>{fmtDate(detail.entry.packedOn)}</b></div>
                <div><div className={muted}>Raw material</div><b>{detail.entry.rawMaterialName}</b></div>
                <div><div className={muted}>Raw used</div><b>{fmtKg(detail.entry.rawUsedKg)}</b></div>
                <div><div className={muted}>Packed</div><b>{fmtKg(detail.entry.packedKg)}</b></div>
                <div><div className={muted}>Wastage</div><b>{fmtKg(detail.entry.wastageKg)}</b></div>
                <div><div className={muted}>Unexplained</div><b>{fmtKg(detail.entry.varianceKg)}</b></div>
                <div><div className={muted}>Raw cost / kg</div><b>{fmtMoney(detail.entry.costPerKg)}</b></div>
                <div><div className={muted}>Batch</div><b>{detail.entry.batchNumber || '—'}</b></div>
                <div><div className={muted}>Packed by</div><b>{detail.entry.packedBy || '—'}</b></div>
                <div className="col-span-2"><div className={muted}>Recorded</div>{detail.entry.createdBy} · {fmtDateTime(detail.entry.createdAt)}</div>
                {detail.entry.notes && <div className="col-span-4"><div className={muted}>Notes</div>{detail.entry.notes}</div>}
                {detail.entry.status === 'Reversed' && (
                  <div className="col-span-4 text-[color:var(--danger)]">Reversed by {detail.entry.reversedBy} on {fmtDateTime(detail.entry.reversedAt)}: {detail.entry.reversalReason}</div>
                )}
              </div>
              <div className="grid-box">
                <table>
                  <thead><tr><th className="text-left">Product</th><th className="text-left">Pack</th><th className="text-right">Packets</th><th className="text-right">Weight</th><th className="text-left">SKU</th><th className="text-right">Stock now</th></tr></thead>
                  <tbody>{detail.entry.lines.map(l => (
                    <tr key={l.id}><td>{l.productName}</td><td>{l.packLabel}</td><td className="text-right">{l.packets}</td><td className="text-right">{fmtKg(l.totalKg)}</td><td>{l.sku}</td><td className="text-right">{l.currentStock}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="text-[12px] font-bold text-[color:var(--text-secondary)]">Stock movements</p>
              <ul className="space-y-1 text-[12px]">
                {detail.rawLedger.map(l => <li key={`r${l.id}`}>Raw · {TYPE_LABEL[l.type] || l.type}: <b>{l.quantityKg >= 0 ? '+' : '−'}{fmtKg(Math.abs(l.quantityKg))}</b> → {fmtKg(l.balanceAfterKg)} <span className={muted}>({l.performedBy}, {fmtDateTime(l.createdAt)})</span></li>)}
                {detail.stockLedger.map(l => <li key={`s${l.id}`}>Finished · {l.productName} {l.packLabel || ''} · {l.type === 'PackingReversal' ? 'Reversal' : 'Packed'}: <b>{l.type === 'PackingReversal' ? '−' : '+'}{l.quantity}</b> → {l.balanceAfter} <span className={muted}>({l.performedBy}, {fmtDateTime(l.createdAt)})</span></li>)}
              </ul>
            </>
          )}
        </Modal>
      )}

      {/* ── Reverse ── */}
      {modal === 'reverse' && target && (
        <Modal title={`Reverse ${target.packingNumber}?`} onClose={closeModal} footer={footer(doReverse, 'Reverse entry', 'danger')}>
          <p className="text-[13px]">
            This removes the packets from finished stock ({target.lines.map(l => `${l.packets} × ${l.packLabel}`).join(', ')}) and returns <b>{fmtKg(target.rawUsedKg)}</b> to {target.rawMaterialName}.
            It is refused if some of these packets were already sold.
          </p>
          <Field label="Reason" required><input className={inp} value={reverseReason} onChange={e => setReverseReason(e.target.value)} placeholder="e.g. Wrong packet count entered" autoFocus /></Field>
        </Modal>
      )}
    </div>
  );
}
