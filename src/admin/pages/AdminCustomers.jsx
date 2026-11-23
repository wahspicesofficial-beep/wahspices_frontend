import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCrmCustomers, fetchCrmStats, fetchCrmAging,
  createCrmCustomer, updateCrmCustomer, deleteCrmCustomer,
  blockCrmCustomer, updateCrmDues, updateCrmLoyalty, updateCrmCreditLimit,
  fetchCrmCustomer, fetchCrmPayments, addCrmPayment,
  fetchCrmPrices, addCrmPriceRule, deleteCrmPriceRule,
  sendCrmReminder, sendCrmPromo,
} from '@/store/slices/adminSlice';
import { useLookups, lookupOptions } from '@/admin/lookups';
import { SkTable, SkPageHeader } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import {
  Users, CreditCard, Receipt, Tag, Star, BarChart3,
  Plus, Eye, Trash2, Edit2, AlertTriangle,
  Phone, Mail, MapPin, Building2, Shield, ShieldOff,
  Gift, Bell, TrendingUp, CheckCircle, Clock, X, Loader2,
} from 'lucide-react';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, Segmented, SearchInput, Toolbar,
  EmptyState, DialogPanel, Field, usePagination, Pagination,
} from '@/admin/ui';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'customers', label: 'Customers',    icon: Users      },
  { key: 'credit',    label: 'Credit & Dues', icon: CreditCard },
  { key: 'payments',  label: 'Payments',      icon: Receipt    },
  { key: 'prices',    label: 'Price Lists',   icon: Tag        },
  { key: 'loyalty',   label: 'Loyalty',       icon: Star       },
  { key: 'aging',     label: 'Aging Report',  icon: BarChart3  },
];

// Each list tab = the same server-side customer query with a different sort / filter
const TAB_SORT = { customers: 'newest', credit: 'usage', payments: 'dues', prices: 'name', loyalty: 'points' };

// Purely visual maps (values come from the API / lookups)
const TIER_TONE = { Bronze: 'accent', Silver: 'neutral', Gold: 'warning', Platinum: 'info' };
const CAT_TONE  = { Retail: 'info', Wholesale: 'success', Ecom: 'accent', Distributor: 'primary' };
const BUCKET_TONE = { '0-30': 'success', '31-60': 'warning', '61-90': 'accent', '90+': 'danger' };

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dayMonth = (d, month = 'short') => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month }) : '—');

// ── Primitives ────────────────────────────────────────────────────────────────

const inp = 'input-field';

// Overlay without backdrop-click close (as before) so a half-filled form isn't lost by a stray click
const Modal = ({ title, onClose, children, footer, wide = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <DialogPanel title={title} onClose={onClose} footer={footer} width={wide ? 'max-w-3xl' : 'max-w-lg'}>
      {children}
    </DialogPanel>
  </div>
);

const SectionLabel = ({ children }) => (
  <p className="text-[12px] font-bold text-[color:var(--text-secondary)]">{children}</p>
);

// ── Customer Form Modal ───────────────────────────────────────────────────────

function CustomerFormModal({ customer, onClose, onSaved }) {
  const dispatch = useDispatch();
  const lk = useLookups();
  const categories = lk.list('CustomerCategory');
  const [form, setForm] = useState({
    name: '', contactName: '', email: '', phone: '', city: '', state: '',
    category: '', gstin: '', pan: '',
    billingAddress: '', shippingAddress: '',
    creditLimit: 0, birthDate: '', anniversaryDate: '',
    notes: '', tags: '',
    ...(customer || {}),
    birthDate: customer?.birthDate ? customer.birthDate.split('T')[0] : '',
    anniversaryDate: customer?.anniversaryDate ? customer.anniversaryDate.split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name?.trim() || !form.phone?.trim()) { toast.error('Name and Phone required'); return; }
    setLoading(true);
    const payload = {
      ...form, category: form.category || categories[0]?.value || undefined,
      creditLimit: Number(form.creditLimit) || 0, birthDate: form.birthDate || null, anniversaryDate: form.anniversaryDate || null,
    };
    const res = customer
      ? await dispatch(updateCrmCustomer({ id: customer.id, ...payload }))
      : await dispatch(createCrmCustomer(payload));
    setLoading(false);
    if ((customer ? updateCrmCustomer : createCrmCustomer).fulfilled.match(res)) {
      toast.success(customer ? 'Customer updated!' : 'Customer created!');
      onSaved();
    } else toast.error(res.payload || 'Failed to save');
  };

  const TEXT_FIELDS = [
    ['name','Name',true,'col-span-2'], ['contactName','Contact Person',false,''],
    ['email','Email',false,''], ['phone','Phone',true,''],
    ['city','City',false,''], ['state','State',false,''],
    ['gstin','GSTIN',false,''], ['pan','PAN',false,''],
    ['billingAddress','Billing Address',false,'col-span-2'],
    ['shippingAddress','Shipping Address',false,'col-span-2'],
  ];

  return (
    <Modal
      title={customer ? 'Edit Customer' : 'Add Customer'}
      onClose={onClose}
      wide
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={loading}>{loading ? 'Saving…' : 'Save Customer'}</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        {TEXT_FIELDS.map(([key, label, required, span]) => (
          <Field key={key} label={label} required={required} className={span}>
            <input value={form[key] || ''} onChange={e => f(key, e.target.value)} className={inp} />
          </Field>
        ))}
        <Field label="Category">
          <select value={form.category || categories[0]?.value || ''} onChange={e => f('category', e.target.value)} className={inp}>
            {lookupOptions(categories, form.category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Credit Limit (₹)">
          <input type="number" min="0" value={form.creditLimit} onChange={e => f('creditLimit', e.target.value)} className={inp} />
        </Field>
        <Field label="Birth Date">
          <input type="date" value={form.birthDate || ''} onChange={e => f('birthDate', e.target.value)} className={inp} />
        </Field>
        <Field label="Anniversary Date">
          <input type="date" value={form.anniversaryDate || ''} onChange={e => f('anniversaryDate', e.target.value)} className={inp} />
        </Field>
        <Field label="Tags (comma separated)">
          <input value={form.tags || ''} onChange={e => f('tags', e.target.value)} placeholder="vip, bulk" className={inp} />
        </Field>
        <Field label="Notes">
          <input value={form.notes || ''} onChange={e => f('notes', e.target.value)} className={inp} />
        </Field>
      </div>
    </Modal>
  );
}

// ── Customer Detail Drawer ────────────────────────────────────────────────────

function CustomerDetail({ customerId, onClose, onChanged }) {
  const dispatch = useDispatch();
  const lk       = useLookups();
  const paymentModes = lk.list('PaymentMode');
  const current  = useSelector(s => s.admin.crm.current);
  const payments = useSelector(s => s.admin.crm.payments);
  const prices   = useSelector(s => s.admin.crm.prices);
  const [detailTab, setDetailTab] = useState('info');
  const [payForm, setPayForm] = useState({ amount: '', mode: '', reference: '', notes: '' });
  const [priceForm, setPriceForm] = useState({ productName: '', customPrice: '', discountPercent: '' });
  const [blockReason, setBlockReason] = useState('');
  const [creditInput, setCreditInput] = useState('');
  const [duesInput, setDuesInput] = useState('');
  const [pointsInput, setPointsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await dispatch(fetchCrmCustomer(customerId));
      if (fetchCrmCustomer.rejected.match(res)) { toast.error(res.payload || 'Failed to load customer'); onClose(); }
    })();
    dispatch(fetchCrmPayments(customerId));
    dispatch(fetchCrmPrices(customerId));
  }, [customerId, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the quick-edit inputs once the record for this customer has loaded
  const loaded = current && current.id === customerId;
  useEffect(() => {
    if (!loaded) return;
    setCreditInput(String(current.creditLimit ?? 0));
    setDuesInput(String(current.outstandingDues ?? 0));
  }, [loaded, current?.creditLimit, current?.outstandingDues]);

  const payMode = payForm.mode || paymentModes[0]?.value || 'Cash';

  const handleAddPayment = async () => {
    if (!payForm.amount || isNaN(+payForm.amount) || +payForm.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setLoading(true);
    const res = await dispatch(addCrmPayment({ id: customerId, amount: +payForm.amount, mode: payMode, reference: payForm.reference, notes: payForm.notes }));
    setLoading(false);
    if (addCrmPayment.fulfilled.match(res)) {
      toast.success('Payment recorded');
      setPayForm({ amount: '', mode: payForm.mode, reference: '', notes: '' });
      dispatch(fetchCrmCustomer(customerId));
      onChanged();
    } else toast.error(res.payload || 'Failed to record payment');
  };

  const handleAddPrice = async () => {
    if (!priceForm.productName.trim() || priceForm.customPrice === '') { toast.error('Product and price required'); return; }
    setLoading(true);
    const res = await dispatch(addCrmPriceRule({ id: customerId, productName: priceForm.productName.trim(), customPrice: +priceForm.customPrice, discountPercent: +priceForm.discountPercent || 0 }));
    setLoading(false);
    if (addCrmPriceRule.fulfilled.match(res)) { toast.success('Price rule added'); setPriceForm({ productName: '', customPrice: '', discountPercent: '' }); }
    else toast.error(res.payload || 'Failed to add price rule');
  };

  const handleDeletePrice = async (priceId) => {
    const res = await dispatch(deleteCrmPriceRule(priceId));
    if (deleteCrmPriceRule.fulfilled.match(res)) toast.success('Price rule removed');
    else toast.error(res.payload || 'Failed to remove price rule');
  };

  const handleBlock = async () => {
    const wasBlocked = current?.isBlocked;
    const res = await dispatch(blockCrmCustomer({ id: customerId, block: !wasBlocked, reason: blockReason }));
    if (blockCrmCustomer.fulfilled.match(res)) { toast.success(wasBlocked ? 'Customer unblocked' : 'Customer blocked'); setBlockReason(''); onChanged(); }
    else toast.error(res.payload || 'Failed');
  };

  const handleCreditLimit = async () => {
    if (creditInput === '' || +creditInput < 0) { toast.error('Enter a valid credit limit'); return; }
    setBusy('credit');
    const res = await dispatch(updateCrmCreditLimit({ id: customerId, creditLimit: +creditInput }));
    setBusy(null);
    if (updateCrmCreditLimit.fulfilled.match(res)) { toast.success('Credit limit updated'); onChanged(); }
    else toast.error(res.payload || 'Failed to update credit limit');
  };

  const handleDues = async () => {
    if (duesInput === '' || +duesInput < 0) { toast.error('Enter a valid outstanding amount'); return; }
    setBusy('dues');
    const res = await dispatch(updateCrmDues({ id: customerId, amount: +duesInput }));
    setBusy(null);
    if (updateCrmDues.fulfilled.match(res)) { toast.success('Outstanding updated'); onChanged(); }
    else toast.error(res.payload || 'Failed to update outstanding');
  };

  const handlePoints = async (sign) => {
    const pts = Math.trunc(+pointsInput);
    if (!pts || pts < 0) { toast.error('Enter the number of points'); return; }
    setBusy('points');
    const res = await dispatch(updateCrmLoyalty({ id: customerId, points: sign * pts }));
    setBusy(null);
    if (updateCrmLoyalty.fulfilled.match(res)) { toast.success(`${sign > 0 ? 'Added' : 'Deducted'} ${pts} points — now ${res.payload.loyaltyPoints} (${res.payload.loyaltyTier})`); setPointsInput(''); onChanged(); }
    else toast.error(res.payload || 'Failed to update points');
  };

  // Emails the reminder; falls back to WhatsApp when the customer has no email
  const handleReminder = async () => {
    setBusy('remind');
    const res = await dispatch(sendCrmReminder({ id: customerId }));
    setBusy(null);
    if (!sendCrmReminder.fulfilled.match(res)) { toast.error(res.payload || 'Failed to send reminder'); return; }
    if (res.payload.sent > 0) toast.success(res.payload.notice || `Reminder emailed to ${res.payload.email}`);
    else if (res.payload.whatsAppUrl) { toast('No email on file — opening WhatsApp with the reminder.'); window.open(res.payload.whatsAppUrl, '_blank', 'noopener'); }
    else toast.error('No email or valid phone on file — reminder not sent.');
  };

  const handlePromo = async (type) => {
    setBusy(type);
    const res = await dispatch(sendCrmPromo({ id: customerId, type }));
    setBusy(null);
    if (!sendCrmPromo.fulfilled.match(res)) { toast.error(res.payload || 'Failed to send promo'); return; }
    if (res.payload.emailed) toast.success(res.payload.notice || `Promo emailed (code ${res.payload.promoCode})`);
    else if (res.payload.whatsAppUrl) { toast('No email on file — opening WhatsApp with the promo.'); window.open(res.payload.whatsAppUrl, '_blank', 'noopener'); }
    else toast.error('No email or valid phone on file — promo not sent.');
  };

  if (!loaded) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] p-8">
        <Loader2 className="size-7 animate-spin text-[color:var(--primary)]" />
      </div>
    </div>
  );

  const DETAIL_TABS = [
    { value: 'info', label: 'Info' }, { value: 'payments', label: 'Payments', count: payments.length },
    { value: 'prices', label: 'Prices', count: prices.length }, { value: 'promo', label: 'Promo' },
  ];
  const overLimit = current.outstandingDues > current.creditLimit && current.creditLimit > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col border-l border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[15px] font-bold text-white">
              {current.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-[color:var(--text-primary)]">{current.name}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                <Badge tone={CAT_TONE[current.category] || 'neutral'}>{lk.label('CustomerCategory', current.category)}</Badge>
                <Badge tone={TIER_TONE[current.loyaltyTier] || 'neutral'}>{current.loyaltyTier}</Badge>
                {current.isBlocked && <Badge tone="danger">Blocked</Badge>}
              </div>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}><X className="size-4" /></IconButton>
        </div>

        {/* Sub tabs */}
        <Tabs items={DETAIL_TABS} value={detailTab} onChange={setDetailTab} className="px-2" />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* INFO TAB */}
          {detailTab === 'info' && (
            <div className="space-y-3">
              <Card bodyClassName="space-y-1.5 p-3 text-[13px] text-[color:var(--text-secondary)]">
                {current.phone    && <div className="flex items-center gap-2"><Phone className="size-3.5 text-[color:var(--text-muted)]" />{current.phone}</div>}
                {current.email    && <div className="flex items-center gap-2"><Mail className="size-3.5 text-[color:var(--text-muted)]" />{current.email}</div>}
                {current.city     && <div className="flex items-center gap-2"><MapPin className="size-3.5 text-[color:var(--text-muted)]" />{current.city}{current.state ? `, ${current.state}` : ''}</div>}
                {current.gstin    && <div className="flex items-center gap-2"><Building2 className="size-3.5 text-[color:var(--text-muted)]" />GSTIN: {current.gstin}</div>}
                {current.pan      && <div className="flex items-center gap-2"><Building2 className="size-3.5 text-[color:var(--text-muted)]" />PAN: {current.pan}</div>}
                {current.notes    && <div className="pt-1 text-[12px] text-[color:var(--text-muted)]">{current.notes}</div>}
                {!current.phone && !current.email && !current.city && !current.gstin && !current.pan && !current.notes && (
                  <div className="text-[12px] text-[color:var(--text-muted)]">No contact details.</div>
                )}
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Stat label="Credit Limit" value={inr(current.creditLimit)} icon={CreditCard} tone="info" />
                <Stat label="Outstanding" value={inr(current.outstandingDues)} icon={AlertTriangle} tone={overLimit ? 'danger' : 'accent'} />
                <Stat label="Loyalty Pts" value={(current.loyaltyPoints || 0).toLocaleString('en-IN')} icon={Star} tone="primary" />
                <Stat label="Tier" value={current.loyaltyTier} icon={TrendingUp} tone="warning" />
              </div>

              {/* Credit / dues / loyalty adjustments */}
              <Card title="Credit, Dues & Loyalty" bodyClassName="space-y-2 p-3">
                <Field label="Credit limit (₹)">
                  <div className="flex gap-2">
                    <input type="number" min="0" value={creditInput} onChange={e => setCreditInput(e.target.value)} className={inp} />
                    <Button variant="secondary" onClick={handleCreditLimit} loading={busy === 'credit'}>Save</Button>
                  </div>
                </Field>
                <Field label="Outstanding dues (₹)" hint="Set the opening / corrected balance. Use the Payments tab to record money received.">
                  <div className="flex gap-2">
                    <input type="number" min="0" value={duesInput} onChange={e => setDuesInput(e.target.value)} className={inp} />
                    <Button variant="secondary" onClick={handleDues} loading={busy === 'dues'}>Save</Button>
                  </div>
                </Field>
                <Field label="Loyalty points">
                  <div className="flex gap-2">
                    <input type="number" min="1" step="1" value={pointsInput} onChange={e => setPointsInput(e.target.value)} placeholder="Points" className={inp} />
                    <Button variant="secondary" onClick={() => handlePoints(1)} loading={busy === 'points'}>Add</Button>
                    <Button variant="secondary" onClick={() => handlePoints(-1)} disabled={busy === 'points'}>Deduct</Button>
                  </div>
                </Field>
              </Card>

              {/* Block toggle */}
              <Card title="Account Control" bodyClassName="space-y-2 p-3">
                {current.isBlocked && current.blockReason && (
                  <p className="text-[12px] text-[color:var(--danger)]">Reason: {current.blockReason}</p>
                )}
                {!current.isBlocked && (
                  <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Block reason (optional)" className={inp} />
                )}
                <Button variant={current.isBlocked ? 'secondary' : 'danger'} className="w-full" onClick={handleBlock}>
                  {current.isBlocked ? <><ShieldOff className="size-3.5" /> Unblock Customer</> : <><Shield className="size-3.5" /> Block Customer</>}
                </Button>
              </Card>

              {/* Reminder */}
              {current.outstandingDues > 0 && (
                <Button variant="accent" className="w-full" onClick={handleReminder} loading={busy === 'remind'}>
                  <Bell className="size-3.5" /> {current.email ? `Email Payment Reminder (${current.email})` : 'Send Payment Reminder (WhatsApp — no email on file)'}
                </Button>
              )}
            </div>
          )}

          {/* PAYMENTS TAB */}
          {detailTab === 'payments' && (
            <div className="space-y-3">
              <Card title="Record Payment" bodyClassName="space-y-3 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Amount (₹)" required>
                    <input type="number" min="0" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="Mode">
                    <select value={payMode} onChange={e => setPayForm(p => ({ ...p, mode: e.target.value }))} className={inp}>
                      {lookupOptions(paymentModes, payMode).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Reference">
                    <input value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} placeholder="UTR / Cheque No." className={inp} />
                  </Field>
                  <Field label="Notes">
                    <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className={inp} />
                  </Field>
                </div>
                <Button className="w-full" onClick={handleAddPayment} loading={loading}>{loading ? 'Saving…' : 'Record Payment'}</Button>
              </Card>

              {payments.length === 0
                ? <EmptyState icon={Receipt} title="No payments yet" />
                : <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Date</th>
                          <th className="text-left">Mode</th>
                          <th className="text-left">Reference</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id}>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                            <td><Badge tone="info">{lk.label('PaymentMode', p.mode)}</Badge></td>
                            <td className="text-[color:var(--text-muted)]">{p.reference || '—'}</td>
                            <td className="text-right font-bold text-[color:var(--success)]">{inr(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          )}

          {/* PRICES TAB */}
          {detailTab === 'prices' && (
            <div className="space-y-3">
              <Card title="Add Price Rule" bodyClassName="space-y-3 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Product Name" required className="col-span-2" hint="Linked to the catalog product automatically when the name matches exactly.">
                    <input value={priceForm.productName} onChange={e => setPriceForm(p => ({ ...p, productName: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="Custom Price (₹)" required>
                    <input type="number" min="0" value={priceForm.customPrice} onChange={e => setPriceForm(p => ({ ...p, customPrice: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="Discount %">
                    <input type="number" min="0" max="100" value={priceForm.discountPercent} onChange={e => setPriceForm(p => ({ ...p, discountPercent: e.target.value }))} className={inp} />
                  </Field>
                </div>
                <Button className="w-full" onClick={handleAddPrice} loading={loading}>{loading ? 'Saving…' : 'Add Price Rule'}</Button>
              </Card>

              {prices.length === 0
                ? <EmptyState icon={Tag} title="No custom price rules yet" />
                : <div className="grid-box">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Product</th>
                          <th className="text-right">Price</th>
                          <th className="text-right">Discount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {prices.map(p => (
                          <tr key={p.id}>
                            <td className="font-bold text-[color:var(--text-primary)]">{p.productName}</td>
                            <td className="text-right">{inr(p.customPrice)}</td>
                            <td className="text-right text-[color:var(--text-muted)]">{p.discountPercent > 0 ? `${p.discountPercent}% off` : '—'}</td>
                            <td className="text-right">
                              <IconButton label="Remove price rule" tone="danger" onClick={() => handleDeletePrice(p.id)}><Trash2 className="size-3.5" /></IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          )}

          {/* PROMO TAB */}
          {detailTab === 'promo' && (
            <div className="space-y-3">
              <SectionLabel>Birthday &amp; Anniversary Promos</SectionLabel>
              <p className="text-[12px] text-[color:var(--text-muted)]">
                {current.email ? `Promos are emailed to ${current.email}.` : 'No email on file — promos open WhatsApp with the message.'}
              </p>
              {current.birthDate && (
                <Card bodyClassName="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <Gift className="size-4 text-[color:var(--accent-strong)]" />
                    <span className="text-[13px] font-bold text-[color:var(--text-primary)]">Birthday</span>
                    <span className="ml-auto text-[12px] text-[color:var(--text-muted)]">{dayMonth(current.birthDate, 'long')}</span>
                  </div>
                  <Button variant="accent" className="w-full" onClick={() => handlePromo('birthday')} loading={busy === 'birthday'}>
                    <Gift className="size-3.5" /> Send Birthday Promo
                  </Button>
                </Card>
              )}
              {current.anniversaryDate && (
                <Card bodyClassName="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <Star className="size-4 text-[color:var(--primary)]" />
                    <span className="text-[13px] font-bold text-[color:var(--text-primary)]">Anniversary</span>
                    <span className="ml-auto text-[12px] text-[color:var(--text-muted)]">{dayMonth(current.anniversaryDate, 'long')}</span>
                  </div>
                  <Button className="w-full" onClick={() => handlePromo('anniversary')} loading={busy === 'anniversary'}>
                    <Star className="size-3.5" /> Send Anniversary Promo
                  </Button>
                </Card>
              )}
              {!current.birthDate && !current.anniversaryDate && (
                <EmptyState icon={Gift} title="No birthday/anniversary set">Edit customer to add these dates.</EmptyState>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminCustomers() {
  const dispatch = useDispatch();
  const lk = useLookups();
  const categories = lk.list('CustomerCategory');
  const accountStatuses = lk.enumList('CustomerAccountStatus');
  const { items, total, stats, aging } = useSelector(s => s.admin.crm);
  const loading = useSelector(s => s.admin.loading);

  const [tab, setTab]             = useState('customers');
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [statusFilter, setStatus] = useState('All');
  const [duesFilter, setDuesFilter] = useState('dues'); // Payments tab: 'dues' | 'all'
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(20);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editCustomer, setEdit]   = useState(null);
  const [detailId, setDetailId]   = useState(null);

  const isListTab = tab !== 'aging';

  // Server-side search / filter / sort / paging for every customer list tab
  useEffect(() => {
    if (!isListTab) return undefined;
    const params = {
      page, limit: pageSize,
      search: search.trim() || undefined,
      category: catFilter === 'All' ? undefined : catFilter,
      status: statusFilter === 'All' ? undefined : statusFilter,
      hasDues: tab === 'payments' && duesFilter === 'dues' ? true : undefined,
      sort: TAB_SORT[tab],
    };
    const timer = setTimeout(async () => {
      const res = await dispatch(fetchCrmCustomers(params));
      setLoadedOnce(true);
      if (fetchCrmCustomers.rejected.match(res)) toast.error(res.payload || 'Failed to load customers');
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [dispatch, isListTab, tab, page, pageSize, search, catFilter, statusFilter, duesFilter, reloadKey]);

  const refreshSummary = () => { dispatch(fetchCrmStats()); dispatch(fetchCrmAging()); };
  useEffect(() => { dispatch(fetchCrmStats()); dispatch(fetchCrmAging()); }, [dispatch]);

  // Any data change: reload the current page + KPIs + aging
  const refreshAll = () => { setReloadKey(k => k + 1); refreshSummary(); };

  // Changing a filter or tab goes back to page 1
  const withReset = (fn) => (v) => { fn(v); setPage(1); };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pager = {
    page: Math.min(page, pages), pages, total, pageSize, setPage,
    setPageSize: (n) => { setPageSize(n); setPage(1); },
  };
  const pgAging = usePagination(aging.rows, 20);
  // Deleting the last row of the last page → step back a page
  useEffect(() => { if (loadedOnce && page > pages) setPage(pages); }, [loadedOnce, page, pages]);

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    const res = await dispatch(deleteCrmCustomer(c.id));
    if (deleteCrmCustomer.fulfilled.match(res)) { toast.success('Customer deleted'); refreshAll(); }
    else toast.error(res.payload || 'Failed to delete');
  };

  if (!loadedOnce && loading && items.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTable rows={7} cols={5} /></div>;

  const filtersActive = search || catFilter !== 'All' || statusFilter !== 'All';
  const emptyList = filtersActive
    ? <EmptyState icon={Users} title="No customers match these filters">Try a different search, category or status.</EmptyState>
    : <EmptyState icon={Users} title="No customers yet">Add your first one!</EmptyState>;

  const filterBar = (
    <Toolbar>
      <div className="relative min-w-[200px] max-w-sm flex-1">
        <SearchInput value={search} onChange={withReset(setSearch)} placeholder="Search name, contact, phone, email, city…" className="!max-w-none" />
      </div>
      <select value={catFilter} onChange={e => withReset(setCatFilter)(e.target.value)} className={`${inp} !w-44`}>
        <option value="All">All Categories</option>
        {lookupOptions(categories, catFilter === 'All' ? null : catFilter).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Segmented
        options={[{ value: 'All', label: 'All' }, ...accountStatuses.map(s => ({ value: s.value, label: s.label }))]}
        value={statusFilter}
        onChange={withReset(setStatus)}
      />
      {tab === 'payments' && (
        <Segmented options={[{ value: 'dues', label: 'With dues' }, { value: 'all', label: 'All customers' }]} value={duesFilter} onChange={withReset(setDuesFilter)} />
      )}
      {filtersActive && (
        <Button variant="secondary" onClick={() => { setSearch(''); setCatFilter('All'); setStatus('All'); setPage(1); }}>Reset</Button>
      )}
    </Toolbar>
  );

  const tierStats = stats?.tiers || [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Management"
        description={`${(stats?.total ?? 0).toLocaleString('en-IN')} customers · CRM + Credit + Loyalty`}
        actions={<Button onClick={() => { setEdit(null); setShowForm(true); }}><Plus className="size-4" /> Add Customer</Button>}
      />

      {/* KPI tiles — /crm/stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Customers" value={(stats?.total ?? 0).toLocaleString('en-IN')} hint={stats ? `${stats.active} active · ${stats.blocked} blocked` : undefined} icon={Users} tone="info" loading={!stats} />
        <Stat label="Outstanding Dues" value={inr(stats?.totalDues)} hint={stats ? `${stats.withDues} customers` : undefined} icon={CreditCard} tone="danger" loading={!stats} />
        <Stat label="Over Credit Limit" value={stats?.overLimit ?? 0} icon={AlertTriangle} tone="warning" loading={!stats} />
        <Stat label="Total Loyalty Pts" value={(stats?.totalPoints ?? 0).toLocaleString('en-IN')} icon={Star} tone="primary" loading={!stats} />
      </div>

      <Tabs
        items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon, count: t.key === 'aging' ? (aging.totalCustomers || undefined) : undefined }))}
        value={tab}
        onChange={withReset(setTab)}
      />

      {/* ── Customers Tab ─────────────────────────────────────────────────── */}
      {tab === 'customers' && (
        <Card>
          <div className="space-y-3 p-3">
            {filterBar}
            {items.length === 0 ? emptyList : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Customer</th>
                        <th className="text-left">Category</th>
                        <th className="text-left">Phone</th>
                        <th className="text-left">City</th>
                        <th className="text-right">Credit Limit</th>
                        <th className="text-right">Dues</th>
                        <th className="text-left">Loyalty</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(c => (
                        <tr key={c.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-[12px] font-bold text-[color:var(--primary)]">
                                {c.name?.[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-bold text-[color:var(--text-primary)]">
                                  {c.name}
                                  {c.isBlocked && <Badge tone="danger">Blocked</Badge>}
                                </div>
                                {c.email && <div className="text-[12px] text-[color:var(--text-muted)]">{c.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td><Badge tone={CAT_TONE[c.category] || 'neutral'}>{lk.label('CustomerCategory', c.category)}</Badge></td>
                          <td className="whitespace-nowrap text-[color:var(--text-secondary)]">{c.phone}</td>
                          <td className="text-[color:var(--text-secondary)]">{c.city || '—'}</td>
                          <td className="text-right">{inr(c.creditLimit)}</td>
                          <td className={`text-right font-bold ${c.outstandingDues > c.creditLimit && c.creditLimit > 0 ? 'text-[color:var(--danger)]' : c.outstandingDues > 0 ? 'text-[color:var(--accent-strong)]' : 'text-[color:var(--text-muted)]'}`}>
                            {inr(c.outstandingDues)}
                          </td>
                          <td><Badge tone={TIER_TONE[c.loyaltyTier] || 'neutral'}>{(c.loyaltyPoints || 0).toLocaleString('en-IN')} pts</Badge></td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <IconButton label="View customer" tone="primary" onClick={() => setDetailId(c.id)}><Eye className="size-3.5" /></IconButton>
                              <IconButton label="Edit customer" tone="primary" onClick={() => { setEdit(c); setShowForm(true); }}><Edit2 className="size-3.5" /></IconButton>
                              <IconButton label="Delete customer" tone="danger" onClick={() => handleDelete(c)}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...pager} noun="customers" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Credit & Dues Tab (sorted by credit usage) ────────────────────── */}
      {tab === 'credit' && (
        <Card bodyClassName="space-y-3 p-3">
          {filterBar}
          {items.length === 0 ? emptyList : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Category</th>
                      <th className="text-right">Credit Limit</th>
                      <th className="text-right">Outstanding Dues</th>
                      <th className="text-left">Usage %</th>
                      <th className="text-left">Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(c => {
                      const usage = c.creditLimit > 0 ? Math.round((c.outstandingDues / c.creditLimit) * 100) : 0;
                      const overLimit = c.creditLimit > 0 && c.outstandingDues > c.creditLimit;
                      return (
                        <tr key={c.id} className={overLimit ? '[&>td]:!bg-[color:var(--danger-bg)]' : ''}>
                          <td className="font-bold text-[color:var(--text-primary)]">{c.name}</td>
                          <td><Badge tone={CAT_TONE[c.category] || 'neutral'}>{lk.label('CustomerCategory', c.category)}</Badge></td>
                          <td className="text-right">{inr(c.creditLimit)}</td>
                          <td className="text-right font-bold text-[color:var(--accent-strong)]">{inr(c.outstandingDues)}</td>
                          <td className="min-w-[140px]">
                            {c.creditLimit > 0
                              ? <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                                    <div className={`h-full rounded-full ${overLimit ? 'bg-[color:var(--danger)]' : usage > 80 ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--success)]'}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                                  </div>
                                  <span className="text-[12px] tabular-nums text-[color:var(--text-muted)]">{usage}%</span>
                                </div>
                              : <span className="text-[12px] text-[color:var(--text-muted)]">No limit</span>}
                          </td>
                          <td>
                            {overLimit ? <Badge tone="danger">Over Limit</Badge>
                              : c.outstandingDues > 0 ? <Badge tone="warning">Has Dues</Badge>
                              : <Badge tone="success">Clear</Badge>}
                          </td>
                          <td className="text-center">
                            <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" onClick={() => setDetailId(c.id)}><Eye className="size-3" /> View</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination {...pager} noun="customers" />
            </>
          )}
        </Card>
      )}

      {/* ── Payments Tab (customers with dues first; server-side filter) ─── */}
      {tab === 'payments' && (
        <Card bodyClassName="space-y-3 p-3">
          <p className="text-[13px] text-[color:var(--text-muted)]">Open a customer to see their payment history and record new payments.</p>
          {filterBar}
          {items.length === 0 ? (duesFilter === 'dues' && !filtersActive ? <EmptyState icon={CheckCircle} title="No customers with outstanding dues" /> : emptyList) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Phone</th>
                      <th className="text-left">Category</th>
                      <th className="text-right">Outstanding Dues</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(c => (
                      <tr key={c.id}>
                        <td className="font-bold text-[color:var(--text-primary)]">{c.name}</td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">{c.phone}</td>
                        <td><Badge tone={CAT_TONE[c.category] || 'neutral'}>{lk.label('CustomerCategory', c.category)}</Badge></td>
                        <td className={`text-right font-bold ${c.outstandingDues > 0 ? 'text-[color:var(--accent-strong)]' : 'text-[color:var(--text-muted)]'}`}>
                          {inr(c.outstandingDues)}
                        </td>
                        <td className="text-center">
                          <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" onClick={() => setDetailId(c.id)}><Receipt className="size-3" /> Payments</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pager} noun="customers" />
            </>
          )}
        </Card>
      )}

      {/* ── Price Lists Tab ───────────────────────────────────────────────── */}
      {tab === 'prices' && (
        <Card bodyClassName="space-y-3 p-3">
          <p className="text-[13px] text-[color:var(--text-muted)]">Manage customer-specific pricing and discounts. Open a customer to manage their price rules.</p>
          {filterBar}
          {items.length === 0 ? emptyList : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Category</th>
                      <th className="text-left">GSTIN</th>
                      <th className="text-center">Manage Prices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(c => (
                      <tr key={c.id}>
                        <td className="font-bold text-[color:var(--text-primary)]">{c.name}</td>
                        <td><Badge tone={CAT_TONE[c.category] || 'neutral'}>{lk.label('CustomerCategory', c.category)}</Badge></td>
                        <td className="font-mono text-[12px] text-[color:var(--text-muted)]">{c.gstin || '—'}</td>
                        <td className="text-center">
                          <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" onClick={() => setDetailId(c.id)}><Tag className="size-3" /> Manage Prices</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pager} noun="customers" />
            </>
          )}
        </Card>
      )}

      {/* ── Loyalty Tab (sorted by points, server-side) ───────────────────── */}
      {tab === 'loyalty' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tierStats.map((t, i) => {
              const next = tierStats[i - 1];
              return (
                <Stat
                  key={t.tier}
                  label={t.tier}
                  value={t.count}
                  icon={Star}
                  tone={TIER_TONE[t.tier] || 'neutral'}
                  hint={next ? `${t.minPoints.toLocaleString('en-IN')}–${(next.minPoints - 1).toLocaleString('en-IN')} pts` : `${t.minPoints.toLocaleString('en-IN')}+ pts`}
                />
              );
            })}
          </div>

          <Card bodyClassName="space-y-3 p-3">
            {filterBar}
            {items.length === 0 ? emptyList : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Customer</th>
                        <th className="text-left">Tier</th>
                        <th className="text-right">Points</th>
                        <th className="text-left">Birthday</th>
                        <th className="text-left">Anniversary</th>
                        <th className="text-center">Promo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(c => (
                        <tr key={c.id}>
                          <td className="font-bold text-[color:var(--text-primary)]">{c.name}</td>
                          <td><Badge tone={TIER_TONE[c.loyaltyTier] || 'neutral'}>{c.loyaltyTier}</Badge></td>
                          <td className="text-right font-bold text-[color:var(--primary)]">{(c.loyaltyPoints || 0).toLocaleString('en-IN')}</td>
                          <td className="text-[color:var(--text-muted)]">{dayMonth(c.birthDate)}</td>
                          <td className="text-[color:var(--text-muted)]">{dayMonth(c.anniversaryDate)}</td>
                          <td className="text-center">
                            <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" onClick={() => setDetailId(c.id)}><Gift className="size-3" /> Points &amp; Promo</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...pager} noun="customers" />
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Aging Tab ─────────────────────────────────────────────────────── */}
      {tab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {aging.buckets.map(b => (
              <Stat
                key={b.bucket}
                label={b.label}
                value={inr(b.amount)}
                icon={Clock}
                tone={BUCKET_TONE[b.bucket] || 'neutral'}
                hint={`${b.customers} customers`}
              />
            ))}
          </div>

          <Card bodyClassName="p-3">
            {aging.rows.length === 0 ? <EmptyState icon={CheckCircle} title="No outstanding dues found" /> : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Customer</th>
                        <th className="text-left">Phone</th>
                        <th className="text-left">Category</th>
                        <th className="text-right">Dues</th>
                        <th className="text-right">Days</th>
                        <th className="text-left">Bucket</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pgAging.items.map(a => (
                        <tr key={a.id}>
                          <td className="font-bold text-[color:var(--text-primary)]">
                            {a.name}
                            {a.isBlocked && <Badge tone="danger" className="ml-1.5">Blocked</Badge>}
                          </td>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{a.phone}</td>
                          <td><Badge tone={CAT_TONE[a.category] || 'neutral'}>{lk.label('CustomerCategory', a.category)}</Badge></td>
                          <td className="text-right font-bold text-[color:var(--accent-strong)]">{inr(a.outstandingDues)}</td>
                          <td className="text-right text-[color:var(--text-secondary)]">{a.days}d</td>
                          <td><Badge tone={BUCKET_TONE[a.bucket] || 'neutral'}>{aging.buckets.find(b => b.bucket === a.bucket)?.label ?? a.bucket}</Badge></td>
                          <td className="text-center">
                            <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" onClick={() => setDetailId(a.id)}><Eye className="size-3" /> View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...pgAging} noun="customers" />
              </>
            )}
          </Card>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <CustomerFormModal
          customer={editCustomer}
          onClose={() => { setShowForm(false); setEdit(null); }}
          onSaved={() => { setShowForm(false); setEdit(null); refreshAll(); }}
        />
      )}
      {detailId && <CustomerDetail customerId={detailId} onClose={() => setDetailId(null)} onChanged={refreshAll} />}
    </div>
  );
}
