import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SkPageHeader, SkTable } from '@/components/ui/Skeleton';
import {
  fetchSalesOrders, createSalesOrder, updateSalesOrderStatus, cancelSalesOrder,
  fetchSalesClients, createSalesClient, updateSalesClient, deleteSalesClient,
  fetchSalesBills, fetchSalesBillById, generateSalesBill, recordBillPayment,
} from '../../store/slices/adminSlice';
import { Package, Users, FileText, Plus, X, IndianRupee, Edit2, Trash2, Eye, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { useLookups, lookupOptions } from '@/admin/lookups';
import {
  PageHeader, Card, Stat, Badge, Tabs, Segmented, SearchInput, Toolbar, IconButton,
  EmptyState, DialogPanel, Button, Field, Pagination,
} from '@/admin/ui';

const inp = 'input-field';
// compact inputs for the order-entry item rows (inside the data grid)
const cellInp = 'input-field !h-7 !px-1.5 !py-0 !text-[12px]';

// Purely visual maps — the status values themselves come from the SalesOrderStatus / SalesBillStatus enums
const STATUS_TONE = {
  Draft: 'neutral',
  Confirmed: 'info',
  Dispatched: 'warning',
  Delivered: 'success',
  Billed: 'accent',
  Cancelled: 'danger',
};
const PAY_TONE = {
  Unpaid: 'danger',
  PartialPaid: 'warning',
  Paid: 'success',
};

const TABS = [
  { value: 'orders', label: 'Orders', icon: Package },
  { value: 'clients', label: 'Clients', icon: Users },
  { value: 'bills', label: 'Bills', icon: FileText },
];

const errMsg = (res, fallback) => res?.payload || res?.error?.message || fallback;

// ── Order Modal ───────────────────────────────────────────────────────────────
function OrderModal({ clients, onClose, onSave }) {
  const lk = useLookups();
  const units = lk.list('Unit');
  const gstSlabs = lk.list('GstSlab');
  const clientTypes = lk.list('SalesClientType');
  const defaultUnit = units.find(u => u.value === 'kg')?.value ?? units[0]?.value ?? '';
  const defaultGst = gstSlabs.find(g => g.value === '5')?.value ?? gstSlabs[0]?.value ?? '0';
  const blankItem = () => ({ productName: '', hsnCode: '', unit: '', quantity: 1, unitPrice: 0, gstPercent: '' });
  const [form, setForm] = useState({ clientId: '', salespersonName: '', orderDate: new Date().toISOString().slice(0, 10), notes: '' });
  const [items, setItems] = useState([blankItem()]);
  const [newClient, setNewClient] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [ncForm, setNcForm] = useState({ name: '', phone: '', clientType: '' });
  const [saving, setSaving] = useState(false);
  // empty unit / GST on a row = the lookup default (works even if lookups load after the modal opens)
  const rowUnit = (row) => row.unit || defaultUnit;
  const rowGst = (row) => (row.gstPercent === '' ? defaultGst : row.gstPercent);

  const totals = useMemo(() => {
    const sub = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
    const gst = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0) * Number((i.gstPercent === '' ? defaultGst : i.gstPercent) || 0) / 100, 0);
    return { sub, gst, net: sub + gst };
  }, [items, defaultGst]);

  const addItem = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSave = async () => {
    if (!form.clientId) { toast.error('Select a client'); return; }
    if (!form.salespersonName.trim()) { toast.error('Enter salesperson name'); return; }
    if (items.some(i => !i.productName.trim())) { toast.error('All items need a product name'); return; }
    if (items.some(i => !(Number(i.quantity) > 0))) { toast.error('Item quantity must be greater than zero'); return; }
    if (items.some(i => Number(i.unitPrice) < 0)) { toast.error('Item rate cannot be negative'); return; }
    setSaving(true);
    try {
      const payloadItems = items.map(i => ({
        productName: i.productName.trim(), hsnCode: i.hsnCode || null, unit: rowUnit(i),
        quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), gstPercent: Number(rowGst(i)),
      }));
      const isNew = form.clientId === '__new__';
      const ok = await onSave({ ...form, clientId: isNew ? '' : form.clientId, items: payloadItems, newClient: isNew ? newClient : null });
      if (ok) onClose();
    } finally { setSaving(false); }
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title="New Sales Order"
        onClose={onClose}
        width="max-w-3xl"
        footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{saving ? 'Saving...' : 'Create Order'}</Button>
        </>}
      >
        <div className="space-y-4">
          {/* Client select */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">Client</span>
              {showNewClient ? (
                <div className="space-y-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--accent-soft)] p-3">
                  <p className="text-[12px] font-bold text-[color:var(--accent-strong)]">New Client</p>
                  <input className={inp} placeholder="Name*" value={ncForm.name} onChange={e => setNcForm(p => ({ ...p, name: e.target.value }))} />
                  <input className={inp} placeholder="Phone" value={ncForm.phone} onChange={e => setNcForm(p => ({ ...p, phone: e.target.value }))} />
                  <select className={inp} value={ncForm.clientType || clientTypes[0]?.value || ''} onChange={e => setNcForm(p => ({ ...p, clientType: e.target.value }))}>
                    {lookupOptions(clientTypes, ncForm.clientType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!ncForm.name.trim()) { toast.error('Client name is required'); return; }
                      setNewClient({ ...ncForm, name: ncForm.name.trim(), clientType: ncForm.clientType || clientTypes[0]?.value });
                      setForm(p => ({ ...p, clientId: '__new__' }));
                      setShowNewClient(false);
                    }}>Confirm</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowNewClient(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select className={inp} value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                    <option value="">-- Select Client --</option>
                    {newClient && <option value="__new__">+ {newClient.name} (new)</option>}
                    {clients.filter(c => c.isActive !== false).map(c => <option key={c.id} value={c.id}>{c.name} ({lk.label('SalesClientType', c.clientType)})</option>)}
                  </select>
                  <Button variant="secondary" title="Create new client" aria-label="Create new client" onClick={() => setShowNewClient(true)}><Plus className="size-4" /></Button>
                </div>
              )}
            </div>
            <Field label="Salesperson">
              <input className={inp} placeholder="Salesperson name" value={form.salespersonName} onChange={e => setForm(p => ({ ...p, salespersonName: e.target.value }))} />
            </Field>
            <Field label="Order Date">
              <input type="date" className={inp} value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <input className={inp} placeholder="Optional notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold">Order Items</p>
              <Button size="sm" variant="tertiary" className="!h-7" onClick={addItem}><Plus className="size-3.5" /> Add Item</Button>
            </div>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Product</th>
                    <th className="w-20 text-left">HSN</th>
                    <th className="w-20 text-left">Unit</th>
                    <th className="w-20 text-right">Qty</th>
                    <th className="w-24 text-right">Rate</th>
                    <th className="w-20 text-right">GST%</th>
                    <th className="w-24 text-right">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => {
                    const amt = (Number(row.quantity) * Number(row.unitPrice) * (1 + Number(rowGst(row)) / 100)).toFixed(2);
                    return (
                      <tr key={i}>
                        <td className="!p-1"><input className={cellInp} placeholder="Product name" value={row.productName} onChange={e => updateItem(i, 'productName', e.target.value)} /></td>
                        <td className="!p-1"><input className={cellInp} placeholder="HSN" value={row.hsnCode} onChange={e => updateItem(i, 'hsnCode', e.target.value)} /></td>
                        <td className="!p-1">
                          <select className={cellInp} value={rowUnit(row)} onChange={e => updateItem(i, 'unit', e.target.value)}>
                            {lookupOptions(units, rowUnit(row)).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                          </select>
                        </td>
                        <td className="!p-1"><input type="number" min="0" step="any" className={`${cellInp} text-right`} value={row.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></td>
                        <td className="!p-1"><input type="number" min="0" step="any" className={`${cellInp} text-right`} value={row.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} /></td>
                        <td className="!p-1">
                          <select className={`${cellInp} text-right`} value={String(rowGst(row))} onChange={e => updateItem(i, 'gstPercent', e.target.value)}>
                            {lookupOptions(gstSlabs, String(rowGst(row))).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="text-right font-bold tabular-nums">₹{amt}</td>
                        <td className="!p-1 text-center">
                          {items.length > 1 && (
                            <IconButton label="Remove item" tone="danger" onClick={() => removeItem(i)}><X className="size-3.5" /></IconButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <div className="space-y-1 text-right text-[12px] tabular-nums">
                <div className="text-[color:var(--text-muted)]">Subtotal: <span className="font-bold text-[color:var(--text-primary)]">₹{totals.sub.toFixed(2)}</span></div>
                <div className="text-[color:var(--text-muted)]">GST: <span className="font-bold text-[color:var(--text-primary)]">₹{totals.gst.toFixed(2)}</span></div>
                <div className="text-[14px] font-bold text-[color:var(--primary)]">Net Total: ₹{totals.net.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

// ── Bill Detail Modal ─────────────────────────────────────────────────────────
function BillDetailModal({ bill, onClose, onPayment }) {
  const lk = useLookups();
  const paymentModes = lk.list('PaymentMode');
  const [payAmt, setPayAmt] = useState('');
  const [payModeSel, setPayMode] = useState('');
  const [payRef, setPayRef] = useState('');
  const [saving, setSaving] = useState(false);
  const payMode = payModeSel || paymentModes[0]?.value || '';

  const handlePay = async () => {
    const amt = Number(payAmt);
    if (!payAmt || !(amt > 0)) { toast.error('Enter a valid amount'); return; }
    if (amt > Number(bill.balanceAmount || 0) + 0.001) { toast.error(`Amount exceeds the balance of ₹${Number(bill.balanceAmount).toFixed(2)}`); return; }
    setSaving(true);
    try { const ok = await onPayment(bill.id, { amount: amt, mode: payMode, reference: payRef.trim() || undefined }); if (ok) onClose(); }
    finally { setSaving(false); }
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={<>{bill.billNumber} <span className="ml-1 text-[12px] font-normal text-[color:var(--text-muted)]">{bill.clientName} · {new Date(bill.billDate).toLocaleDateString('en-IN')}</span></>}
        onClose={onClose}
        width="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={`₹${Number(bill.totalAmount || 0).toFixed(2)}`} />
            <Stat label="Paid" value={`₹${Number(bill.paidAmount || 0).toFixed(2)}`} tone="success" />
            <Stat label="Balance" value={`₹${Number(bill.balanceAmount || 0).toFixed(2)}`} tone="danger" />
            <div className="min-w-0 rounded-[8px] border border-[color:var(--border)] px-3.5 py-3">
              <div className="text-[12px] text-[color:var(--text-muted)]">Status</div>
              <div className="mt-1"><Badge tone={PAY_TONE[bill.paymentStatus] || 'neutral'}>{lk.label('SalesBillStatus', bill.paymentStatus)}</Badge></div>
            </div>
          </div>

          {/* Orders */}
          {bill.orders?.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-bold">Orders Included</p>
              <div className="space-y-2">
                {bill.orders.map(o => (
                  <div key={o.id} className="rounded-[6px] border border-[color:var(--border)] p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12px] font-bold">{o.orderNumber}</span>
                      <span className="text-[12px] tabular-nums text-[color:var(--text-muted)]">₹{Number(o.totalAmount).toFixed(2)}</span>
                    </div>
                    <div className="space-y-1">
                      {o.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[12px] text-[color:var(--text-muted)]">
                          <span>{item.productName} × {item.quantity} {item.unit}</span>
                          <span className="tabular-nums">₹{Number(item.totalAmount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bill.notes && (
            <div>
              <p className="mb-1 text-[13px] font-bold">Notes &amp; payment history</p>
              <pre className="whitespace-pre-wrap rounded-[6px] border border-[color:var(--border)] p-2 font-sans text-[12px] text-[color:var(--text-secondary)]">{bill.notes}</pre>
            </div>
          )}

          {/* Payment */}
          {bill.paymentStatus !== 'Paid' && (
            <div className="border-t border-[color:var(--border)] pt-4">
              <p className="mb-2 text-[13px] font-bold">Record Payment</p>
              <div className="flex gap-2">
                <input type="number" min="0" step="any" className={inp} placeholder={`Amount (max ₹${Number(bill.balanceAmount || 0).toFixed(2)})`} value={payAmt} onChange={e => setPayAmt(e.target.value)} />
                <select className={inp} value={payMode} onChange={e => setPayMode(e.target.value)}>
                  {lookupOptions(paymentModes, payMode).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input className={inp} placeholder="Reference (UTR / cheque)" value={payRef} onChange={e => setPayRef(e.target.value)} />
                <Button onClick={handlePay} loading={saving}><IndianRupee className="size-3.5" />{saving ? '...' : 'Record'}</Button>
              </div>
            </div>
          )}
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

// ── Client Modal ──────────────────────────────────────────────────────────────
function ClientModal({ client, onClose, onSave }) {
  const lk = useLookups();
  const clientTypes = lk.list('SalesClientType');
  const [form, setForm] = useState({
    name: client?.name || '', contactPerson: client?.contactPerson || '',
    phone: client?.phone || '', email: client?.email || '',
    address: client?.address || '', city: client?.city || '',
    state: client?.state || '', gstNumber: client?.gstNumber || '',
    clientType: client?.clientType || '',
    creditLimit: client?.creditLimit || 0, notes: client?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Business name is required'); return; }
    if (Number(form.creditLimit) < 0) { toast.error('Credit limit cannot be negative'); return; }
    setSaving(true);
    try {
      const ok = await onSave({ ...form, name: form.name.trim(), clientType: form.clientType || clientTypes[0]?.value, creditLimit: Number(form.creditLimit) || 0 });
      if (ok) onClose();
    } finally { setSaving(false); }
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={client ? 'Edit Client' : 'Add Client'}
        onClose={onClose}
        width="max-w-lg"
        footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Business Name" required className="col-span-2"><input className={inp} value={form.name} onChange={e => f('name', e.target.value)} /></Field>
          <Field label="Contact Person"><input className={inp} value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)} /></Field>
          <Field label="Phone"><input className={inp} value={form.phone} onChange={e => f('phone', e.target.value)} /></Field>
          <Field label="Email"><input className={inp} value={form.email} onChange={e => f('email', e.target.value)} /></Field>
          <Field label="GST Number"><input className={inp} value={form.gstNumber} onChange={e => f('gstNumber', e.target.value)} /></Field>
          <Field label="Client Type">
            <select className={inp} value={form.clientType || clientTypes[0]?.value || ''} onChange={e => f('clientType', e.target.value)}>
              {lookupOptions(clientTypes, form.clientType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Credit Limit (₹)"><input type="number" min="0" className={inp} value={form.creditLimit} onChange={e => f('creditLimit', e.target.value)} /></Field>
          <Field label="City"><input className={inp} value={form.city} onChange={e => f('city', e.target.value)} /></Field>
          <Field label="State"><input className={inp} value={form.state} onChange={e => f('state', e.target.value)} /></Field>
          <Field label="Address" className="col-span-2"><textarea className={inp} rows={2} value={form.address} onChange={e => f('address', e.target.value)} /></Field>
          <Field label="Notes" className="col-span-2"><input className={inp} value={form.notes} onChange={e => f('notes', e.target.value)} /></Field>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSalesOrders() {
  const dispatch = useDispatch();
  const lk = useLookups();
  const billStatuses = lk.enumList('SalesBillStatus');
  // `clients` (redux, unpaged) feeds the client pickers; the three tab lists are paged + searched on the server
  const { clients, currentBill } = useSelector(s => s.admin.salesOrders);

  const [tab, setTab] = useState('orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showBillDetail, setShowBillDetail] = useState(false);
  const [payFilter, setPayFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState('');                 // debounced search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [list, setList] = useState({ items: [], total: 0, loaded: false });
  const [countsOB, setCounts] = useState({ orders: 0, bills: 0 });
  const counts = { ...countsOB, clients: clients.length };
  const [selected, setSelected] = useState({});            // id → order (kept across pages)

  // Every dispatched action reports failures with the backend message
  const run = async (thunk, arg, fallback) => {
    const res = await dispatch(thunk(arg));
    if (thunk.rejected.match(res)) { toast.error(errMsg(res, fallback)); return null; }
    return res;
  };

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [tab, query, statusFilter, clientFilter, payFilter, pageSize]);

  const loadPickers = useCallback(async () => {
    const res = await dispatch(fetchSalesClients());
    if (fetchSalesClients.rejected.match(res)) toast.error(errMsg(res, 'Failed to load clients'));
  }, [dispatch]);

  // Tab counts (total rows per list) — one tiny page each; the client count is the full picker list
  const loadCounts = useCallback(async () => {
    const [o, b] = await Promise.all([dispatch(fetchSalesOrders({ page: 1, limit: 1 })), dispatch(fetchSalesBills({ page: 1, limit: 1 }))]);
    setCounts({ orders: o.payload?.total ?? 0, bills: b.payload?.total ?? 0 });
    loadPickers();
  }, [dispatch, loadPickers]);

  const loadList = useCallback(async () => {
    const base = { page, limit: pageSize, search: query || undefined };
    if (tab === 'clients') {
      // direct call: the redux `clients` list stays the full (unpaged) picker list
      try {
        const res = await api.get('/admin/sales/clients', { params: base });
        setList({ items: res.data?.data?.items || [], total: res.data?.data?.total ?? 0, loaded: true });
      } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to load clients'); }
      return;
    }
    const thunk = tab === 'orders' ? fetchSalesOrders : fetchSalesBills;
    const params = tab === 'orders' ? { ...base, status: statusFilter || undefined, clientId: clientFilter || undefined }
      : { ...base, paymentStatus: payFilter || undefined, clientId: clientFilter || undefined };
    const res = await dispatch(thunk(params));
    if (thunk.rejected.match(res)) { toast.error(errMsg(res, 'Failed to load field sales data')); return; }
    setList({ items: res.payload?.items || [], total: res.payload?.total ?? 0, loaded: true });
  }, [dispatch, tab, page, pageSize, query, statusFilter, clientFilter, payFilter]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadList(); }, [loadList]);
  const refresh = () => { loadList(); loadCounts(); };

  const orders = tab === 'orders' ? list.items : [];
  const selectedOrderIds = Object.keys(selected).map(Number);
  const selectedOrders = Object.values(selected);
  const deliveredSelected = selectedOrders.length > 0 && selectedOrders.every(o => o.status === 'Delivered' && !o.isBilled);
  const selectedClients = new Set(selectedOrders.map(o => o.clientId));

  const toggleOrderSelect = o => {
    setSelected(prev => { const n = { ...prev }; if (n[o.id]) delete n[o.id]; else n[o.id] = o; return n; });
  };

  const handleStatusChange = async (id, status) => {
    setBusyId(id);
    const res = await run(updateSalesOrderStatus, { id, data: { status } }, 'Failed to update status');
    setBusyId(null);
    if (res) toast.success(`Order marked ${lk.label('SalesOrderStatus', status)}`);
    setSelected(prev => { const n = { ...prev }; delete n[id]; return n; });
    loadList();
  };

  const handleCancelOrder = async (o) => {
    if (!window.confirm(`Cancel order ${o.orderNumber}? This cannot be undone.`)) return;
    setBusyId(o.id);
    const res = await run(cancelSalesOrder, o.id, 'Failed to cancel order');
    setBusyId(null);
    if (res) {
      toast.success(`Order ${o.orderNumber} cancelled`);
      setSelected(prev => { const n = { ...prev }; delete n[o.id]; return n; });
      refresh();
    }
  };

  const handleCreateOrder = async ({ clientId, salespersonName, orderDate, notes, items, newClient }) => {
    let resolvedClientId = clientId;
    if (newClient) {
      const res = await run(createSalesClient, newClient, 'Failed to create client');
      if (!res) return false;
      resolvedClientId = res.payload?.id;
      loadPickers();
    }
    const res = await run(createSalesOrder, { clientId: Number(resolvedClientId), salespersonName: salespersonName.trim(), orderDate, notes, items }, 'Failed to create order');
    if (!res) return false;
    toast.success(`Order ${res.payload?.orderNumber ?? ''} created`);
    refresh();
    return true;
  };

  const handleGenerateBill = async () => {
    if (!selectedOrderIds.length) return;
    if (selectedClients.size > 1) { toast.error('All selected orders must belong to the same client'); return; }
    setGenerating(true);
    const res = await run(generateSalesBill, { orderIds: selectedOrderIds, billDate: new Date().toISOString() }, 'Failed to generate bill');
    setGenerating(false);
    if (!res) return;
    toast.success(`Bill ${res.payload?.billNumber ?? ''} generated`);
    setSelected({});
    loadCounts();
    setTab('bills');
  };

  // ── Clients tab ────────────────────────────────────────────
  const filteredClients = tab === 'clients' ? list.items : [];

  const handleSaveClient = async (form) => {
    const res = editingClient
      ? await run(updateSalesClient, { id: editingClient.id, data: form }, 'Failed to update client')
      : await run(createSalesClient, form, 'Failed to create client');
    if (!res) return false;
    toast.success(editingClient ? 'Client updated' : 'Client added');
    refresh();
    return true;
  };

  const handleDeleteClient = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    const res = await run(deleteSalesClient, c.id, 'Failed to delete client');
    if (res) { toast.success('Client deleted'); refresh(); }
  };

  // ── Bills tab ──────────────────────────────────────────────
  const filteredBills = tab === 'bills' ? list.items : [];
  const filteredOrders = orders;
  const pages = Math.max(1, Math.ceil(list.total / pageSize));
  const pg = { page, pages, total: list.total, pageSize, setPage, setPageSize };
  const ordersPg = { ...pg, items: filteredOrders };
  const clientsPg = { ...pg, items: filteredClients };
  const billsPg = { ...pg, items: filteredBills };

  const openBill = async id => {
    const res = await run(fetchSalesBillById, id, 'Failed to load bill');
    if (res) setShowBillDetail(true);
  };

  const handlePayment = async (id, data) => {
    const res = await run(recordBillPayment, { id, data }, 'Failed to record payment');
    if (!res) return false;
    toast.success(`Payment recorded — ${lk.label('SalesBillStatus', res.payload?.paymentStatus)}`);
    loadList();
    loadPickers();
    return true;
  };

  // Loading state goes after every hook (Rules of Hooks)
  if (!list.loaded) return (
    <div className="space-y-4"><SkPageHeader /><SkTable rows={7} cols={6} /></div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Field Sales Orders"
        description="Manage offline retail & wholesale orders"
        actions={<>
          {tab === 'orders' && (
            <>
              {deliveredSelected && (
                <Button variant="accent" onClick={handleGenerateBill} loading={generating}>
                  <FileText className="size-4" /> Generate Bill ({selectedOrderIds.length})
                </Button>
              )}
              <Button onClick={() => setShowOrderModal(true)}>
                <Plus className="size-4" /> New Order
              </Button>
            </>
          )}
          {tab === 'clients' && (
            <Button onClick={() => { setEditingClient(null); setShowClientModal(true); }}>
              <Plus className="size-4" /> Add Client
            </Button>
          )}
        </>}
      />

      <Tabs
        items={TABS.map(t => ({ ...t, count: counts[t.value] }))}
        value={tab}
        onChange={v => { if (v === tab) return; setList(l => ({ ...l, items: [], total: 0 })); setTab(v); setSearch(''); setQuery(''); setStatusFilter(''); setClientFilter(''); setPayFilter(''); setSelected({}); }}
      />

      {/* Orders Tab */}
      {tab === 'orders' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search orders..." className="max-w-xs" />
              <select className="input-field !w-40" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="overflow-x-auto">
                <Segmented options={[{ value: '', label: 'All' }, ...lk.enumList('SalesOrderStatus').map(s => ({ value: s.value, label: s.label }))]} value={statusFilter} onChange={setStatusFilter} />
              </div>
              {selectedOrderIds.length > 0 && <Badge tone={selectedClients.size > 1 ? 'danger' : 'accent'}>{selectedOrderIds.length} selected{selectedClients.size > 1 ? ' · different clients' : ''}</Badge>}
            </Toolbar>

            {filteredOrders.length === 0 ? (
              <EmptyState icon={Package} title="No orders found">
                {counts.orders ? 'Try another status, client or search.' : 'Create a field sales order to get started.'}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="w-10"></th>
                        <th className="text-left">Order #</th>
                        <th className="text-left">Client</th>
                        <th className="text-left">Salesperson</th>
                        <th className="text-left">Date</th>
                        <th className="text-left">Status</th>
                        <th className="text-right">Amount</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersPg.items.map(o => (
                        <tr key={o.id}>
                          <td className="text-center">
                            {(o.status === 'Delivered' && !o.isBilled) && (
                              <input type="checkbox" className="accent-[#1a5c2e]" checked={!!selected[o.id]} onChange={() => toggleOrderSelect(o)} />
                            )}
                          </td>
                          <td className="font-bold text-[color:var(--primary)]">{o.orderNumber}</td>
                          <td>{o.clientName}</td>
                          <td className="text-[color:var(--text-secondary)]">{o.salespersonName}</td>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{new Date(o.orderDate).toLocaleDateString('en-IN')}</td>
                          <td><Badge tone={STATUS_TONE[o.status] || 'neutral'}>{lk.label('SalesOrderStatus', o.status)}</Badge></td>
                          <td className="text-right font-bold">₹{Number(o.totalAmount).toFixed(2)}</td>
                          <td className="text-center">
                            {!o.isBilled && o.status !== 'Cancelled' && (
                              <div className="flex items-center justify-center gap-1">
                                <select className="input-field !h-7 !w-auto !py-0 !text-[12px]"
                                  aria-label={`Status of ${o.orderNumber}`}
                                  value={o.status}
                                  disabled={busyId === o.id}
                                  onChange={e => handleStatusChange(o.id, e.target.value)}>
                                  {lookupOptions(lk.enumList('SalesOrderStatus').filter(s => s.value !== 'Billed' && s.value !== 'Cancelled'), o.status)
                                    .map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <IconButton label={`Cancel order ${o.orderNumber}`} tone="danger" disabled={busyId === o.id} onClick={() => handleCancelOrder(o)}>
                                  <Ban className="size-3.5" />
                                </IconButton>
                              </div>
                            )}
                            {o.isBilled && <Badge tone="accent">Billed</Badge>}
                            {o.status === 'Cancelled' && <span className="text-[12px] text-[color:var(--text-muted)]">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...ordersPg} noun="orders" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search clients..." className="max-w-xs" />
            </Toolbar>

            {filteredClients.length === 0 ? (
              <EmptyState icon={Users} title="No clients found">
                {counts.clients ? 'Try a different search.' : 'Add your retail and wholesale clients here.'}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Business Name</th>
                        <th className="text-left">Type</th>
                        <th className="text-left">Phone</th>
                        <th className="text-left">GST</th>
                        <th className="text-right">Credit Limit</th>
                        <th className="text-right">Outstanding</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientsPg.items.map(c => (
                        <tr key={c.id}>
                          <td>
                            <div className="font-bold">{c.name}</div>
                            {c.contactPerson && <div className="text-[12px] text-[color:var(--text-muted)]">{c.contactPerson}</div>}
                          </td>
                          <td><Badge tone="info">{lk.label('SalesClientType', c.clientType)}</Badge></td>
                          <td className="text-[color:var(--text-secondary)]">{c.phone}</td>
                          <td className="font-mono text-[12px] text-[color:var(--text-muted)]">{c.gstNumber || '—'}</td>
                          <td className="text-right">₹{Number(c.creditLimit).toLocaleString('en-IN')}</td>
                          <td className={`text-right font-bold ${Number(c.currentOutstanding) > 0 ? 'text-[color:var(--danger)]' : 'text-[color:var(--success)]'}`}>
                            ₹{Number(c.currentOutstanding).toLocaleString('en-IN')}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <IconButton label="Edit client" tone="primary" onClick={() => { setEditingClient(c); setShowClientModal(true); }}>
                                <Edit2 className="size-3.5" />
                              </IconButton>
                              <IconButton label="Delete client" tone="danger"
                                onClick={() => handleDeleteClient(c)}>
                                <Trash2 className="size-3.5" />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...clientsPg} noun="clients" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Bills Tab */}
      {tab === 'bills' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <select className="input-field !w-48" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Segmented
                options={[{ value: '', label: 'All' }, ...billStatuses.map(s => ({ value: s.value, label: s.label }))]}
                value={payFilter}
                onChange={setPayFilter}
              />
            </Toolbar>

            {filteredBills.length === 0 ? (
              <EmptyState icon={FileText} title="No bills found">
                {counts.bills ? 'Try another client or payment status.' : 'Select delivered orders and generate a bill.'}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Bill #</th>
                        <th className="text-left">Client</th>
                        <th className="text-left">Date</th>
                        <th className="text-right">Total</th>
                        <th className="text-right">Paid</th>
                        <th className="text-right">Balance</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billsPg.items.map(b => (
                        <tr key={b.id} className="cursor-pointer" onClick={() => openBill(b.id)}>
                          <td className="font-bold text-[color:var(--primary)]">{b.billNumber}</td>
                          <td>{b.clientName}</td>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{new Date(b.billDate).toLocaleDateString('en-IN')}</td>
                          <td className="text-right font-bold">₹{Number(b.totalAmount).toFixed(2)}</td>
                          <td className="text-right text-[color:var(--success)]">₹{Number(b.paidAmount).toFixed(2)}</td>
                          <td className="text-right text-[color:var(--danger)]">₹{Number(b.balanceAmount).toFixed(2)}</td>
                          <td className="text-center"><Badge tone={PAY_TONE[b.paymentStatus] || 'neutral'}>{lk.label('SalesBillStatus', b.paymentStatus)}</Badge></td>
                          <td className="text-center" onClick={e => e.stopPropagation()}>
                            <IconButton label="View bill" tone="primary" onClick={() => openBill(b.id)}><Eye className="size-3.5" /></IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...billsPg} noun="bills" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Modals */}
      {showOrderModal && <OrderModal clients={clients} onClose={() => setShowOrderModal(false)} onSave={handleCreateOrder} />}
      {showClientModal && (
        <ClientModal
          client={editingClient}
          onClose={() => setShowClientModal(false)}
          onSave={handleSaveClient}
        />
      )}
      {showBillDetail && currentBill && (
        <BillDetailModal bill={currentBill} onClose={() => setShowBillDetail(false)} onPayment={handlePayment} />
      )}
    </div>
  );
}
