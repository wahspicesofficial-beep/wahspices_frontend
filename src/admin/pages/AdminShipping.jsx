import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, Plus, RefreshCw, PlugZap, CheckCircle2, XCircle, Copy, Eye, EyeOff, Trash2, Undo2, IndianRupee, Printer, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import RateCalculator from '@/admin/components/RateCalculator';
import {
  PageHeader, Card, Stat, Badge, Button, Tabs, Segmented, SearchInput, Toolbar, EmptyState, Skeleton, DialogPanel, Field, Pagination,
} from '@/admin/ui';

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const apiErr = (e, f) => e?.response?.data?.error?.message || e?.response?.data?.message || f;

export default function AdminShipping() {
  const [params, setParams] = useSearchParams();
  const tab = ['partners', 'calculator'].includes(params.get('tab')) ? params.get('tab') : 'shipments';
  return (
    <div className="space-y-4">
      <PageHeader title="Shipping" description="Courier partners, rate comparison, AWB, pickup, labels and live tracking" />
      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'shipments' ? {} : { tab: v })}
        items={[{ value: 'shipments', label: 'Shipments' }, { value: 'calculator', label: 'Rate calculator' }, { value: 'partners', label: 'Partners & settings' }]}
      />
      {tab === 'partners' ? <Partners /> : tab === 'calculator' ? <RateCalculator /> : <Shipments />}
    </div>
  );
}

// ══════════════════════ Shipments board ══════════════════════

function Shipments() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [filter, query, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/shipping/shipments', { params: { filter, search: query || undefined, page, limit: pageSize } });
      setData(r.data.data);
    } catch (e) { toast.error(apiErr(e, 'Could not load shipments')); }
    setLoading(false);
  }, [filter, query, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const c = data?.counts || {};
  const total = data?.pagination?.total ?? 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In transit" value={c.active ?? 0} icon={Truck} tone="info" loading={!data} />
        <Stat label="Delivered" value={c.delivered ?? 0} icon={CheckCircle2} tone="success" loading={!data} />
        <Stat label="RTO / returned" value={c.rto ?? 0} icon={Undo2} tone="warning" loading={!data} />
        <Stat label="Freight booked" value={inr(c.freight ?? 0)} icon={IndianRupee} loading={!data} hint={`${c.all ?? 0} shipments`} />
      </div>
      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search AWB or order #…" className="max-w-xs" />
            <Segmented value={filter} onChange={setFilter} options={[
              { value: 'active', label: 'Active' }, { value: 'delivered', label: 'Delivered' }, { value: 'rto', label: 'RTO' },
              { value: 'issues', label: 'Issues' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' },
            ]} />
            <Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-3.5" /></Button>
          </Toolbar>
          {!data ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="block h-8 w-full" />)}</div>
          ) : data.shipments.length === 0 ? (
            <EmptyState icon={Truck} title="No shipments here">Open an order in <b>Orders</b> and use <b>Compare rates</b> to book a courier.</EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead><tr>
                    <th className="text-left">Order</th><th className="text-left">Courier</th><th className="text-left">AWB</th>
                    <th className="text-left">Status</th><th className="text-right">Freight</th><th className="text-left">Updated</th><th />
                  </tr></thead>
                  <tbody>
                    {data.shipments.map((s) => (
                      <tr key={s.id}>
                        <td className="font-bold text-[color:var(--primary)]">#{s.orderNumber}{s.isCod && <div className="text-[11px] font-normal text-[color:var(--text-muted)]">COD {inr(s.codAmount)}</div>}</td>
                        <td>{s.courierName || '—'}<div className="text-[11px] text-[color:var(--text-muted)]">{s.partner}</div></td>
                        <td className="font-mono text-[12px]">{s.awbCode || '—'}</td>
                        <td>
                          <Badge tone={s.isCancelled ? 'danger' : s.isRto ? 'warning' : s.isDelivered ? 'success' : 'info'}>{s.status || 'NEW'}</Badge>
                          {s.lastError && !s.isCancelled && <div className="mt-0.5 max-w-[260px] text-[11px] text-[color:var(--danger)]">{s.lastError}</div>}
                        </td>
                        <td className="text-right">{inr(s.freightCharge)}</td>
                        <td className="whitespace-nowrap text-[12px] text-[color:var(--text-muted)]">{fmt(s.lastTrackedAt || s.createdAt)}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><Printer className="size-3" /></Button></a>}
                            {s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><ExternalLink className="size-3" /></Button></a>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="shipments" />
            </>
          )}
        </div>
      </Card>
    </>
  );
}

// ══════════════════════ Partners ══════════════════════

function Partners() {
  const [data, setData] = useState(null);
  const [providers, setProviders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [testing, setTesting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, pr] = await Promise.all([api.get('/admin/shipping/partners'), api.get('/admin/shipping/providers')]);
      setData(p.data.data);
      setProviders(pr.data.data || []);
    } catch (e) { toast.error(apiErr(e, 'Could not load partners')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const test = async (p) => {
    setTesting(p.id);
    try {
      const r = await api.post(`/admin/shipping/partners/${p.id}/test`);
      (r.data.data.ok ? toast.success : toast.error)(r.data.data.message, { duration: 8000 });
      await load();
    } catch (e) { toast.error(apiErr(e, 'Test failed')); }
    setTesting(null);
  };

  if (!data) return <Skeleton className="block h-40 w-full" />;
  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ providerCode: providers[0]?.code || 'shiprocket' })}><Plus className="size-3.5" /> Add partner</Button>
      </div>
      {data.partners.length === 0 && (
        <Card><EmptyState icon={PlugZap} title="No shipping partner connected">Add Shiprocket with its API user email & password.</EmptyState></Card>
      )}
      {data.partners.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="space-y-1 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold">{p.displayName}</span>
                <Badge tone={p.isEnabled ? 'success' : 'neutral'}>{p.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                {p.isDefault && <Badge tone="info">Default</Badge>}
                {p.lastTestOk === true && <Badge tone="success"><CheckCircle2 className="size-3" /> Connected</Badge>}
                {p.lastTestOk === false && <Badge tone="danger"><XCircle className="size-3" /> Connection failed</Badge>}
              </div>
              <div className="text-[color:var(--text-muted)]">
                API user: <b>{p.apiUsername || 'not set'}</b> · password {p.hasPassword ? 'saved (encrypted)' : <b className="text-[color:var(--danger)]">missing</b>}
              </div>
              <div className="text-[color:var(--text-muted)]">
                Pickup: <b>{p.pickupLocation || <span className="text-[color:var(--danger)]">not selected</span>}</b> · pincode {p.pickupPincode || '—'}
                · box {p.defaultLengthCm}×{p.defaultBreadthCm}×{p.defaultHeightCm} cm · packaging {p.packagingWeightKg} kg
              </div>
              <div className="text-[color:var(--text-muted)]">
                Auto: {p.autoSchedulePickup ? 'pickup' : 'no pickup'}, {p.autoGenerateLabel ? 'label' : 'no label'} · tracking poll {p.trackingPollMinutes ? `${p.trackingPollMinutes} min` : 'off'}
                · webhook {p.lastWebhookAt ? `last ${fmt(p.lastWebhookAt)}` : 'never received'}
              </div>
              {p.lastTestMessage && <div className={p.lastTestOk ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}>{p.lastTestMessage} <span className="text-[color:var(--text-muted)]">({fmt(p.lastTestedAt)})</span></div>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => test(p)} loading={testing === p.id}><PlugZap className="size-3.5" /> Test connection</Button>
              <Button onClick={() => setEditing(p)}>Edit</Button>
            </div>
          </div>
          <WebhookBox partner={p} url={data.webhookUrl} />
        </Card>
      ))}
      {editing && <PartnerForm initial={editing} providers={providers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

function WebhookBox({ partner, url }) {
  const [token, setToken] = useState(null);
  const reveal = async () => {
    if (token) { setToken(null); return; }
    try { const r = await api.get(`/admin/shipping/partners/${partner.id}/webhook-token`); setToken(r.data.data.token); }
    catch (e) { toast.error(apiErr(e, 'Could not load token')); }
  };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Copied'); };
  return (
    <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-4 py-3 text-[12px]">
      <p className="mb-1 font-bold text-[color:var(--text-secondary)]">Live tracking webhook (paste in {partner.displayName} → Settings → API → Webhooks)</p>
      <div className="flex flex-wrap items-center gap-2">
        <span>URL</span><code className="rounded bg-[color:var(--surface)] px-1.5 py-0.5">{url}</code>
        <Button size="sm" variant="tertiary" onClick={() => copy(url)}><Copy className="size-3" /></Button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span>Token type <b>x-api-key</b> · token</span>
        <code className="rounded bg-[color:var(--surface)] px-1.5 py-0.5">{token || '••••••••••••••••'}</code>
        <Button size="sm" variant="tertiary" onClick={reveal}>{token ? <EyeOff className="size-3" /> : <Eye className="size-3" />}</Button>
        {token && <Button size="sm" variant="tertiary" onClick={() => copy(token)}><Copy className="size-3" /></Button>}
      </div>
      <p className="mt-1 text-[color:var(--text-muted)]">The URL must be reachable from the internet (works after deploy). Until then tracking is refreshed by polling.</p>
    </div>
  );
}

const NUM_FIELDS = ['defaultLengthCm', 'defaultBreadthCm', 'defaultHeightCm', 'packagingWeightKg', 'minWeightKg', 'defaultTaxPercent', 'trackingPollMinutes', 'tokenLifetimeHours'];

const EMPTY_PICKUP = { name: '', contactName: '', email: '', phone: '', address: '', address2: '', city: '', state: '', pincode: '' };

/** Creates a new pickup (warehouse) address directly in the partner account. */
function NewPickupForm({ partnerId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(EMPTY_PICKUP);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/admin/shipping/partners/${partnerId}/pickup-locations`, { ...p, makeDefault: true });
      toast.success(`Pickup address "${r.data.data.name}" added and set as default. Verify its phone in the partner panel if asked.`, { duration: 7000 });
      onAdded({ name: r.data.data.name, pincode: p.pincode });
      setP(EMPTY_PICKUP); setOpen(false);
    } catch (e) { toast.error(apiErr(e, 'Could not add pickup address'), { duration: 9000 }); }
    setBusy(false);
  };

  if (!open) {
    return (
      <button type="button" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[color:var(--accent)] hover:underline" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> Add a new pickup address to the partner account
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-[color:var(--border)] p-3">
      <div className="mb-2 text-[12px] font-semibold">New pickup address</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Nickname" required hint="Shown as the pickup location name (max 36)"><input className="input-field w-full" maxLength={36} value={p.name} onChange={set('name')} placeholder="Ahmedabad Warehouse" /></Field>
        <Field label="Contact name" required hint="Person's name, letters only"><input className="input-field w-full" value={p.contactName} onChange={set('contactName')} placeholder="Yash Patel" /></Field>
        <Field label="Phone" required hint="10-digit mobile"><input className="input-field w-full" inputMode="numeric" value={p.phone} onChange={set('phone')} /></Field>
        <Field label="Email" required><input className="input-field w-full" type="email" value={p.email} onChange={set('email')} /></Field>
        <Field label="Address line 1" required hint="House / shop / building no. + street" className="sm:col-span-2"><input className="input-field w-full" value={p.address} onChange={set('address')} /></Field>
        <Field label="Address line 2 / landmark" className="sm:col-span-3"><input className="input-field w-full" value={p.address2} onChange={set('address2')} /></Field>
        <Field label="City" required><input className="input-field w-full" value={p.city} onChange={set('city')} /></Field>
        <Field label="State" required><input className="input-field w-full" value={p.state} onChange={set('state')} /></Field>
        <Field label="Pincode" required><input className="input-field w-full" maxLength={6} inputMode="numeric" value={p.pincode} onChange={set('pincode')} /></Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={submit} loading={busy}>Add to partner & use it</Button>
      </div>
    </div>
  );
}

function PartnerForm({ initial, providers, onClose, onSaved }) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    providerCode: initial.providerCode || 'shiprocket',
    displayName: initial.displayName || '',
    isEnabled: initial.isEnabled ?? true,
    isDefault: initial.isDefault ?? false,
    apiBaseUrl: initial.apiBaseUrl || 'https://apiv2.shiprocket.in/v1/external',
    apiUsername: initial.apiUsername || '',
    apiPassword: '',
    pickupLocation: initial.pickupLocation || '',
    pickupPincode: initial.pickupPincode || '',
    channelId: initial.channelId || '',
    trackingUrlTemplate: initial.trackingUrlTemplate ?? 'https://shiprocket.co/tracking/{awb}',
    defaultLengthCm: initial.defaultLengthCm ?? 20,
    defaultBreadthCm: initial.defaultBreadthCm ?? 15,
    defaultHeightCm: initial.defaultHeightCm ?? 10,
    packagingWeightKg: initial.packagingWeightKg ?? 0.1,
    minWeightKg: initial.minWeightKg ?? 0.5,
    defaultHsn: initial.defaultHsn ?? '0910',
    defaultTaxPercent: initial.defaultTaxPercent ?? 5,
    autoSchedulePickup: initial.autoSchedulePickup ?? true,
    autoGenerateLabel: initial.autoGenerateLabel ?? true,
    syncOrderStatus: initial.syncOrderStatus ?? true,
    trackingPollMinutes: initial.trackingPollMinutes ?? 120,
    tokenLifetimeHours: initial.tokenLifetimeHours ?? 240,
  });
  const [pickups, setPickups] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const loadPickups = async () => {
    if (isNew) { toast.error('Save the partner first, then load pickup addresses'); return; }
    try {
      const r = await api.get(`/admin/shipping/partners/${initial.id}/pickup-locations`);
      setPickups(r.data.data);
      if (!r.data.data.length) toast.error('No pickup address in the partner account yet');
    } catch (e) { toast.error(apiErr(e, 'Could not load pickup addresses'), { duration: 7000 }); }
  };

  const save = async (regenerate = false) => {
    setSaving(true);
    const body = { ...f, regenerateWebhookToken: regenerate || undefined };
    NUM_FIELDS.forEach((k) => { body[k] = f[k] === '' ? null : Number(f[k]); });
    if (!body.apiPassword) delete body.apiPassword;   // keep the saved one
    try {
      const r = isNew ? await api.post('/admin/shipping/partners', body) : await api.put(`/admin/shipping/partners/${initial.id}`, body);
      toast.success(r.data.message || 'Saved');
      onSaved();
    } catch (e) { toast.error(apiErr(e, 'Could not save')); }
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${initial.displayName}? Existing shipments stay, but you can't book or track with it any more.`)) return;
    try { await api.delete(`/admin/shipping/partners/${initial.id}`); toast.success('Removed'); onSaved(); }
    catch (e) { toast.error(apiErr(e, 'Could not remove')); }
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={isNew ? 'Add shipping partner' : `Edit ${initial.displayName}`}
        onClose={onClose}
        width="max-w-3xl"
        footer={<>
          {!isNew && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="size-3.5" /> Remove</Button>}
          {!isNew && <Button variant="secondary" onClick={() => save(true)} loading={saving}>Save & new webhook token</Button>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save(false)} loading={saving}>Save</Button>
        </>}
      >
        <div className="space-y-4 text-[13px]">
          <Section title="Account">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Partner" required>
                <select className="input-field w-full" value={f.providerCode} onChange={set('providerCode')} disabled={!isNew}>
                  {providers.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Display name"><input className="input-field w-full" value={f.displayName} onChange={set('displayName')} placeholder="Shiprocket" /></Field>
              <Field label="API user email" required hint="Shiprocket → Settings → API → Add API User (must differ from your main login)">
                <input className="input-field w-full" type="email" autoComplete="off" value={f.apiUsername} onChange={set('apiUsername')} />
              </Field>
              <Field label="API password" required={isNew} hint={initial.hasPassword ? 'Saved & encrypted. Leave blank to keep it.' : 'Stored encrypted; never shown again.'}>
                <input className="input-field w-full" type="password" autoComplete="new-password" value={f.apiPassword} onChange={set('apiPassword')} placeholder={initial.hasPassword ? '••••••••' : ''} />
              </Field>
              <Field label="API base URL" className="sm:col-span-2"><input className="input-field w-full" value={f.apiBaseUrl} onChange={set('apiBaseUrl')} /></Field>
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.isEnabled} onChange={set('isEnabled')} /> Enabled</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.isDefault} onChange={set('isDefault')} /> Default partner</label>
              </div>
            </div>
          </Section>

          <Section title="Pickup">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Pickup location name" hint="Exactly as saved in the partner panel">
                {pickups?.length ? (
                  <select className="input-field w-full" value={f.pickupLocation} onChange={(e) => {
                    const p = pickups.find((x) => x.name === e.target.value);
                    setF((x) => ({ ...x, pickupLocation: e.target.value, pickupPincode: p?.pincode || x.pickupPincode }));
                  }}>
                    <option value="">— choose —</option>
                    {pickups.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.city} {p.pincode}{p.isPrimary ? ' (primary)' : ''}</option>)}
                  </select>
                ) : <input className="input-field w-full" value={f.pickupLocation} onChange={set('pickupLocation')} placeholder="Primary" />}
              </Field>
              <Field label="Pickup pincode"><input className="input-field w-full" maxLength={6} value={f.pickupPincode} onChange={set('pickupPincode')} /></Field>
              <div className="flex items-end"><Button variant="secondary" className="w-full" onClick={loadPickups}>Load from partner</Button></div>
            </div>
            {!isNew && (
              <NewPickupForm partnerId={initial.id} onAdded={(loc) => {
                setF((x) => ({ ...x, pickupLocation: loc.name, pickupPincode: loc.pincode }));
                loadPickups();
              }} />
            )}
          </Section>

          <Section title="Default parcel">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Length (cm)"><input type="number" className="input-field w-full" value={f.defaultLengthCm} onChange={set('defaultLengthCm')} /></Field>
              <Field label="Breadth (cm)"><input type="number" className="input-field w-full" value={f.defaultBreadthCm} onChange={set('defaultBreadthCm')} /></Field>
              <Field label="Height (cm)"><input type="number" className="input-field w-full" value={f.defaultHeightCm} onChange={set('defaultHeightCm')} /></Field>
              <Field label="Packaging (kg)"><input type="number" step="0.01" className="input-field w-full" value={f.packagingWeightKg} onChange={set('packagingWeightKg')} /></Field>
              <Field label="Minimum weight (kg)"><input type="number" step="0.01" className="input-field w-full" value={f.minWeightKg} onChange={set('minWeightKg')} /></Field>
              <Field label="HSN code"><input className="input-field w-full" value={f.defaultHsn} onChange={set('defaultHsn')} /></Field>
              <Field label="GST %"><input type="number" className="input-field w-full" value={f.defaultTaxPercent} onChange={set('defaultTaxPercent')} /></Field>
              <Field label="Channel ID (optional)"><input className="input-field w-full" value={f.channelId} onChange={set('channelId')} /></Field>
            </div>
          </Section>

          <Section title="Automation & tracking">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.autoSchedulePickup} onChange={set('autoSchedulePickup')} /> Request pickup right after AWB</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.autoGenerateLabel} onChange={set('autoGenerateLabel')} /> Generate label right after AWB</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.syncOrderStatus} onChange={set('syncOrderStatus')} /> Update order status from courier scans (emails the customer)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tracking poll (min)" hint="0 = webhook only"><input type="number" className="input-field w-full" value={f.trackingPollMinutes} onChange={set('trackingPollMinutes')} /></Field>
                <Field label="Token valid (hours)"><input type="number" className="input-field w-full" value={f.tokenLifetimeHours} onChange={set('tokenLifetimeHours')} /></Field>
              </div>
              <Field label="Customer tracking link" hint="{awb} is replaced with the AWB number" className="sm:col-span-2">
                <input className="input-field w-full" value={f.trackingUrlTemplate} onChange={set('trackingUrlTemplate')} />
              </Field>
            </div>
          </Section>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">{title}</p>
      {children}
    </div>
  );
}
