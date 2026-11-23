import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, RefreshCw, Printer, FileText, PackageCheck, XCircle, ExternalLink, Zap, Star, BadgeIndianRupee, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { Badge, Button, Field, Segmented, Skeleton, cn } from '@/admin/ui';

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const apiErr = (e, f) => e?.response?.data?.error?.message || e?.response?.data?.message || f;

const shipTone = (s) => {
  if (!s) return 'neutral';
  if (s.isCancelled) return 'danger';
  if (s.isRto) return 'warning';
  if (s.isDelivered) return 'success';
  return 'info';
};

/**
 * Order → Shipping: compare courier rates across every connected partner, book the cheapest/fastest one
 * (AWB + pickup + label in one click) and manage the shipment (label, manifest, invoice, tracking, cancel).
 */
export default function ShippingPanel({ orderId, onChanged }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parcel, setParcel] = useState({ weightKg: '', lengthCm: '', breadthCm: '', heightCm: '' });
  const [quotes, setQuotes] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [sort, setSort] = useState('rate');
  const [codOnly, setCodOnly] = useState(false);
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState('');
  const [pickup, setPickup] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/shipping/orders/${orderId}`);
      const d = r.data.data;
      setInfo(d);
      if (d.parcel) setParcel({ weightKg: d.parcel.weightKg, lengthCm: d.parcel.lengthCm, breadthCm: d.parcel.breadthCm, heightCm: d.parcel.heightCm });
      const def = d.partners?.find((p) => p.isDefault) || d.partners?.[0];
      if (def) setPickup(def.autoSchedulePickup !== false);
    } catch (e) { toast.error(apiErr(e, 'Could not load shipping info')); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const active = info?.shipments?.find((s) => !s.isCancelled);
  const canShip = info && !active?.awbCode && !['Cancelled', 'Delivered', 'Returned', 'Refunded', 'ReturnRequested'].includes(info.status)
    && (info.paymentMethod === 'CashOnDelivery' || info.paymentStatus === 'Paid');

  const getRates = async () => {
    setQuoting(true);
    try {
      const body = Object.fromEntries(Object.entries(parcel).map(([k, v]) => [k, v === '' ? null : Number(v)]));
      const r = await api.post(`/admin/shipping/orders/${orderId}/rates`, body);
      setQuotes(r.data.data);
      if (!r.data.data.options?.length) toast.error('No courier available for this pincode / parcel');
    } catch (e) { toast.error(apiErr(e, 'Rate check failed')); }
    setQuoting(false);
  };

  const ship = async (opt) => {
    if (!window.confirm(`Book ${opt.courierName} via ${opt.partner} for ${inr(opt.rate)}?\nThis creates a real shipment and assigns an AWB.`)) return;
    setBooking(`${opt.accountId}:${opt.courierCompanyId}`);
    try {
      const r = await api.post(`/admin/shipping/orders/${orderId}/ship`, {
        accountId: opt.accountId, courierCompanyId: opt.courierCompanyId, freightCharge: opt.rate, estimatedDays: opt.estimatedDays,
        weightKg: Number(parcel.weightKg) || null, lengthCm: Number(parcel.lengthCm) || null,
        breadthCm: Number(parcel.breadthCm) || null, heightCm: Number(parcel.heightCm) || null, schedulePickup: pickup,
      });
      toast.success(r.data.message || 'Shipment booked');
      if (r.data.data?.lastError) toast.error(r.data.data.lastError, { duration: 7000 });
      setQuotes(null);
      await load();
      onChanged?.();
    } catch (e) { toast.error(apiErr(e, 'Booking failed'), { duration: 7000 }); await load(); }
    setBooking(null);
  };

  const act = async (s, action) => {
    if (action === 'cancel' && !window.confirm(`Cancel shipment ${s.awbCode || ''} on ${s.partner}?`)) return;
    setBusy(`${s.id}:${action}`);
    try {
      const r = await api.post(`/admin/shipping/shipments/${s.id}/${action}`);
      const url = r.data.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      toast.success(action === 'track' ? 'Tracking refreshed' : action === 'cancel' ? 'Shipment cancelled' : 'Done');
      await load();
      if (action === 'cancel' || action === 'track') onChanged?.();
    } catch (e) { toast.error(apiErr(e, 'Action failed'), { duration: 6000 }); await load(); }
    setBusy('');
  };

  const options = useMemo(() => {
    let list = [...(quotes?.options || [])];
    if (codOnly) list = list.filter((o) => o.codAvailable);
    if (sort === 'days') list.sort((a, b) => (a.estimatedDaysMax ?? 99) - (b.estimatedDaysMax ?? 99) || a.rate - b.rate);
    else if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.rate - b.rate);
    else list.sort((a, b) => a.rate - b.rate);
    return list;
  }, [quotes, sort, codOnly]);

  if (loading && !info) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="block h-6 w-full" />)}</div>;
  if (!info) return null;

  const noPartner = !info.partners?.length;
  const visible = showAll ? options : options.slice(0, 8);

  return (
    <div className="rounded-[6px] border border-[color:var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-[color:var(--text-secondary)]"><Truck className="size-3.5" /> Shipping</p>
        <Button size="sm" variant="tertiary" onClick={load} loading={loading}><RefreshCw className="size-3" /></Button>
      </div>

      {/* Existing shipments */}
      {info.shipments?.map((s) => (
        <div key={s.id} className={cn('mb-3 rounded-[6px] border p-2.5', s.isCancelled ? 'border-dashed border-[color:var(--border)] opacity-70' : 'border-[color:var(--border)] bg-[color:var(--surface-secondary)]')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={shipTone(s)}>{s.status || 'NEW'}</Badge>
            <span className="font-bold">{s.courierName || 'Courier not assigned'}</span>
            <span className="text-[color:var(--text-muted)]">via {s.partner}</span>
            {s.awbCode && <span className="font-mono text-[12px]">AWB {s.awbCode}</span>}
            {s.freightCharge != null && <span className="text-[12px] text-[color:var(--text-muted)]">· {inr(s.freightCharge)}</span>}
            {s.isCod && <Badge tone="warning">COD {inr(s.codAmount)}</Badge>}
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">
            {s.weightKg} kg · {s.lengthCm}×{s.breadthCm}×{s.heightCm} cm
            {s.pickupScheduledAt && <> · pickup {fmt(s.pickupScheduledAt)}</>}
            {s.etd && <> · expected {fmt(s.etd)}</>}
            {s.lastTrackedAt && <> · tracked {fmt(s.lastTrackedAt)}</>}
          </div>
          {s.lastError && !s.isCancelled && <p className="mt-1 text-[12px] text-[color:var(--danger)]">{s.lastError}</p>}

          {!s.isCancelled && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><ExternalLink className="size-3" /> Track</Button></a>}
              {s.awbCode && !s.isDelivered && <Button size="sm" variant="secondary" loading={busy === `${s.id}:track`} onClick={() => act(s, 'track')}><RefreshCw className="size-3" /> Refresh</Button>}
              {s.awbCode && (s.labelUrl
                ? <a href={s.labelUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><Printer className="size-3" /> Label</Button></a>
                : <Button size="sm" variant="secondary" loading={busy === `${s.id}:label`} onClick={() => act(s, 'label')}><Printer className="size-3" /> Label</Button>)}
              {s.awbCode && !s.pickupScheduledAt && !s.isDelivered && <Button size="sm" variant="secondary" loading={busy === `${s.id}:pickup`} onClick={() => act(s, 'pickup')}><CalendarClock className="size-3" /> Request pickup</Button>}
              {s.awbCode && <Button size="sm" variant="secondary" loading={busy === `${s.id}:manifest`} onClick={() => act(s, 'manifest')}><PackageCheck className="size-3" /> Manifest</Button>}
              <Button size="sm" variant="secondary" loading={busy === `${s.id}:invoice`} onClick={() => act(s, 'invoice')}><FileText className="size-3" /> Courier invoice</Button>
              {!s.isDelivered && !s.isRto && <Button size="sm" variant="danger" loading={busy === `${s.id}:cancel`} onClick={() => act(s, 'cancel')}><XCircle className="size-3" /> Cancel</Button>}
            </div>
          )}

          {s.events?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-bold text-[color:var(--text-secondary)]">Tracking timeline ({s.events.length})</summary>
              <ol className="mt-1.5 space-y-1 border-l border-[color:var(--border)] pl-3">
                {s.events.map((e, i) => (
                  <li key={i} className="text-[12px]">
                    <span className="font-bold">{e.status}</span>
                    {e.activity && <span className="text-[color:var(--text-secondary)]"> — {e.activity}</span>}
                    <div className="text-[color:var(--text-muted)]">{fmt(e.occurredAt)}{e.location ? ` · ${e.location}` : ''}</div>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      ))}

      {noPartner && (
        <p className="text-[12px] text-[color:var(--text-muted)]">No shipping partner connected. Add Shiprocket in <a className="font-bold text-[color:var(--primary)]" href="/admin/shipping?tab=partners">Shipping → Partners</a>.</p>
      )}

      {canShip && !noPartner && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Field label="Weight (kg)"><input type="number" step="0.01" min="0.01" className="input-field w-full" value={parcel.weightKg} onChange={(e) => setParcel((p) => ({ ...p, weightKg: e.target.value }))} /></Field>
            <Field label="L (cm)"><input type="number" min="1" className="input-field w-full" value={parcel.lengthCm} onChange={(e) => setParcel((p) => ({ ...p, lengthCm: e.target.value }))} /></Field>
            <Field label="B (cm)"><input type="number" min="1" className="input-field w-full" value={parcel.breadthCm} onChange={(e) => setParcel((p) => ({ ...p, breadthCm: e.target.value }))} /></Field>
            <Field label="H (cm)"><input type="number" min="1" className="input-field w-full" value={parcel.heightCm} onChange={(e) => setParcel((p) => ({ ...p, heightCm: e.target.value }))} /></Field>
            <div className="flex items-end"><Button className="w-full" onClick={getRates} loading={quoting}><BadgeIndianRupee className="size-3.5" /> Compare rates</Button></div>
          </div>
          <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
            Weight is estimated from the pack sizes + packaging. Couriers charge the higher of actual and volumetric weight (L×B×H ÷ 5000).
          </p>

          {quotes && (
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12px] text-[color:var(--text-muted)]">
                  {quotes.options?.length || 0} options to {quotes.deliveryPincode} · {quotes.parcel?.weightKg} kg · {quotes.isCod ? 'COD' : 'Prepaid'}
                  {quotes.partners?.filter((p) => !p.ok || p.error).map((p) => (
                    <div key={p.accountId} className={p.ok ? '' : 'text-[color:var(--danger)]'}>{p.partnerName}: {p.error}</div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={codOnly} onChange={(e) => setCodOnly(e.target.checked)} /> COD only</label>
                  <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'rate', label: 'Cheapest' }, { value: 'days', label: 'Fastest' }, { value: 'rating', label: 'Rating' }]} />
                </div>
              </div>
              {options.length > 0 && (
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Courier</th>
                        <th className="text-left">Partner</th>
                        <th className="text-right">Rate</th>
                        <th className="text-left">Delivery</th>
                        <th className="text-right">Rating</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((o) => (
                        <tr key={`${o.accountId}:${o.courierCompanyId}`}>
                          <td>
                            <div className="font-bold">{o.courierName}</div>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {o.cheapest && <Badge tone="success"><BadgeIndianRupee className="size-3" /> Cheapest</Badge>}
                              {o.fastest && <Badge tone="info"><Zap className="size-3" /> Fastest</Badge>}
                              {o.bestValue && <Badge tone="warning"><Star className="size-3" /> Best value</Badge>}
                              {o.recommended && <Badge>Partner pick</Badge>}
                              <span className="text-[11px] text-[color:var(--text-muted)]">{o.isSurface ? 'Surface' : 'Air'}{o.codAvailable ? ' · COD' : ''}</span>
                            </div>
                          </td>
                          <td className="text-[color:var(--text-muted)]">{o.partner}</td>
                          <td className="text-right">
                            <div className="font-bold">{inr(o.rate)}</div>
                            {o.codCharge > 0 && <div className="text-[11px] text-[color:var(--text-muted)]">incl. COD {inr(o.codCharge)}</div>}
                            <div className="text-[11px] text-[color:var(--text-muted)]">{o.chargeableWeightKg} kg</div>
                          </td>
                          <td className="whitespace-nowrap">
                            {o.estimatedDays ? `${o.estimatedDays} days` : '—'}
                            {o.etd && <div className="text-[11px] text-[color:var(--text-muted)]">{o.etd}</div>}
                          </td>
                          <td className="text-right">{o.rating != null ? Number(o.rating).toFixed(1) : '—'}</td>
                          <td className="text-right">
                            <Button size="sm" loading={booking === `${o.accountId}:${o.courierCompanyId}`} disabled={!!booking} onClick={() => ship(o)}>Ship</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {options.length > 8 && (
                <button type="button" className="mt-1 text-[12px] font-bold text-[color:var(--primary)]" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show all ${options.length} options`}
                </button>
              )}
              <label className="mt-2 flex items-center gap-1.5 text-[12px]">
                <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} /> Request pickup right after booking
              </label>
            </div>
          )}
        </>
      )}

      {!canShip && !active && !noPartner && (
        <p className="text-[12px] text-[color:var(--text-muted)]">
          {info.paymentMethod !== 'CashOnDelivery' && info.paymentStatus !== 'Paid' ? 'Waiting for payment before shipping.' : `A ${info.status} order can't be shipped.`}
        </p>
      )}
    </div>
  );
}
