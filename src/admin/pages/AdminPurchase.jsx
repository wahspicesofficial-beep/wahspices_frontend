import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SkPageHeader, SkTable } from '@/components/ui/Skeleton';
import {
  fetchVendors, createVendor,
  fetchPurchaseOrders, createPurchaseOrder, updatePoStatus, deletePurchaseOrder,
  fetchGrn, createGrn,
  fetchVendorPayments, createVendorPayment,
  fetchPriceHistory, addPriceHistory,
  fetchPurchaseReturns, createPurchaseReturn, updateReturnStatus,
  fetchAdminInventory,
} from '@/store/slices/adminSlice';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Truck, CreditCard, RotateCcw, Building2, TrendingUp,
  Plus, Star, Phone, Mail, Landmark, Trash2, X, MapPin,
} from 'lucide-react';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Badge, statusTone, Button, IconButton, Tabs,
  EmptyState, usePagination, Pagination, DialogPanel, Field,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';
import api from '@/services/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'orders',   label: 'Purchase orders', icon: ShoppingCart },
  { key: 'grn',      label: 'GRN',             icon: Truck },
  { key: 'payments', label: 'Payments',        icon: CreditCard },
  { key: 'returns',  label: 'Returns',         icon: RotateCcw },
  { key: 'vendors',  label: 'Vendors',         icon: Building2 },
  { key: 'price',    label: 'Price history',   icon: TrendingUp },
];

const STATUS_TONE = {
  Draft:     'neutral',
  Pending:   'warning',
  Approved:  'info',
  Received:  'success',
  Cancelled: 'danger',
};

const emptyPoForm  = { vendorId: '', items: '', totalAmount: '', expectedDate: '', notes: '' };
const emptyVendor  = { name: '', phone: '', email: '', gstin: '', city: '', state: '', address: '', bankName: '', bankAccountNo: '', bankIfsc: '' };
const emptyGrn     = { purchaseOrderId: '', vendorInvoiceNo: '', invoiceDate: '', notes: '', gstType: '' };
// A GRN line goes to a finished inventory item (pcs) OR a raw material (kg/g → raw stock used for packing)
const emptyGrnItem = { inventoryItemId: '', rawMaterialId: '', unit: '', productName: '', quantity: 1, unitPrice: 0, gstRate: '' };
const emptyPayment = { vendorId: '', amount: '', mode: '', paymentRef: '', notes: '' };
const emptyPrice   = { vendorId: '', productName: '', unitPrice: '', unit: '', effectiveFrom: '' };
const emptyReturn  = { purchaseOrderId: '', reason: '', amount: '' };

const errMsg = (res, fallback) => res?.payload || res?.error?.message || fallback;

// ── Shared primitives ─────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children, footer, wide = false }) => (
  <AdminModal onClose={onClose}>
    <DialogPanel title={title} onClose={onClose} footer={footer} width={wide ? 'max-w-3xl' : 'max-w-lg'}>
      <div className="space-y-3">{children}</div>
    </DialogPanel>
  </AdminModal>
);

const inp = 'input-field w-full';
const cellInp = 'h-7 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-2 text-[12px]';
const muted = 'text-[color:var(--text-muted)]';
const rowBtn = '!h-7 !px-2 !text-[12px]';

const fmt     = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '—';

/* Grid + pagination wrapper used by every list tab */
function GridList({ list, noun, icon, emptyTitle, emptyHint, head, row }) {
  const pg = usePagination(list, 20);
  return (
    <Card bodyClassName="p-3">
      {list.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle}>{emptyHint}</EmptyState>
      ) : (
        <>
          <div className="grid-box">
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminPurchase() {
  const dispatch        = useDispatch();
  const { vendors, orders, grn, payments, priceHistory, returns } = useSelector(s => s.admin.purchase);
  const inventoryItems  = useSelector(s => s.admin.inventory.items);
  const loading         = useSelector(s => s.admin.loading);
  const lk              = useLookups();
  const gstSlabs        = lk.list('GstSlab');
  const gstTypes        = lk.list('GstSupplyType').filter(t => t.value !== 'Export');
  const payModes        = lk.list('PaymentMode');
  const units           = lk.list('Unit');
  const defaultGst      = gstSlabs.find(g => g.value === '5')?.value ?? gstSlabs[0]?.value ?? '0';

  const [tab, setTab]         = useState('orders');
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [grnItems, setGrnItems] = useState([{ ...emptyGrnItem }]);
  const [rawMaterials, setRawMaterials] = useState([]);

  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    dispatch(fetchVendors());
    dispatch(fetchPurchaseOrders({ limit: 500 }));
  }, [dispatch]);

  useEffect(() => {
    if (tab === 'grn') {
      dispatch(fetchGrn({ limit: 500 }));
      dispatch(fetchAdminInventory({ limit: 1000 }));
      api.get('/admin/packing/raw-materials').then(r => setRawMaterials(r.data.data || [])).catch(() => setRawMaterials([]));
    }
    if (tab === 'payments') dispatch(fetchVendorPayments({ limit: 500 }));
    if (tab === 'returns')  dispatch(fetchPurchaseReturns({ limit: 500 }));
    if (tab === 'price')    dispatch(fetchPriceHistory());
  }, [tab, dispatch]);

  const openModal  = (name, defaults = {}) => { setForm(defaults); setModal(name); };
  const closeModal = () => { setModal(null); setGrnItems([{ ...emptyGrnItem }]); };

  // Runs a create thunk: keeps the modal open and shows the backend message on failure
  const submit = async (thunk, payload, okMsg, after) => {
    setSaving(true);
    const res = await dispatch(thunk(payload));
    setSaving(false);
    if (thunk.fulfilled.match(res)) {
      toast.success(okMsg);
      closeModal();
      after?.(res.payload);
    } else {
      toast.error(errMsg(res, 'Could not save'));
    }
  };

  const savePo = () => {
    if (!form.vendorId) return toast.error('Select a vendor');
    if (form.totalAmount !== '' && Number(form.totalAmount) < 0) return toast.error('Total amount cannot be negative');
    return submit(createPurchaseOrder, {
      vendorId: Number(form.vendorId), items: form.items || '',
      totalAmount: Number(form.totalAmount) || 0,
      expectedDate: form.expectedDate || null, notes: form.notes || '',
    }, 'Purchase order created');
  };

  const saveVendor = () => {
    if (!form.name?.trim()) return toast.error('Vendor name is required');
    if (!form.phone?.trim()) return toast.error('Phone is required');
    if (form.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(form.gstin.trim())) return toast.error('GSTIN must be 15 characters (e.g. 27AAAAA0000A1Z5)');
    return submit(createVendor, { ...form, name: form.name.trim(), phone: form.phone.trim(), gstin: form.gstin?.trim().toUpperCase() || null }, 'Vendor added');
  };

  const saveGrn = async () => {
    if (!form.purchaseOrderId) { toast.error('Select a purchase order'); return; }
    const validItems = grnItems.filter(it => (it.inventoryItemId || it.rawMaterialId) && Number(it.quantity) > 0);
    if (validItems.length === 0) { toast.error('Add at least one item (inventory item or raw material) with a quantity'); return; }
    if (validItems.some(it => !Number.isInteger(Number(it.quantity)))) { toast.error('Quantities must be whole numbers'); return; }
    if (validItems.some(it => Number(it.unitPrice) < 0)) { toast.error('Unit price cannot be negative'); return; }

    const gstOf = it => Number(it.gstRate === '' ? defaultGst : it.gstRate);
    const taxableTotal = validItems.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity), 0);
    const gstTotal     = validItems.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity) * gstOf(it) / 100, 0);
    const invOf = it => inventoryItems.find(inv => inv.id === Number(it.inventoryItemId));
    const rawOf = it => rawMaterials.find(r => r.id === Number(it.rawMaterialId));

    setSaving(true);
    const res = await dispatch(createGrn({
      purchaseOrderId: Number(form.purchaseOrderId),
      vendorInvoiceNo: form.vendorInvoiceNo || '',
      invoiceDate:     form.invoiceDate || null,
      invoiceAmount:   taxableTotal + gstTotal,
      taxableAmount:   taxableTotal,
      gstAmount:       gstTotal,
      gstType:         form.gstType || gstTypes[0]?.value || 'IntraState',
      notes:           form.notes || '',
      items: validItems.map(it => ({
        inventoryItemId: it.inventoryItemId ? Number(it.inventoryItemId) : null,
        rawMaterialId:   it.rawMaterialId ? Number(it.rawMaterialId) : null,
        productName:     it.productName || invOf(it)?.productName || rawOf(it)?.name || '',
        unit:            it.rawMaterialId ? (it.unit || 'kg') : (invOf(it)?.unit || 'pcs'),
        quantity:        Number(it.quantity),
        orderedQty:      Number(it.quantity),
        receivedQty:     Number(it.quantity),
        unitPrice:       Number(it.unitPrice),
        gstRate:         gstOf(it),
      })),
    }));
    setSaving(false);

    if (createGrn.fulfilled.match(res)) {
      const p = res.payload;
      const itcMsg = p?.autoItcCreated ? ' ITC entry auto-created.' : '';
      toast.success(`GRN ${p?.grnNumber || ''} created. Stock updated for ${p?.inventoryUpdated ?? 0} item(s).${itcMsg}`);
      closeModal();
      dispatch(fetchGrn({ limit: 500 }));
      dispatch(fetchAdminInventory({ limit: 1000 }));
      dispatch(fetchPurchaseOrders({ limit: 500 }));
      dispatch(fetchVendors());
    } else {
      toast.error(errMsg(res, 'Failed to create GRN'));
    }
  };

  const savePayment = () => {
    if (!form.vendorId) return toast.error('Select a vendor');
    if (!(Number(form.amount) > 0)) return toast.error('Enter an amount greater than zero');
    return submit(createVendorPayment, {
      vendorId: Number(form.vendorId), amount: Number(form.amount),
      mode: form.mode || payModes[0]?.value || 'NEFT', paymentRef: form.paymentRef || '', notes: form.notes || '',
    }, 'Payment recorded', () => dispatch(fetchVendors()));
  };

  const savePrice = () => {
    if (!form.vendorId) return toast.error('Select a vendor');
    if (!form.productName?.trim()) return toast.error('Product name is required');
    if (!(Number(form.unitPrice) > 0)) return toast.error('Enter a price greater than zero');
    return submit(addPriceHistory, {
      vendorId: Number(form.vendorId), productName: form.productName.trim(),
      unitPrice: Number(form.unitPrice), unit: form.unit || units[0]?.value || 'kg',
      effectiveFrom: form.effectiveFrom || null,
    }, 'Price added');
  };

  const saveReturn = () => {
    if (!form.purchaseOrderId) return toast.error('Select a purchase order');
    if (!form.reason?.trim()) return toast.error('Reason is required');
    if (form.amount !== '' && Number(form.amount) < 0) return toast.error('Amount cannot be negative');
    return submit(createPurchaseReturn, {
      purchaseOrderId: Number(form.purchaseOrderId),
      reason: form.reason.trim(), amount: Number(form.amount) || 0,
    }, 'Purchase return created');
  };

  const handleStatus = async (id, status) => {
    const res = await dispatch(updatePoStatus({ id, status }));
    if (updatePoStatus.fulfilled.match(res)) toast.success(`PO marked ${status}`);
    else toast.error(errMsg(res, 'Could not update PO'));
  };
  const handleReturnStatus = async (id, status) => {
    const res = await dispatch(updateReturnStatus({ id, status }));
    if (updateReturnStatus.fulfilled.match(res)) {
      toast.success(`Return ${status.toLowerCase()}`);
      if (status === 'Approved') dispatch(fetchVendors());
    } else toast.error(errMsg(res, 'Could not update return'));
  };
  const handleDeletePo = async id => {
    if (!window.confirm('Delete this PO?')) return;
    const res = await dispatch(deletePurchaseOrder(id));
    if (deletePurchaseOrder.fulfilled.match(res)) toast.success('PO deleted');
    else toast.error(errMsg(res, 'Could not delete PO'));
  };

  if (loading && !orders.length) return (
    <div className="space-y-6"><SkPageHeader /><SkTable rows={7} cols={6} /></div>
  );

  // Per-tab CTA config
  const CTA = {
    orders:   { label: 'New PO',         action: () => openModal('po', emptyPoForm) },
    grn:      { label: 'New GRN',        action: () => openModal('grn', emptyGrn) },
    payments: { label: 'Record payment', action: () => openModal('payment', emptyPayment) },
    returns:  { label: 'New return',     action: () => openModal('return', emptyReturn) },
    vendors:  { label: 'Add vendor',     action: () => openModal('vendor', emptyVendor) },
    price:    { label: 'Add price',      action: () => openModal('price', emptyPrice) },
  };

  const footer = onSave => (
    <>
      <Button variant="secondary" onClick={closeModal}>Cancel</Button>
      <Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </>
  );

  const counts = { orders: orders.length, grn: grn.length, payments: payments.length, returns: returns.length, vendors: vendors.length, price: priceHistory.length };

  return (
    <div className="space-y-4">

      <PageHeader
        title="Purchases"
        description="Vendors · orders · GRN · payments · returns"
        actions={CTA[tab] && (
          <Button onClick={CTA[tab].action}><Plus className="size-4" />{CTA[tab].label}</Button>
        )}
      />

      <Tabs items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon, count: counts[t.key] || undefined }))} value={tab} onChange={setTab} />

      {/* ── Purchase Orders ──────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <GridList
          list={orders} noun="orders" icon={ShoppingCart} emptyTitle="No purchase orders yet" emptyHint="Create a PO to order from a vendor."
          head={<>
            <th className="text-left">PO number</th>
            <th className="text-left">Vendor</th>
            <th className="text-right">Total</th>
            <th className="text-left">Expected date</th>
            <th className="text-left">Status</th>
            <th className="text-left">GRN</th>
            <th className="text-left">Actions</th>
          </>}
          row={po => (
            <tr key={po.id}>
              <td className="font-bold">{po.poNumber}</td>
              <td className="text-[color:var(--text-secondary)]">{po.vendorName}</td>
              <td className="text-right font-bold text-[color:var(--primary)]">{fmt(po.totalAmount)}</td>
              <td className={muted}>{fmtDate(po.expectedDate)}</td>
              <td><Badge tone={STATUS_TONE[po.status] || 'neutral'}>{po.status}</Badge></td>
              <td>{po.isGrnDone ? <Badge tone="success">Done</Badge> : <Badge>Pending</Badge>}</td>
              <td>
                <div className="flex flex-wrap items-center gap-1">
                  {po.status === 'Draft' && (
                    <Button size="sm" variant="secondary" className={rowBtn} onClick={() => handleStatus(po.id, 'Pending')}>Send</Button>
                  )}
                  {po.status === 'Pending' && (
                    <Button size="sm" variant="secondary" className={rowBtn} onClick={() => handleStatus(po.id, 'Approved')}>Approve</Button>
                  )}
                  {(po.status === 'Approved' || po.status === 'Pending') && (
                    <Button size="sm" className={rowBtn} onClick={() => handleStatus(po.id, 'Received')}>Received</Button>
                  )}
                  {po.status !== 'Cancelled' && po.status !== 'Received' && (
                    <Button size="sm" variant="danger" className={rowBtn} onClick={() => handleStatus(po.id, 'Cancelled')}>Cancel</Button>
                  )}
                  {!po.isGrnDone && (
                    <IconButton label="Delete PO" tone="danger" onClick={() => handleDeletePo(po.id)}><Trash2 className="size-3.5" /></IconButton>
                  )}
                </div>
              </td>
            </tr>
          )}
        />
      )}

      {/* ── GRN ─────────────────────────────────────────────────────────── */}
      {tab === 'grn' && (
        <GridList
          list={grn} noun="GRNs" icon={Truck} emptyTitle="No GRN records yet" emptyHint="Record goods received against a pending or approved PO."
          head={<>
            <th className="text-left">GRN #</th>
            <th className="text-left">PO number</th>
            <th className="text-left">Vendor</th>
            <th className="text-left">Invoice no</th>
            <th className="text-right">Invoice amount</th>
            <th className="text-left">Received</th>
          </>}
          row={g => (
            <tr key={g.id}>
              <td className="font-bold">{g.grnNumber}</td>
              <td className="text-[color:var(--text-secondary)]">{g.poNumber}</td>
              <td className="text-[color:var(--text-secondary)]">{g.vendorName}</td>
              <td className={muted}>{g.vendorInvoiceNo || '—'}</td>
              <td className="text-right font-bold text-[color:var(--primary)]">{fmt(g.invoiceAmount)}</td>
              <td className={muted}>{fmtDate(g.receivedAt)}</td>
            </tr>
          )}
        />
      )}

      {/* ── Payments ─────────────────────────────────────────────────────── */}
      {tab === 'payments' && (
        <GridList
          list={payments} noun="payments" icon={CreditCard} emptyTitle="No payments recorded yet"
          head={<>
            <th className="text-left">Vendor</th>
            <th className="text-right">Amount</th>
            <th className="text-left">Mode</th>
            <th className="text-left">Reference</th>
            <th className="text-left">Notes</th>
            <th className="text-left">Date</th>
          </>}
          row={p => (
            <tr key={p.id}>
              <td className="font-bold">{p.vendorName}</td>
              <td className="text-right font-bold text-[color:var(--primary)]">{fmt(p.amount)}</td>
              <td><Badge tone="info">{p.mode}</Badge></td>
              <td className={muted}>{p.paymentRef || '—'}</td>
              <td className={`max-w-xs truncate ${muted}`}>{p.notes || '—'}</td>
              <td className={muted}>{fmtDate(p.paidAt)}</td>
            </tr>
          )}
        />
      )}

      {/* ── Returns ──────────────────────────────────────────────────────── */}
      {tab === 'returns' && (
        <GridList
          list={returns} noun="returns" icon={RotateCcw} emptyTitle="No returns yet"
          head={<>
            <th className="text-left">Return #</th>
            <th className="text-left">PO</th>
            <th className="text-left">Vendor</th>
            <th className="text-left">Reason</th>
            <th className="text-right">Amount</th>
            <th className="text-left">Status</th>
            <th className="text-left">Actions</th>
          </>}
          row={r => (
            <tr key={r.id}>
              <td className="font-bold">{r.returnNumber}</td>
              <td className="text-[color:var(--text-secondary)]">{r.poNumber}</td>
              <td className="text-[color:var(--text-secondary)]">{r.vendorName}</td>
              <td className={`max-w-xs truncate ${muted}`}>{r.reason}</td>
              <td className="text-right font-bold">{fmt(r.amount)}</td>
              <td><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
              <td>
                {r.status === 'Pending' && (
                  <div className="flex gap-1">
                    <Button size="sm" className={rowBtn} onClick={() => handleReturnStatus(r.id, 'Approved')}>Approve</Button>
                    <Button size="sm" variant="danger" className={rowBtn} onClick={() => handleReturnStatus(r.id, 'Rejected')}>Reject</Button>
                  </div>
                )}
              </td>
            </tr>
          )}
        />
      )}

      {/* ── Vendors ──────────────────────────────────────────────────────── */}
      {tab === 'vendors' && (
        vendors.length === 0 ? (
          <Card><EmptyState icon={Building2} title="No vendors yet">Add one to get started.</EmptyState></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map(v => (
              <Card
                key={v.id}
                title={v.name}
                actions={v.rating > 0 && <Badge tone="accent"><Star size={11} fill="currentColor" /> {v.rating}</Badge>}
                bodyClassName="p-3.5 space-y-2 text-[13px]"
              >
                {(v.city || v.state) && (
                  <div className={`flex items-center gap-2 ${muted}`}>
                    <MapPin size={13} /> {v.city}{v.state ? `, ${v.state}` : ''}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[color:var(--text-secondary)]">
                  <Phone size={13} className={muted} /> {v.phone}
                </div>
                {v.email && (
                  <div className="flex items-center gap-2 text-[color:var(--text-secondary)]">
                    <Mail size={13} className={muted} /> {v.email}
                  </div>
                )}
                {v.gstin && (
                  <div className={`rounded-[4px] bg-[color:var(--surface-secondary)] px-2 py-1 font-mono text-[12px] ${muted}`}>GSTIN: {v.gstin}</div>
                )}
                {v.bankName && (
                  <div className={`flex items-center gap-2 text-[12px] ${muted}`}>
                    <Landmark size={12} /> {v.bankName} — {v.bankAccountNo}
                  </div>
                )}
                {v.outstandingDues > 0 && (
                  <div className="rounded-[6px] border border-[rgba(176,56,47,0.25)] bg-[color:var(--danger-bg)] px-3 py-1.5 text-[12px] font-bold text-[color:var(--danger)]">
                    Outstanding: {fmt(v.outstandingDues)}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── Price History ─────────────────────────────────────────────────── */}
      {tab === 'price' && (
        <GridList
          list={priceHistory} noun="prices" icon={TrendingUp} emptyTitle="No price history yet"
          head={<>
            <th className="text-left">Vendor</th>
            <th className="text-left">Product</th>
            <th className="text-right">Unit price</th>
            <th className="text-left">Unit</th>
            <th className="text-left">Effective from</th>
          </>}
          row={p => (
            <tr key={p.id}>
              <td className="font-bold">{p.vendorName}</td>
              <td>{p.productName}</td>
              <td className="text-right font-bold text-[color:var(--primary)]">{fmt(p.unitPrice)}</td>
              <td><Badge>/ {p.unit}</Badge></td>
              <td className={muted}>{fmtDate(p.effectiveFrom)}</td>
            </tr>
          )}
        />
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {modal === 'po' && (
        <Modal title="New purchase order" onClose={closeModal} footer={footer(savePo)}>
          <Field label="Vendor" required>
            <select className={inp} value={form.vendorId} onChange={f('vendorId')}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Items description">
            <textarea className={`${inp} resize-none`} rows={3} value={form.items} onChange={f('items')} placeholder="List items (optional)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total amount (₹)">
              <input type="number" className={inp} value={form.totalAmount} onChange={f('totalAmount')} />
            </Field>
            <Field label="Expected date">
              <input type="date" className={inp} value={form.expectedDate} onChange={f('expectedDate')} />
            </Field>
          </div>
          <Field label="Notes">
            <input className={inp} value={form.notes} onChange={f('notes')} placeholder="Optional notes" />
          </Field>
        </Modal>
      )}

      {modal === 'vendor' && (
        <Modal title="Add vendor" onClose={closeModal} footer={footer(saveVendor)}>
          <Field label="Name" required>
            <input className={inp} value={form.name} onChange={f('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" required>
              <input className={inp} value={form.phone} onChange={f('phone')} />
            </Field>
            <Field label="Email">
              <input className={inp} value={form.email} onChange={f('email')} />
            </Field>
            <Field label="GSTIN">
              <input className={inp} value={form.gstin} onChange={f('gstin')} placeholder="22AAAAA0000A1Z5" />
            </Field>
            <Field label="City">
              <input className={inp} value={form.city} onChange={f('city')} />
            </Field>
            <Field label="State">
              <input className={inp} value={form.state} onChange={f('state')} />
            </Field>
            <Field label="Address">
              <input className={inp} value={form.address} onChange={f('address')} />
            </Field>
          </div>
          <p className="border-t border-[color:var(--border)] pt-3 text-[12px] font-bold text-[color:var(--text-secondary)]">Bank details</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank name">
              <input className={inp} value={form.bankName} onChange={f('bankName')} />
            </Field>
            <Field label="Account no">
              <input className={inp} value={form.bankAccountNo} onChange={f('bankAccountNo')} />
            </Field>
            <Field label="IFSC code">
              <input className={inp} value={form.bankIfsc} onChange={f('bankIfsc')} />
            </Field>
          </div>
        </Modal>
      )}

      {modal === 'grn' && (
        <Modal title="New GRN — goods receipt note" onClose={closeModal} wide footer={footer(saveGrn)}>
          {/* PO + Invoice header */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Purchase order" required className="col-span-2">
              <select className={inp} value={form.purchaseOrderId} onChange={f('purchaseOrderId')}>
                <option value="">Select PO…</option>
                {orders.filter(o => ['Pending', 'Approved'].includes(o.status)).map(o => (
                  <option key={o.id} value={o.id}>{o.poNumber} — {o.vendorName}</option>
                ))}
              </select>
            </Field>
            <Field label="Invoice date">
              <input type="date" className={inp} value={form.invoiceDate || ''} onChange={f('invoiceDate')} />
            </Field>
            <Field label="Vendor invoice no" className="col-span-2">
              <input className={inp} value={form.vendorInvoiceNo || ''} onChange={f('vendorInvoiceNo')} placeholder="e.g. INV-2024-001" />
            </Field>
            <Field label="GST type">
              <select className={inp} value={form.gstType || gstTypes[0]?.value || ''} onChange={f('gstType')}>
                {lookupOptions(gstTypes, form.gstType).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <input className={inp} value={form.notes || ''} onChange={f('notes')} placeholder="Optional" />
            </Field>
          </div>

          {/* Items received */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-[color:var(--text-secondary)]">Items received <span className="text-[color:var(--danger)]">*</span></p>
              <Button size="sm" variant="tertiary" onClick={() => setGrnItems(p => [...p, { ...emptyGrnItem }])}>
                <Plus className="size-3.5" /> Add row
              </Button>
            </div>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Item / raw material *</th>
                    <th className="text-left">Qty *</th>
                    <th className="text-left">Unit price (₹)</th>
                    <th className="text-left">GST %</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">GST amt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {grnItems.map((item, i) => {
                    const taxable = Number(item.unitPrice) * Number(item.quantity);
                    const gstAmt  = taxable * Number(item.gstRate === '' ? defaultGst : item.gstRate) / 100;
                    return (
                      <tr key={i}>
                        <td className="!px-1.5 !py-1">
                          <select
                            value={item.rawMaterialId ? `raw:${item.rawMaterialId}` : item.inventoryItemId ? `inv:${item.inventoryItemId}` : ''}
                            onChange={e => {
                              const [kind, id] = e.target.value.split(':');
                              const inv = kind === 'inv' ? inventoryItems.find(x => x.id === Number(id)) : null;
                              const raw = kind === 'raw' ? rawMaterials.find(x => x.id === Number(id)) : null;
                              setGrnItems(p => p.map((it, j) => j !== i ? it : {
                                ...it,
                                inventoryItemId: inv ? id : '',
                                rawMaterialId: raw ? id : '',
                                unit: raw ? (raw.displayUnit === 'g' ? 'g' : 'kg') : '',
                                productName: inv?.productName || raw?.name || '',
                                unitPrice: it.unitPrice || inv?.costPrice || (raw ? (raw.displayUnit === 'g' ? raw.costPerKg / 1000 : raw.costPerKg) : 0),
                              }));
                            }}
                            className={`${cellInp} w-44`}
                          >
                            <option value="">Select item…</option>
                            {rawMaterials.length > 0 && (
                              <optgroup label="Raw materials (stock in kg, used for packing)">
                                {rawMaterials.map(r => (
                                  <option key={`raw${r.id}`} value={`raw:${r.id}`}>{r.name} · {r.code} (stock: {Number(r.currentStockKg)} kg)</option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Finished inventory items">
                              {inventoryItems.map(inv => (
                                <option key={inv.id} value={`inv:${inv.id}`}>
                                  {inv.productName} · {inv.sku} (stock: {inv.currentStock} {inv.unit})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          {item.rawMaterialId && (
                            <select value={item.unit || 'kg'} aria-label="Unit"
                              onChange={e => setGrnItems(p => p.map((it, j) => j !== i ? it : { ...it, unit: e.target.value }))}
                              className={`${cellInp} ml-1 w-14`}>
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                            </select>
                          )}
                        </td>
                        <td className="!px-1.5 !py-1">
                          <input type="number" min="1" step="1"
                            value={item.quantity}
                            onChange={e => setGrnItems(p => p.map((it, j) => j !== i ? it : { ...it, quantity: e.target.value }))}
                            className={`${cellInp} w-16`}
                          />
                        </td>
                        <td className="!px-1.5 !py-1">
                          <input type="number" min="0" step="any"
                            value={item.unitPrice}
                            onChange={e => setGrnItems(p => p.map((it, j) => j !== i ? it : { ...it, unitPrice: e.target.value }))}
                            className={`${cellInp} w-20`}
                          />
                        </td>
                        <td className="!px-1.5 !py-1">
                          <select
                            value={item.gstRate === '' ? defaultGst : item.gstRate}
                            onChange={e => setGrnItems(p => p.map((it, j) => j !== i ? it : { ...it, gstRate: e.target.value }))}
                            className={`${cellInp} w-16`}
                          >
                            {lookupOptions(gstSlabs, item.gstRate).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </td>
                        <td className="text-right text-[color:var(--text-secondary)]">₹{taxable.toFixed(0)}</td>
                        <td className="text-right text-[color:var(--accent-strong)]">₹{gstAmt.toFixed(0)}</td>
                        <td className="!px-1 text-center">
                          {grnItems.length > 1 && (
                            <IconButton label="Remove row" tone="danger" onClick={() => setGrnItems(p => p.filter((_, j) => j !== i))}>
                              <X className="size-3.5" />
                            </IconButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="!px-3 !py-2 !text-left font-bold">Totals</td>
                    <td className="text-right font-bold">
                      ₹{grnItems.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity), 0).toFixed(2)}
                    </td>
                    <td className="text-right font-bold text-[color:var(--accent-strong)]">
                      ₹{grnItems.reduce((s, it) => s + (Number(it.unitPrice) * Number(it.quantity) * Number(it.gstRate === '' ? defaultGst : it.gstRate) / 100), 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className={`mt-1.5 text-[12px] ${muted}`}>
              After saving: inventory stock (or raw-material stock, for raw lines — unit price is per kg / g) will be auto-updated and ITC entry auto-created if GST &gt; 0.
            </p>
          </div>
        </Modal>
      )}

      {modal === 'payment' && (
        <Modal title="Record payment" onClose={closeModal} footer={footer(savePayment)}>
          <Field label="Vendor" required>
            <select className={inp} value={form.vendorId} onChange={f('vendorId')}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" required>
              <input type="number" className={inp} value={form.amount} onChange={f('amount')} />
            </Field>
            <Field label="Payment mode">
              <select className={inp} value={form.mode || payModes[0]?.value || ''} onChange={f('mode')}>
                {lookupOptions(payModes, form.mode).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Reference / UTR no">
            <input className={inp} value={form.paymentRef} onChange={f('paymentRef')} />
          </Field>
          <Field label="Notes">
            <input className={inp} value={form.notes} onChange={f('notes')} />
          </Field>
        </Modal>
      )}

      {modal === 'price' && (
        <Modal title="Add vendor price" onClose={closeModal} footer={footer(savePrice)}>
          <Field label="Vendor" required>
            <select className={inp} value={form.vendorId} onChange={f('vendorId')}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Product name" required>
            <input className={inp} value={form.productName} onChange={f('productName')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)" required>
              <input type="number" className={inp} value={form.unitPrice} onChange={f('unitPrice')} />
            </Field>
            <Field label="Unit">
              <select className={inp} value={form.unit || units[0]?.value || ''} onChange={f('unit')}>
                {lookupOptions(units, form.unit).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Effective from">
            <input type="date" className={inp} value={form.effectiveFrom} onChange={f('effectiveFrom')} />
          </Field>
        </Modal>
      )}

      {modal === 'return' && (
        <Modal title="Purchase return" onClose={closeModal} footer={footer(saveReturn)}>
          <Field label="Purchase order" required>
            <select className={inp} value={form.purchaseOrderId} onChange={f('purchaseOrderId')}>
              <option value="">Select PO…</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.poNumber} — {o.vendorName}</option>)}
            </select>
          </Field>
          <Field label="Reason" required>
            <textarea className={`${inp} resize-none`} rows={3} value={form.reason} onChange={f('reason')} placeholder="Reason for return…" />
          </Field>
          <Field label="Amount (₹)">
            <input type="number" className={inp} value={form.amount} onChange={f('amount')} />
          </Field>
        </Modal>
      )}
    </div>
  );
}
