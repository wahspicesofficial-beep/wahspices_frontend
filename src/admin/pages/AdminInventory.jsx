import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAdminInventory, adjustInventory, createInventoryItem, deleteInventoryItem,
  fetchInventoryLedger, fetchAdminCategories, fetchSkus, generateSku,
  fetchInventoryBatches, fetchInventoryAlerts, fetchInventoryLocations, transferInventoryStock,
} from '@/store/slices/adminSlice';
import { SkTable, SkKpiCards, SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import {
  Package, BookOpen, Layers, AlertTriangle, Tag,
  Plus, RefreshCw, Edit2, Trash2, Copy, Zap,
  ArrowRightLeft, MapPin, Clock, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  BarChart3, PackageX, PackageCheck, Truck, Globe,
} from 'lucide-react';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, Segmented, SearchInput, Toolbar,
  EmptyState, Skeleton, usePagination, Pagination, DialogPanel, Field,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';
import api from '@/services/api';

// ── Constants ────────────────────────────────────────────────────────────────

// Manual adjustments only — GRN receipts and sale deductions are posted by their own flows
const MANUAL_ADJUST = ['Addition', 'Reduction', 'Damage', 'Return'];
// Ledger types that take stock out (everything else adds)
const OUT_TYPES = new Set(['Reduction', 'Damage', 'SaleDeduction', 'PackingReversal']);
const INV_ALL = { limit: 1000 };

const TABS = [
  { key: 'Stock',              label: 'Stock',              icon: Package },
  { key: 'Insights',           label: 'Insights',           icon: BarChart3 },
  { key: 'Ledger',             label: 'Ledger',             icon: BookOpen },
  { key: 'Batches',            label: 'Batches & Expiry',   icon: Clock },
  { key: 'Alerts & Locations', label: 'Alerts & Locations', icon: AlertTriangle },
  { key: 'SKU Manager',        label: 'SKU Manager',        icon: Tag },
];

const emptyCreate = { name: '', categorySlug: '', sku: '', unit: '', stock: '', reorder: '', price: '', location: '', batch: '', expiry: '' };
const emptyAdjust = { type: 'Addition', quantity: '', reason: '', batch: '', expiry: '' };

// ── Shared primitives ─────────────────────────────────────────────────────────

const inp = 'input-field w-full';
const muted = 'text-[color:var(--text-muted)]';

const Loading = ({ label }) => (
  <div className="space-y-2 p-4" aria-label={label}>
    {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="block h-7 w-full" />)}
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminInventory() {
  const dispatch    = useDispatch();
  const items       = useSelector(s => s.admin.inventory.items);
  const summary     = useSelector(s => s.admin.inventory.summary);
  const ledger      = useSelector(s => s.admin.inventory.ledger);
  const ledgerTotal = useSelector(s => s.admin.inventory.ledgerTotal);
  const skus        = useSelector(s => s.admin.inventory.skus);
  const batches     = useSelector(s => s.admin.inventory.batches);
  const alerts      = useSelector(s => s.admin.inventory.alerts);
  const locations   = useSelector(s => s.admin.inventory.locations);
  const loading     = useSelector(s => s.admin.loading);
  const categories  = useSelector(s => s.admin.categories.items);
  const lk          = useLookups();
  const LOCATIONS   = lk.values('InventoryLocation');
  const unitOpts    = lk.list('Unit');
  const adjustTypes = lk.enumList('StockAdjustmentType').filter(t => MANUAL_ADJUST.includes(t.value));

  const [tab, setTab]             = useState('Stock');
  const [modal, setModal]         = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [adjustForm, setAdjustForm] = useState(emptyAdjust);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [generatingSku, setGeneratingSku] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferForm, setTransferForm] = useState({ toLocation: '', quantity: '', notes: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm]     = useState({ reorder: '', price: '', location: '', batch: '', expiry: '' });
  const [busy, setBusy]             = useState(false);

  const newItemForm = () => ({
    ...emptyCreate,
    categorySlug: categories.find(c => !c.parentId)?.slug || categories[0]?.slug || '',
    unit: unitOpts[0]?.value || 'pcs',
    location: LOCATIONS[0] || '',
  });
  const reloadStock = () => dispatch(fetchAdminInventory(INV_ALL));

  useEffect(() => {
    dispatch(fetchAdminInventory(INV_ALL));
    dispatch(fetchSkus());
    if (categories.length === 0) dispatch(fetchAdminCategories());
  }, [dispatch]);

  useEffect(() => {
    if (tab === 'Ledger')             dispatch(fetchInventoryLedger({ page: ledgerPage, limit: 30 }));
    if (tab === 'SKU Manager')        dispatch(fetchSkus());
    if (tab === 'Batches')            dispatch(fetchInventoryBatches());
    if (tab === 'Alerts & Locations') { dispatch(fetchInventoryAlerts()); dispatch(fetchInventoryLocations()); }
  }, [tab, ledgerPage, dispatch]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalValue     = summary?.totalValue ?? items.reduce((s, i) => s + (i.stockValue ?? 0), 0);
  const lowStockCount  = summary?.lowStock   ?? items.filter(i => i.isLowStock).length;
  const totalLocations = summary?.locations ?? (new Set(items.map(i => i.location).filter(Boolean)).size || 0);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const m = (i.productName || '').toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q);
    return filter === 'low' ? m && i.isLowStock : m;
  });
  const stockPg = usePagination(filtered, 20);

  const filteredSkus = skus.filter(s => {
    const q = skuSearch.toLowerCase();
    return !q || s.sku.toLowerCase().includes(q) || s.productName.toLowerCase().includes(q);
  });
  const skuPg = usePagination(filteredSkus, 20);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const { name, sku, stock, price, unit, location, categorySlug, batch, expiry, reorder } = createForm;
    if (!name.trim() || !sku.trim() || stock === '' || price === '') { toast.error('Name, SKU, opening stock and cost price are required'); return; }
    if (Number(stock) < 0 || Number(price) < 0 || Number(reorder) < 0) { toast.error('Stock, reorder point and cost cannot be negative'); return; }
    if (!Number.isInteger(Number(stock)) || (reorder !== '' && !Number.isInteger(Number(reorder)))) { toast.error('Stock and reorder point must be whole numbers'); return; }
    setBusy(true);
    const res = await dispatch(createInventoryItem({
      productName: name.trim(), categorySlug, sku: sku.trim(),
      currentStock: Number(stock), reorderPoint: Number(reorder) || 0,
      costPrice: Number(price), unit, location,
      batchNumber: batch || null, expiryDate: expiry || null,
    }));
    setBusy(false);
    if (createInventoryItem.fulfilled.match(res)) {
      toast.success('Inventory item created');
      setModal(null); setCreateForm(newItemForm());
      reloadStock(); dispatch(fetchSkus());
    } else {
      toast.error(res.payload || 'Failed to create item');
    }
  };

  const handleAdjust = async () => {
    if (!adjustForm.quantity || Number(adjustForm.quantity) <= 0 || !Number.isInteger(Number(adjustForm.quantity))) { toast.error('Enter a positive whole quantity'); return; }
    if (!adjustForm.reason.trim()) { toast.error('Reason is required'); return; }
    setBusy(true);
    const res = await dispatch(adjustInventory({
      id: adjustTarget.id, quantity: Number(adjustForm.quantity),
      type: adjustForm.type, reason: adjustForm.reason,
      batchNumber: adjustForm.batch || null, expiryDate: adjustForm.expiry || null,
    }));
    setBusy(false);
    if (adjustInventory.fulfilled.match(res)) {
      toast.success(`Stock adjusted. New quantity: ${res.payload?.currentStock ?? '—'}`); setModal(null); reloadStock();
    } else {
      toast.error(res.payload || 'Failed to adjust stock');
    }
  };

  const handleDelete = async item => {
    if (!confirm(`Delete "${item.productName}" from inventory?`)) return;
    const res = await dispatch(deleteInventoryItem(item.id));
    if (deleteInventoryItem.fulfilled.match(res)) { toast.success('Removed from inventory'); reloadStock(); dispatch(fetchSkus()); }
    else toast.error(res.payload || 'Delete failed');
  };

  const handleGenerateSku = async () => {
    if (!createForm.name) { toast.error('Enter product name first'); return; }
    setGeneratingSku(true);
    const res = await dispatch(generateSku({ name: createForm.name, category: createForm.categorySlug }));
    if (generateSku.fulfilled.match(res)) {
      setCreateForm(f => ({ ...f, sku: res.payload?.sku || '' }));
      toast.success('SKU generated!');
    } else toast.error(res.payload || 'Failed to generate SKU');
    setGeneratingSku(false);
  };

  const handleTransfer = async () => {
    if (!transferForm.toLocation) { toast.error('Choose a destination'); return; }
    setBusy(true);
    const res = await dispatch(transferInventoryStock({
      id: transferTarget.id, quantity: Number(transferForm.quantity),
      toLocation: transferForm.toLocation, notes: transferForm.notes || null,
    }));
    setBusy(false);
    if (transferInventoryStock.fulfilled.match(res)) {
      toast.success(`Moved to ${transferForm.toLocation}`);
      setModal(null); reloadStock();
      if (tab === 'Alerts & Locations') { dispatch(fetchInventoryAlerts()); dispatch(fetchInventoryLocations()); }
    } else toast.error(res.payload || 'Transfer failed');
  };

  const openAdjust = item => { setAdjustTarget(item); setAdjustForm(emptyAdjust); setModal('adjust'); };
  const openTransfer = item => {
    setTransferTarget(item);
    const other = LOCATIONS.find(l => l !== item.location) || '';
    // One stock row per product (schema), so a transfer moves the whole quantity
    setTransferForm({ toLocation: other, quantity: item.currentStock, notes: '' });
    setModal('transfer');
  };
  const openEdit = item => {
    setEditTarget(item);
    setEditForm({
      reorder: item.reorderPoint ?? 0, price: item.costPrice ?? 0, location: item.location || '',
      batch: item.batchNumber || '', expiry: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
    });
    setModal('edit');
  };
  const handleEdit = async () => {
    if (Number(editForm.reorder) < 0 || Number(editForm.price) < 0) { toast.error('Reorder point and cost cannot be negative'); return; }
    setBusy(true);
    try {
      await api.put(`/admin/inventory/${editTarget.id}`, {
        reorderPoint: Number(editForm.reorder) || 0, costPrice: Number(editForm.price) || 0,
        location: editForm.location || null, batchNumber: editForm.batch, expiryDate: editForm.expiry || null,
      });
      toast.success('Item updated'); setModal(null); reloadStock();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not update item');
    } finally { setBusy(false); }
  };

  if (loading && items.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTabs tabCount={3} contentRows={7} /></div>;

  const lowItems = items.filter(i => i.isLowStock);

  return (
    <div className="space-y-4">

      <PageHeader
        title="Inventory"
        description="Stock ledger · batch tracking · multi-location · alerts"
        actions={
          <Button onClick={() => { setCreateForm(newItemForm()); setModal('create'); }}>
            <Plus className="size-4" /> Add to inventory
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total SKUs" value={summary?.total ?? items.length} icon={Package} tone="info" />
        <Stat label="Low stock" value={lowStockCount} icon={AlertTriangle} tone="danger" />
        <Stat label="Total value" value={`₹${(totalValue / 1000).toFixed(1)}k`} icon={CheckCircle} tone="success" />
        <Stat label="Locations" value={totalLocations} icon={MapPin} tone="primary" />
      </div>

      {/* Low stock banner */}
      {lowItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-[8px] border border-[rgba(176,56,47,0.3)] bg-[color:var(--danger-bg)] px-3.5 py-2.5">
          <AlertTriangle className="size-4 shrink-0 text-[color:var(--danger)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[color:var(--danger)]">Low stock alert</p>
            <p className="truncate text-[12px] text-[color:var(--text-secondary)]">
              {lowItems.map(i => i.productName).join(', ')} — reorder needed
            </p>
          </div>
          <Button size="sm" variant="danger" onClick={() => { setTab('Stock'); setFilter('low'); }}>View low stock</Button>
        </div>
      )}

      <Tabs items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} />

      {/* ── Stock Tab ─────────────────────────────────────────────────────── */}
      {tab === 'Stock' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name or SKU…" className="max-w-sm" />
              <Segmented options={[{ value: 'all', label: 'All' }, { value: 'low', label: 'Low stock' }]} value={filter} onChange={setFilter} />
              <Button variant="secondary" className="ml-auto" onClick={reloadStock}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </Toolbar>

            {loading && items.length === 0 ? <Loading label="Loading inventory" /> : filtered.length === 0 ? (
              <EmptyState icon={Package} title="No inventory items found">
                {items.length ? 'Try another search or filter.' : 'Add an item to start tracking stock.'}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">SKU</th>
                        <th className="text-left">Product</th>
                        <th className="text-left">Category</th>
                        <th className="text-right">Stock</th>
                        <th className="text-right">Reorder</th>
                        <th className="text-right">Cost</th>
                        <th className="text-left">Batch</th>
                        <th className="text-left">Expiry</th>
                        <th className="text-left">Location</th>
                        <th className="text-right">Value</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockPg.items.map(item => (
                        <tr key={item.id}>
                          <td className={`font-mono text-[12px] ${muted}`}>{item.sku || '—'}</td>
                          <td className="whitespace-nowrap font-bold">{item.productName}</td>
                          <td><Badge tone="primary">{item.categorySlug || item.category || '—'}</Badge></td>
                          <td className="whitespace-nowrap text-right">
                            <span className={`font-bold ${item.isLowStock ? 'text-[color:var(--danger)]' : ''}`}>{item.currentStock}</span>
                            {item.isLowStock && <AlertTriangle size={12} className="ml-1 inline text-[color:var(--danger)]" />}
                          </td>
                          <td className={`text-right ${muted}`}>{item.reorderPoint}</td>
                          <td className="text-right font-bold text-[color:var(--primary)]">₹{item.costPrice}</td>
                          <td className={`font-mono text-[12px] ${muted}`}>{item.batchNumber || '—'}</td>
                          <td className={`whitespace-nowrap ${muted}`}>
                            {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className={`whitespace-nowrap ${muted}`}>{item.location || '—'}</td>
                          <td className="text-right font-bold">₹{(item.stockValue || 0).toLocaleString('en-IN')}</td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <IconButton label="Adjust stock" tone="primary" onClick={() => openAdjust(item)}><RefreshCw className="size-3.5" /></IconButton>
                              <IconButton label="Edit reorder point, cost, batch" onClick={() => openEdit(item)}><Edit2 className="size-3.5" /></IconButton>
                              <IconButton label="Transfer location" onClick={() => openTransfer(item)}><ArrowRightLeft className="size-3.5" /></IconButton>
                              <IconButton label="Delete" tone="danger" onClick={() => handleDelete(item)}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...stockPg} noun="items" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Ledger Tab ────────────────────────────────────────────────────── */}
      {tab === 'Ledger' && (
        <Card
          title={`Stock ledger · ${ledgerTotal} entries`}
          actions={
            <Button size="sm" variant="secondary" onClick={() => dispatch(fetchInventoryLedger({ page: ledgerPage, limit: 30 }))}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          }
          bodyClassName="p-3"
        >
          {loading && ledger.length === 0 ? <Loading label="Loading ledger" /> : ledger.length === 0 ? (
            <EmptyState icon={BookOpen} title="No ledger entries yet">Stock movements will be recorded here.</EmptyState>
          ) : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-left">Product</th>
                    <th className="text-left">Type</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Balance</th>
                    <th className="text-left">Reason</th>
                    <th className="text-left">By</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry.id}>
                      <td className={`whitespace-nowrap ${muted}`}>
                        {new Date(entry.date || entry.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="font-bold">{entry.productName}</td>
                      <td>
                        <Badge tone={OUT_TYPES.has(entry.type) ? 'danger' : 'success'}>{lk.label('StockAdjustmentType', entry.type)}</Badge>
                      </td>
                      <td className="text-right font-bold">{OUT_TYPES.has(entry.type) ? '-' : '+'}{Math.abs(entry.quantity)}</td>
                      <td className="text-right">{entry.balanceAfter}</td>
                      <td className={`max-w-xs truncate ${muted}`}>{entry.reason || '—'}</td>
                      <td className={muted}>{entry.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ledgerTotal > 30 && (
            <div className="flex items-center justify-between px-1 pt-2.5 text-[13px] text-[color:var(--text-muted)]">
              <span>Page <b className="text-[color:var(--text-primary)]">{ledgerPage}</b> · 30 per page</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" onClick={() => setLedgerPage(p => Math.max(1, p - 1))} disabled={ledgerPage === 1}>
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setLedgerPage(p => p + 1)} disabled={ledgerPage * 30 >= ledgerTotal}>
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Insights Tab (website stock + recent stock-in) ─────────────────── */}
      {tab === 'Insights' && <InsightsTab onAdjust={openAdjust} reloadKey={items} />}

      {/* ── Batches & Expiry Tab ──────────────────────────────────────────── */}
      {tab === 'Batches' && (
        <BatchesTab batches={batches} loading={loading} onRefresh={() => dispatch(fetchInventoryBatches())} />
      )}

      {/* ── Alerts & Locations Tab ────────────────────────────────────────── */}
      {tab === 'Alerts & Locations' && (
        <AlertsLocationsTab
          alerts={alerts}
          locations={locations}
          loading={loading}
          items={items}
          onRefresh={() => { dispatch(fetchInventoryAlerts()); dispatch(fetchInventoryLocations()); }}
          onTransfer={openTransfer}
        />
      )}

      {/* ── SKU Manager Tab ───────────────────────────────────────────────── */}
      {tab === 'SKU Manager' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total SKUs" value={skus.length} icon={Tag} tone="info" />
            <Stat label="Categories" value={new Set(skus.map(s => s.categorySlug)).size} icon={Layers} tone="primary" />
            <Stat label="Units in use" value={new Set(skus.map(s => s.unit)).size} icon={Package} tone="success" />
          </div>

          <Card>
            <div className="space-y-3 p-3">
              <Toolbar>
                <SearchInput value={skuSearch} onChange={setSkuSearch} placeholder="Search SKU or product…" className="max-w-sm" />
                <span className={`text-[12px] ${muted}`}>{skus.length} SKUs total</span>
                <Button variant="secondary" className="ml-auto" onClick={() => dispatch(fetchSkus())}>
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </Toolbar>

              {skus.length === 0 ? (
                <EmptyState icon={Tag} title="No SKUs yet">Add inventory items to see them here.</EmptyState>
              ) : filteredSkus.length === 0 ? (
                <EmptyState icon={Tag} title="No SKUs match your search" />
              ) : (
                <>
                  <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">SKU code</th>
                          <th className="text-left">Product name</th>
                          <th className="text-left">Category</th>
                          <th className="text-left">Unit</th>
                          <th className="text-right">Stock</th>
                          <th className="text-left">Location</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skuPg.items.map(s => (
                          <tr key={s.sku}>
                            <td><span className="font-mono font-bold text-[color:var(--primary)]">{s.sku}</span></td>
                            <td className="font-bold">{s.productName}</td>
                            <td><Badge>{s.categorySlug}</Badge></td>
                            <td className={muted}>{s.unit}</td>
                            <td className="text-right">{s.totalStock ?? '—'}</td>
                            <td className={muted}>{s.locations?.join(', ') || '—'}</td>
                            <td>
                              <div className="flex justify-center">
                                <IconButton label="Copy SKU" tone="primary" onClick={() => { navigator.clipboard.writeText(s.sku); toast.success(`Copied: ${s.sku}`); }}>
                                  <Copy className="size-3.5" />
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...skuPg} noun="SKUs" />
                </>
              )}
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-1.5"><Zap className="size-3.5 text-[color:var(--primary)]" /> SKU generator</span>}
            bodyClassName="p-4"
          >
            <p className={`mb-3 text-[12px] ${muted}`}>
              Auto-generates a unique SKU: <span className="font-mono font-bold">CATEGORY-PRODUCT-SEQ</span> (e.g. <span className="font-mono font-bold text-[color:var(--primary)]">BLM-GRMM-001</span>)
            </p>
            <SkuGeneratorWidget dispatch={dispatch} categories={categories} />
          </Card>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {modal === 'create' && (
        <AdminModal onClose={() => setModal(null)}>
          <DialogPanel
            title="Add to inventory"
            onClose={() => setModal(null)}
            width="max-w-lg"
            footer={<>
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={handleCreate} loading={busy}>Add item</Button>
            </>}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product name" required className="col-span-2">
                <input className={inp} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Garam Masala 100g" />
              </Field>
              <Field label="SKU" required>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input list="sku-list" value={createForm.sku} onChange={e => setCreateForm(f => ({ ...f, sku: e.target.value }))}
                      placeholder="Select or type SKU…" className={inp} />
                    <datalist id="sku-list">
                      {skus.map(s => <option key={s.sku} value={s.sku}>{s.sku} — {s.productName}</option>)}
                    </datalist>
                  </div>
                  <Button onClick={handleGenerateSku} disabled={generatingSku} className="!px-2.5">
                    <Zap className="size-3.5" />{generatingSku ? '…' : 'Generate'}
                  </Button>
                </div>
              </Field>
              <Field label="Category">
                <select className={inp} value={createForm.categorySlug} onChange={e => setCreateForm(f => ({ ...f, categorySlug: e.target.value }))}>
                  {categories.length === 0 ? <option>Loading…</option>
                    : categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Opening stock" required>
                <input type="number" className={inp} value={createForm.stock} min="0" onChange={e => setCreateForm(f => ({ ...f, stock: e.target.value }))} />
              </Field>
              <Field label="Reorder point">
                <input type="number" className={inp} value={createForm.reorder} min="0" onChange={e => setCreateForm(f => ({ ...f, reorder: e.target.value }))} />
              </Field>
              <Field label="Cost price (₹)" required>
                <input type="number" className={inp} value={createForm.price} min="0" onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))} />
              </Field>
              <Field label="Unit">
                <select className={inp} value={createForm.unit} onChange={e => setCreateForm(f => ({ ...f, unit: e.target.value }))}>
                  {lookupOptions(unitOpts, createForm.unit).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <select className={inp} value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}>
                  {lookupOptions(lk.list('InventoryLocation'), createForm.location).map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Batch no.">
                <input className={inp} value={createForm.batch} onChange={e => setCreateForm(f => ({ ...f, batch: e.target.value }))} />
              </Field>
              <Field label="Expiry date">
                <input type="date" className={inp} value={createForm.expiry} onChange={e => setCreateForm(f => ({ ...f, expiry: e.target.value }))} />
              </Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {modal === 'adjust' && adjustTarget && (
        <AdminModal onClose={() => setModal(null)}>
          <DialogPanel
            title="Adjust stock"
            onClose={() => setModal(null)}
            width="max-w-lg"
            footer={<>
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={handleAdjust} loading={busy}>Save</Button>
            </>}
          >
            <div className="mb-4 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3">
              <p className="text-[13px] font-bold">{adjustTarget.productName}</p>
              <p className={`mt-0.5 text-[12px] ${muted}`}>
                SKU: {adjustTarget.sku} · Current stock: <span className="font-bold text-[color:var(--primary)]">{adjustTarget.currentStock}</span>
              </p>
            </div>
            <div className="space-y-3">
              <Field label="Adjustment type" required>
                <select className={inp} value={adjustForm.type} onChange={e => setAdjustForm(f => ({ ...f, type: e.target.value }))}>
                  {(adjustTypes.length ? adjustTypes : [{ value: 'Addition', label: 'Addition' }, { value: 'Reduction', label: 'Reduction' }]).map(t => (
                    <option key={t.value} value={t.value}>{t.label} ({OUT_TYPES.has(t.value) ? 'remove stock' : 'add stock'})</option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity" required>
                <input type="number" min="1" className={inp} value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} />
              </Field>
              <Field label="Reason" required>
                <input className={inp} value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Received from vendor, Damaged…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Batch no.">
                  <input className={inp} value={adjustForm.batch} onChange={e => setAdjustForm(f => ({ ...f, batch: e.target.value }))} />
                </Field>
                <Field label="Expiry date">
                  <input type="date" className={inp} value={adjustForm.expiry} onChange={e => setAdjustForm(f => ({ ...f, expiry: e.target.value }))} />
                </Field>
              </div>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {modal === 'transfer' && transferTarget && (
        <AdminModal onClose={() => setModal(null)}>
          <DialogPanel
            title="Transfer stock"
            onClose={() => setModal(null)}
            width="max-w-lg"
            footer={<>
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={handleTransfer} loading={busy} disabled={!transferForm.toLocation}><ArrowRightLeft className="size-3.5" /> Move stock</Button>
            </>}
          >
            <div className="mb-4 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3">
              <p className="text-[13px] font-bold">{transferTarget.productName}</p>
              <p className={`mt-0.5 text-[12px] ${muted}`}>
                SKU: {transferTarget.sku} · From: <span className="font-bold text-[color:var(--info)]">{transferTarget.location}</span> · Available: <span className="font-bold text-[color:var(--primary)]">{transferTarget.currentStock}</span>
              </p>
            </div>
            <div className="space-y-3">
              <Field label="Destination location" required>
                <select className={inp} value={transferForm.toLocation} onChange={e => setTransferForm(f => ({ ...f, toLocation: e.target.value }))}>
                  <option value="">Select location…</option>
                  {LOCATIONS.filter(l => l !== transferTarget.location).map(l => <option key={l} value={l}>{lk.label('InventoryLocation', l)}</option>)}
                </select>
              </Field>
              <Field label="Quantity to move" hint="Each product is stocked at one location, so its whole stock moves together.">
                <input type="number" className={inp} value={transferForm.quantity} disabled readOnly />
              </Field>
              <Field label="Notes">
                <input className={inp} value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Cold storage requirement" />
              </Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {modal === 'edit' && editTarget && (
        <AdminModal onClose={() => setModal(null)}>
          <DialogPanel
            title="Edit inventory item"
            onClose={() => setModal(null)}
            width="max-w-lg"
            footer={<>
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={handleEdit} loading={busy}>Save</Button>
            </>}
          >
            <div className="mb-4 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3">
              <p className="text-[13px] font-bold">{editTarget.productName}</p>
              <p className={`mt-0.5 text-[12px] ${muted}`}>SKU: {editTarget.sku} · Stock: {editTarget.currentStock} {editTarget.unit} (use Adjust to change stock)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reorder point">
                <input type="number" min="0" className={inp} value={editForm.reorder} onChange={e => setEditForm(f => ({ ...f, reorder: e.target.value }))} />
              </Field>
              <Field label="Cost price (₹)">
                <input type="number" min="0" className={inp} value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
              </Field>
              <Field label="Location">
                <select className={inp} value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}>
                  {lookupOptions(lk.list('InventoryLocation'), editForm.location).map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Batch no.">
                <input className={inp} value={editForm.batch} onChange={e => setEditForm(f => ({ ...f, batch: e.target.value }))} />
              </Field>
              <Field label="Expiry date">
                <input type="date" className={inp} value={editForm.expiry} onChange={e => setEditForm(f => ({ ...f, expiry: e.target.value }))} />
              </Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}

// ── Batches & Expiry Tab ─────────────────────────────────────────────────────

function BatchesTab({ batches, loading, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const all      = batches?.items || [];
  const filtered = statusFilter === 'all'      ? all
                 : statusFilter === 'expiring'  ? all.filter(i => i.isExpiring && !i.isExpired)
                 : all.filter(i => i.isExpired);
  const pg = usePagination(filtered, 20);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total items" value={all.length} icon={Package} tone="info" />
        <Stat label="Expiring (30d)" value={batches?.totalExpiring ?? 0} icon={Clock} tone="warning" />
        <Stat label="Expired" value={batches?.totalExpired ?? 0} icon={AlertTriangle} tone="danger" />
      </div>

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <Segmented
              options={[{ value: 'all', label: 'All batches' }, { value: 'expiring', label: 'Expiring soon' }, { value: 'expired', label: 'Expired' }]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Button variant="secondary" className="ml-auto" onClick={onRefresh}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          </Toolbar>

          {loading && !all.length ? <Loading label="Loading batches" /> : filtered.length === 0 ? (
            <EmptyState icon={Clock} title="No items in this category" />
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">SKU</th>
                      <th className="text-left">Product</th>
                      <th className="text-left">Batch no.</th>
                      <th className="text-right">Stock</th>
                      <th className="text-left">Location</th>
                      <th className="text-left">Mfg date</th>
                      <th className="text-left">Expiry date</th>
                      <th className="text-right">Days left</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pg.items.map(item => (
                      <tr key={item.id}>
                        <td className={`font-mono text-[12px] ${muted}`}>{item.sku}</td>
                        <td className="whitespace-nowrap font-bold">{item.productName}</td>
                        <td className={`font-mono text-[12px] ${muted}`}>{item.batchNumber || '—'}</td>
                        <td className="whitespace-nowrap text-right font-bold">{item.currentStock} {item.unit}</td>
                        <td className={`whitespace-nowrap ${muted}`}>
                          <MapPin size={11} className="mr-0.5 inline" />{item.location}
                        </td>
                        <td className={muted}>
                          {item.manufactureDate ? new Date(item.manufactureDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className={`whitespace-nowrap ${item.isExpired ? 'font-bold text-[color:var(--danger)]' : item.isExpiring ? 'font-bold text-[color:var(--warning)]' : muted}`}>
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="text-right">
                          {item.daysToExpiry != null ? (
                            <span className={`font-bold ${item.daysToExpiry < 0 ? 'text-[color:var(--danger)]' : item.daysToExpiry <= 30 ? 'text-[color:var(--warning)]' : 'text-[color:var(--success)]'}`}>
                              {item.daysToExpiry < 0 ? `${Math.abs(item.daysToExpiry)}d ago` : `${item.daysToExpiry}d`}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {item.isExpired
                            ? <Badge tone="danger">Expired</Badge>
                            : item.isExpiring
                              ? <Badge tone="warning">Expiring soon</Badge>
                              : <Badge tone="success">OK</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pg} noun="batches" />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Alerts & Locations Tab ────────────────────────────────────────────────────

function AlertsLocationsTab({ alerts, locations, loading, items, onRefresh, onTransfer }) {
  const [view, setView] = useState('alerts');
  const [expandedLoc, setExpandedLoc] = useState(null);

  const lowStock = alerts?.lowStock || [];
  const expired  = alerts?.expired  || [];
  const expiring = alerts?.expiring || [];
  const s        = alerts?.summary;
  const locs     = locations?.locations || [];

  return (
    <div className="space-y-4">
      <Toolbar>
        <Segmented options={[{ value: 'alerts', label: 'Alerts' }, { value: 'locations', label: 'Locations' }]} value={view} onChange={setView} />
        <Button variant="secondary" className="ml-auto" onClick={onRefresh}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </Toolbar>

      {/* Alerts view */}
      {view === 'alerts' && (
        loading && !alerts ? (
          <Card><Loading label="Loading alerts" /></Card>
        ) : !lowStock.length && !expired.length && !expiring.length ? (
          <Card>
            <EmptyState icon={CheckCircle} title="All clear">No stock or expiry alerts at this time.</EmptyState>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Low stock" value={s?.totalLowStock ?? lowStock.length} icon={AlertTriangle} tone="danger" />
              <Stat label="Expiring (30d)" value={s?.totalExpiring ?? expiring.length} icon={Clock} tone="warning" />
              <Stat label="Expired" value={s?.totalExpired ?? expired.length} icon={Package} tone="danger" />
              <Stat label="At-risk value" value={`₹${((s?.expiredValue || 0) + (s?.expiringValue || 0)).toFixed(0)}`} icon={CheckCircle} tone="accent" />
            </div>

            {lowStock.length > 0 && (
              <Card
                title={<span className="flex items-center gap-1.5 text-[color:var(--danger)]"><AlertTriangle className="size-3.5" /> Low stock ({lowStock.length})</span>}
                bodyClassName="p-3"
              >
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">SKU</th>
                        <th className="text-left">Product</th>
                        <th className="text-right">Current stock</th>
                        <th className="text-right">Reorder point</th>
                        <th className="text-right">Deficit</th>
                        <th className="text-left">Location</th>
                        <th className="text-right">Cost/unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map(i => (
                        <tr key={i.id}>
                          <td className={`font-mono text-[12px] ${muted}`}>{i.sku}</td>
                          <td className="font-bold">{i.productName}</td>
                          <td className="text-right font-bold text-[color:var(--danger)]">{i.currentStock} {i.unit}</td>
                          <td className="text-right">{i.reorderPoint}</td>
                          <td className="text-right font-bold text-[color:var(--danger)]">-{i.reorderPoint - i.currentStock}</td>
                          <td className={muted}>{i.location}</td>
                          <td className="text-right text-[color:var(--primary)]">₹{i.costPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(expiring.length > 0 || expired.length > 0) && (
              <Card
                title={<span className="flex items-center gap-1.5 text-[color:var(--warning)]"><Clock className="size-3.5" /> Expiry alerts ({expired.length} expired · {expiring.length} expiring)</span>}
                bodyClassName="p-3"
              >
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">SKU</th>
                        <th className="text-left">Product</th>
                        <th className="text-left">Batch</th>
                        <th className="text-right">Stock</th>
                        <th className="text-left">Expiry date</th>
                        <th className="text-right">Days</th>
                        <th className="text-left">Location</th>
                        <th className="text-right">Value at risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...expired, ...expiring].map(i => (
                        <tr key={i.id}>
                          <td className={`font-mono text-[12px] ${muted}`}>{i.sku}</td>
                          <td className="font-bold">{i.productName}</td>
                          <td className={`font-mono text-[12px] ${muted}`}>{i.batchNumber || '—'}</td>
                          <td className="text-right font-bold">{i.currentStock} {i.unit}</td>
                          <td className={`whitespace-nowrap font-bold ${i.isExpired ? 'text-[color:var(--danger)]' : 'text-[color:var(--warning)]'}`}>
                            {new Date(i.expiryDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="text-right">
                            <Badge tone={i.isExpired ? 'danger' : 'warning'}>
                              {i.daysToExpiry < 0 ? `${Math.abs(i.daysToExpiry)}d expired` : `${i.daysToExpiry}d left`}
                            </Badge>
                          </td>
                          <td className={muted}>{i.location}</td>
                          <td className="text-right font-bold text-[color:var(--accent-strong)]">₹{(i.stockValue || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )
      )}

      {/* Locations view */}
      {view === 'locations' && (
        loading && !locations ? (
          <Card><Loading label="Loading locations" /></Card>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Locations" value={locs.length} icon={MapPin} tone="primary" />
              <Stat label="Total items" value={locs.reduce((s, l) => s + l.itemCount, 0)} icon={Package} tone="info" />
              <Stat label="Total value" value={`₹${(locs.reduce((s, l) => s + l.totalValue, 0) / 1000).toFixed(1)}k`} icon={CheckCircle} tone="success" />
              <Stat label="Low stock" value={locs.reduce((s, l) => s + l.lowStockCount, 0)} icon={AlertTriangle} tone="danger" />
            </div>

            {locs.length === 0 && (
              <Card>
                <EmptyState icon={MapPin} title="No location data">Add inventory items with locations.</EmptyState>
              </Card>
            )}

            {locs.map(loc => (
              <Card key={loc.location}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left hover:bg-[color:var(--surface-hover)]"
                  onClick={() => setExpandedLoc(expandedLoc === loc.location ? null : loc.location)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-[6px] bg-[color:var(--primary-soft)]">
                      <MapPin className="size-4 text-[color:var(--primary)]" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold">{loc.location}</h3>
                      <p className={`mt-0.5 text-[12px] ${muted}`}>
                        {loc.itemCount} SKUs · ₹{loc.totalValue.toLocaleString('en-IN')} value
                        {loc.lowStockCount > 0 && <Badge tone="danger" className="ml-2">{loc.lowStockCount} low</Badge>}
                      </p>
                    </div>
                  </div>
                  {expandedLoc === loc.location ? <ChevronUp className={`size-4 ${muted}`} /> : <ChevronDown className={`size-4 ${muted}`} />}
                </button>

                {expandedLoc === loc.location && (
                  <div className="border-t border-[color:var(--border)] p-3">
                    <div className="grid-box">
                      <table>
                        <thead>
                          <tr>
                            <th className="text-left">SKU</th>
                            <th className="text-left">Product</th>
                            <th className="text-right">Stock</th>
                            <th className="text-left">Batch</th>
                            <th className="text-left">Expiry</th>
                            <th className="text-right">Value</th>
                            <th className="text-center">Transfer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loc.items?.map((item, idx) => {
                            const fullItem = items.find(i => i.sku === item.sku && i.location === item.location);
                            return (
                              <tr key={idx}>
                                <td className={`font-mono text-[12px] ${muted}`}>{item.sku}</td>
                                <td className="whitespace-nowrap font-bold">{item.productName}</td>
                                <td className="whitespace-nowrap text-right">
                                  <span className={`font-bold ${item.isLowStock ? 'text-[color:var(--danger)]' : ''}`}>
                                    {item.currentStock} {item.unit}
                                  </span>
                                  {item.isLowStock && <AlertTriangle size={11} className="ml-1 inline text-[color:var(--danger)]" />}
                                </td>
                                <td className={`font-mono text-[12px] ${muted}`}>{item.batchNumber || '—'}</td>
                                <td className={muted}>
                                  {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td className="text-right font-bold">₹{item.stockValue?.toLocaleString('en-IN')}</td>
                                <td className="text-center">
                                  {fullItem && (
                                    <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" onClick={() => onTransfer(fullItem)}>
                                      <ArrowRightLeft className="size-3" /> Move
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── SKU Generator Widget ──────────────────────────────────────────────────────

function SkuGeneratorWidget({ dispatch, categories }) {
  const [name, setName]     = useState('');
  const [cat, setCat]       = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!name) { toast.error('Enter a product name'); return; }
    setLoading(true);
    const res = await dispatch(generateSku({ name, category: cat || categories[0]?.slug || '' }));
    if (generateSku.fulfilled.match(res)) setResult(res.payload?.sku || '');
    else toast.error(res.payload || 'Failed to generate');
    setLoading(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Product name" className="min-w-36 flex-1">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Garam Masala" className={inp} />
      </Field>
      <Field label="Category" className="min-w-36">
        <select value={cat || categories[0]?.slug || ''} onChange={e => setCat(e.target.value)} className={inp}>
          {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </Field>
      <Button onClick={handleGenerate} loading={loading}>
        {!loading && <Zap className="size-3.5" />} {loading ? 'Generating…' : 'Generate SKU'}
      </Button>
      {result && (
        <div className="flex h-9 items-center gap-2 rounded-[6px] border border-[color:var(--primary)] bg-[color:var(--primary-soft)] px-3">
          <span className="font-mono text-[13px] font-bold text-[color:var(--primary)]">{result}</span>
          <IconButton label="Copy SKU" tone="primary" onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied!'); }}>
            <Copy className="size-3.5" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

// ── Insights: website availability + recent stock-in ─────────────────────────
// Product.InStock on the website follows inventory automatically (0 stock → out of stock) unless an
// admin marked the product out of stock by hand. Products without an inventory row are sold as in stock.
const INSIGHT_DAYS = [7, 30, 90];
const fmtDT = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function InsightsTab({ onAdjust, reloadKey }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showUntracked, setShowUntracked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/inventory/insights', { params: { days } });
      setData(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load stock insights');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/admin/inventory/sync-stock');
      toast.success(res.data.message || 'Website stock synced');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const t = data?.totals;
  const adjustable = (r) => r.inventoryItemId > 0;
  const toAdjust = (r) => ({ id: r.inventoryItemId, productName: r.productName, sku: r.sku, currentStock: r.currentStock, unit: r.unit });

  return (
    <div className="space-y-4">
      <Toolbar>
        <Segmented options={INSIGHT_DAYS.map(d => ({ value: d, label: `${d} days` }))} value={days} onChange={setDays} size="sm" />
        <div className="ml-auto flex items-center gap-2">
          {t?.mismatched > 0 && <Badge tone="warning">{t.mismatched} product(s) out of sync</Badge>}
          <Button size="sm" variant="secondary" onClick={sync} loading={syncing}><Globe className="size-3.5" /> Re-sync website stock</Button>
          <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button>
        </div>
      </Toolbar>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Tracked SKUs" value={t?.skus ?? 0} hint={`${t?.products ?? 0} products in catalog`} icon={Package} tone="info" loading={loading && !data} />
        <Stat label="In stock (healthy)" value={t?.inStock ?? 0} hint="Above reorder point" icon={PackageCheck} tone="success" loading={loading && !data} />
        <Stat label="Low stock" value={t?.lowStock ?? 0} hint="At or below reorder point" icon={AlertTriangle} tone="warning" loading={loading && !data} />
        <Stat label="Out of stock" value={t?.outOfStock ?? 0} hint={`${t?.manualOutOfStock ?? 0} marked manually`} icon={PackageX} tone="danger" loading={loading && !data} />
        <Stat label="Unavailable on website" value={t?.websiteOutOfStock ?? 0} hint="Customers see “Out of stock”" icon={Globe} tone="danger" loading={loading && !data} />
        <Stat label={`Stock-in (${days}d)`} value={t?.stockInQuantity ?? 0} hint={`${t?.stockInEntries ?? 0} entries`} icon={Truck} tone="primary" loading={loading && !data} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Out of stock (${data?.outOfStock?.length ?? 0})`} bodyClassName="p-0">
          {loading && !data ? <Loading label="Loading out of stock" /> : !data?.outOfStock?.length ? (
            <EmptyState icon={PackageCheck} title="Nothing is out of stock" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[color:var(--border)] text-left text-[12px] text-[color:var(--text-muted)]">
                  <th className="px-3 py-2">Product</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Why</th><th className="px-3 py-2">Website</th><th className="px-3 py-2" />
                </tr></thead>
                <tbody>
                  {data.outOfStock.map(r => (
                    <tr key={`${r.productId}-${r.inventoryItemId}`} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="px-3 py-2">
                        <Link to={`/product/${r.productSlug}`} target="_blank" className="font-bold text-[color:var(--primary)] hover:underline">{r.productName}</Link>
                        {r.sku && <div className={`text-[12px] ${muted}`}>{r.sku}{r.location ? ` · ${r.location}` : ''}</div>}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.inventoryItemId ? `${r.currentStock} ${r.unit}` : '—'}</td>
                      <td className="px-3 py-2"><Badge tone={r.reason === 'Inventory' ? 'danger' : 'warning'}>{r.reason}</Badge></td>
                      <td className="px-3 py-2"><Badge tone={r.websiteInStock ? 'success' : 'danger'}>{r.websiteInStock ? 'In stock' : 'Out of stock'}</Badge></td>
                      <td className="px-3 py-2 text-right">
                        {adjustable(r)
                          ? <Button size="sm" variant="secondary" onClick={() => onAdjust(toAdjust(r))}><Plus className="size-3.5" /> Add stock</Button>
                          : <Link to="/admin/products" className="text-[12px] font-bold text-[color:var(--primary)] hover:underline">Products →</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={`Low stock (${data?.lowStock?.length ?? 0})`} actions={<Link to="/admin/purchase" className="text-[12px] font-bold text-[color:var(--primary)] hover:underline">Create purchase order →</Link>} bodyClassName="p-0">
          {loading && !data ? <Loading label="Loading low stock" /> : !data?.lowStock?.length ? (
            <EmptyState icon={CheckCircle} title="No items at or below their reorder point" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[color:var(--border)] text-left text-[12px] text-[color:var(--text-muted)]">
                  <th className="px-3 py-2">Product</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Reorder at</th><th className="px-3 py-2" />
                </tr></thead>
                <tbody>
                  {data.lowStock.map(r => (
                    <tr key={r.inventoryItemId} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="px-3 py-2"><div className="font-bold">{r.productName}</div><div className={`text-[12px] ${muted}`}>{r.sku} · {r.location}</div></td>
                      <td className="px-3 py-2 font-bold tabular-nums text-[color:var(--warning)]">{r.currentStock} {r.unit}</td>
                      <td className="px-3 py-2 tabular-nums">{r.reorderPoint}</td>
                      <td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => onAdjust(toAdjust(r))}><Plus className="size-3.5" /> Add stock</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={`Recent stock-in (last ${days} days)`} className="xl:col-span-2" bodyClassName="p-0">
          {loading && !data ? <Loading label="Loading stock-in" /> : !data?.recentStockIn?.length ? (
            <EmptyState icon={Truck} title="No stock received in this period">GRNs, manual additions, opening balances and returns appear here.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[color:var(--border)] text-left text-[12px] text-[color:var(--text-muted)]">
                  <th className="px-3 py-2">When</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Reference</th>
                </tr></thead>
                <tbody>
                  {data.recentStockIn.map(l => (
                    <tr key={l.id} className="border-b border-[color:var(--border)] last:border-0">
                      <td className={`px-3 py-2 whitespace-nowrap ${muted}`}>{fmtDT(l.createdAt)}</td>
                      <td className="px-3 py-2"><div className="font-bold">{l.productName}</div><div className={`text-[12px] ${muted}`}>{l.sku}</div></td>
                      <td className="px-3 py-2"><Badge tone={l.type === 'GRNReceipt' ? 'info' : 'success'}>{l.type === 'GRNReceipt' ? 'GRN' : l.type}</Badge></td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-[color:var(--success)]">+{l.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.balanceAfter}</td>
                      <td className={`px-3 py-2 text-[12px] ${muted}`}>{l.referenceId || l.reason || '—'}{l.performedBy ? ` · ${l.performedBy}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent GRNs" actions={<Link to="/admin/purchase" className="text-[12px] font-bold text-[color:var(--primary)] hover:underline">Purchase →</Link>} bodyClassName="p-0">
          {loading && !data ? <Loading label="Loading GRNs" /> : !data?.recentGrns?.length ? (
            <EmptyState icon={Truck} title="No goods received in this period" />
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {data.recentGrns.map(g => (
                <li key={g.id} className="px-3 py-2 text-[13px]">
                  <div className="flex items-center justify-between gap-2"><b>{g.grnNumber}</b><span className={`text-[12px] ${muted}`}>{fmtDT(g.receivedAt)}</span></div>
                  <div className={`text-[12px] ${muted}`}>{g.vendorName} · PO {g.poNumber} · {g.receivedQty} units in {g.items} line(s)</div>
                  {g.linkedToInventory < g.items && <div className="text-[12px] text-[color:var(--warning)]">{g.items - g.linkedToInventory} line(s) not linked to inventory — stock not updated</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title={`Not tracked in inventory (${data?.untracked?.length ?? 0})`}
        actions={<Button size="sm" variant="tertiary" onClick={() => setShowUntracked(v => !v)}>{showUntracked ? 'Hide' : 'Show'}</Button>}
        bodyClassName={showUntracked ? 'p-0' : 'px-3 py-2'}
      >
        {!showUntracked ? (
          <p className={`text-[13px] ${muted}`}>Products without an inventory item are sold as in stock unless you mark them out of stock on the Products page. Add them to inventory to have the website follow real stock.</p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <tbody>
                {(data?.untracked || []).map(p => (
                  <tr key={p.productId} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="px-3 py-1.5 font-bold">{p.productName}{p.isDraft && <Badge className="ml-2">Draft</Badge>}</td>
                    <td className={`px-3 py-1.5 text-[12px] ${muted}`}>{p.categorySlug}</td>
                    <td className="px-3 py-1.5 text-right"><Badge tone={p.websiteInStock ? 'success' : 'danger'}>{p.websiteInStock ? 'In stock' : p.manualOutOfStock ? 'Marked out of stock' : 'Out of stock'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
