import { useMemo, useState } from 'react';
import { Calculator, BadgeIndianRupee, Zap, Star, MapPin, ArrowRight, Package, Scale, Truck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { Badge, Button, Card, EmptyState, Field, Segmented, Skeleton, Stat } from '@/admin/ui';

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const apiErr = (e, f) => e?.response?.data?.error?.message || e?.response?.data?.message || f;

const START = { pickupPincode: '', deliveryPincode: '', weightKg: '0.5', lengthCm: '20', breadthCm: '15', heightCm: '10', isCod: false, declaredValue: '500' };

/**
 * Admin → Shipping → Rate calculator: enter any pincodes and parcel details and see what every connected
 * partner's couriers will charge — no order needed. Blank pickup pincode = each partner's saved pickup address.
 */
export default function RateCalculator() {
  const [f, setF] = useState(START);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('rate');
  const [codOnly, setCodOnly] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const volumetric = useMemo(() => {
    const v = (Number(f.lengthCm) || 0) * (Number(f.breadthCm) || 0) * (Number(f.heightCm) || 0) / 5000;
    return Math.round(v * 100) / 100;
  }, [f.lengthCm, f.breadthCm, f.heightCm]);

  const calculate = async (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(f.deliveryPincode.trim())) { toast.error('Enter a 6-digit delivery pincode'); return; }
    if (f.pickupPincode.trim() && !/^\d{6}$/.test(f.pickupPincode.trim())) { toast.error('Pickup pincode must be 6 digits'); return; }
    if (!(Number(f.weightKg) > 0)) { toast.error('Enter the parcel weight'); return; }
    setBusy(true);
    try {
      const num = (v) => (v === '' ? null : Number(v));
      const r = await api.post('/admin/shipping/calculator', {
        pickupPincode: f.pickupPincode.trim() || null,
        deliveryPincode: f.deliveryPincode.trim(),
        weightKg: num(f.weightKg), lengthCm: num(f.lengthCm), breadthCm: num(f.breadthCm), heightCm: num(f.heightCm),
        isCod: f.isCod, declaredValue: num(f.declaredValue),
      });
      setRes(r.data.data);
      if (!r.data.data.options?.length) toast.error('No courier available for these details');
    } catch (err) { toast.error(apiErr(err, 'Could not calculate rates'), { duration: 7000 }); }
    setBusy(false);
  };

  const options = useMemo(() => {
    let list = [...(res?.options || [])];
    if (codOnly) list = list.filter((o) => o.codAvailable);
    if (sort === 'days') list.sort((a, b) => (a.estimatedDaysMax ?? 99) - (b.estimatedDaysMax ?? 99) || a.rate - b.rate);
    else if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.rate - b.rate);
    else list.sort((a, b) => a.rate - b.rate);
    return list;
  }, [res, sort, codOnly]);

  const cheapestOpt = options.length ? options.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;
  const fastestOpt = options.filter((o) => o.estimatedDaysMax != null)
    .reduce((a, b) => (!a || b.estimatedDaysMax < a.estimatedDaysMax || (b.estimatedDaysMax === a.estimatedDaysMax && b.rate < a.rate) ? b : a), null);
  const chargeable = Math.max(volumetric, Number(f.weightKg) || 0);

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* ── inputs ── */}
      <Card title={<span className="flex items-center gap-1.5"><Calculator className="size-4" /> Shipping rate calculator</span>} bodyClassName="p-4">
        <form onSubmit={calculate} className="space-y-5 text-[13px]">
          <Group icon={MapPin} title="Route">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <Field label="Pickup pincode" hint="Blank = saved pickup">
                <input className="input-field w-full tabular-nums" inputMode="numeric" maxLength={6} value={f.pickupPincode} onChange={set('pickupPincode')} placeholder="Saved" />
              </Field>
              <ArrowRight className="mt-8 size-4 text-[color:var(--text-muted)]" />
              <Field label="Delivery pincode" required>
                <input className="input-field w-full tabular-nums" inputMode="numeric" maxLength={6} value={f.deliveryPincode} onChange={set('deliveryPincode')} placeholder="400001" autoFocus />
              </Field>
            </div>
          </Group>

          <Group icon={Package} title="Parcel">
            <Field label="Actual weight" required>
              <Unit unit="kg"><input className="input-field w-full pr-9 tabular-nums" type="number" step="0.01" min="0.01" value={f.weightKg} onChange={set('weightKg')} /></Unit>
            </Field>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Field label="Length"><Unit unit="cm"><input className="input-field w-full pr-9 tabular-nums" type="number" min="1" value={f.lengthCm} onChange={set('lengthCm')} /></Unit></Field>
              <Field label="Breadth"><Unit unit="cm"><input className="input-field w-full pr-9 tabular-nums" type="number" min="1" value={f.breadthCm} onChange={set('breadthCm')} /></Unit></Field>
              <Field label="Height"><Unit unit="cm"><input className="input-field w-full pr-9 tabular-nums" type="number" min="1" value={f.heightCm} onChange={set('heightCm')} /></Unit></Field>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-[color:var(--border)] text-center">
              <WeightCell label="Actual" value={Number(f.weightKg) || 0} />
              <WeightCell label="Volumetric" value={volumetric} />
              <WeightCell label="Charged on" value={chargeable} strong />
            </div>
            <p className="mt-1.5 text-[11px] text-[color:var(--text-muted)]">Volumetric = L × B × H ÷ 5000. Couriers bill the higher of the two.</p>
          </Group>

          <Group icon={BadgeIndianRupee} title="Payment">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mode">
                <Segmented className="flex w-full [&>button]:flex-1" value={f.isCod ? 'cod' : 'prepaid'} onChange={(v) => setF((x) => ({ ...x, isCod: v === 'cod' }))}
                  options={[{ value: 'prepaid', label: 'Prepaid' }, { value: 'cod', label: 'COD' }]} />
              </Field>
              <Field label="Declared value">
                <Unit unit="₹" left><input className="input-field w-full pl-7 tabular-nums" type="number" min="0" value={f.declaredValue} onChange={set('declaredValue')} /></Unit>
              </Field>
            </div>
          </Group>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => { setF(START); setRes(null); }}>Reset</Button>
            <Button type="submit" className="flex-1" loading={busy}><Truck className="size-3.5" /> Calculate charges</Button>
          </div>
        </form>
      </Card>

      {/* ── results ── */}
      <div className="min-w-0 space-y-4">
        {busy && !res && (
          <Card bodyClassName="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</Card>
        )}
        {!busy && !res && (
          <Card>
            <EmptyState icon={Calculator} title="Compare courier charges">
              Enter the delivery pincode and parcel details, then press <b>Calculate charges</b>. Every connected partner is checked live.
            </EmptyState>
          </Card>
        )}
        {res && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Cheapest" icon={BadgeIndianRupee} tone="success" value={cheapestOpt ? inr(cheapestOpt.rate) : '—'} hint={cheapestOpt?.courierName} />
              <Stat label="Fastest" icon={Zap} tone="info" value={fastestOpt ? `${fastestOpt.estimatedDays} days` : '—'} hint={fastestOpt ? `${fastestOpt.courierName} · ${inr(fastestOpt.rate)}` : undefined} />
              <Stat label="Options" icon={Truck} value={options.length} hint={`${res.isCod ? 'COD' : 'Prepaid'} · ${res.parcel?.weightKg} kg actual`} />
              <Stat label="Charged weight" icon={Scale} value={`${res.chargeableWeightKg} kg`} hint={`Volumetric ${res.volumetricWeightKg} kg`} />
            </div>

            <Card
              title={`Courier options${options.length ? ` (${options.length})` : ''}`}
              actions={<>
                <label className="hidden items-center gap-1 text-[12px] sm:flex"><input type="checkbox" checked={codOnly} onChange={(e) => setCodOnly(e.target.checked)} /> COD only</label>
                <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'rate', label: 'Cheapest' }, { value: 'days', label: 'Fastest' }, { value: 'rating', label: 'Rating' }]} />
              </>}
            >
              {res.partners?.some((p) => !p.ok || p.error) && (
                <div className="space-y-0.5 border-b border-[color:var(--border)] px-3 py-2 text-[12px]">
                  {res.partners.filter((p) => !p.ok || p.error).map((p) => (
                    <div key={p.accountId} className={p.ok ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--danger)]'}><b>{p.partnerName}:</b> {p.error}</div>
                  ))}
                </div>
              )}
              {options.length === 0 ? (
                <EmptyState icon={Truck} title="No courier available">Try another pincode, a lighter/smaller parcel, or switch COD off.</EmptyState>
              ) : (
                <div className="grid-box overflow-x-auto rounded-none border-0">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Courier</th>
                        <th className="text-right">Freight</th>
                        <th className="text-right">COD</th>
                        <th className="text-right">Total</th>
                        <th className="text-left">Delivery</th>
                        <th className="text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((o) => (
                        <tr key={`${o.accountId}:${o.courierCompanyId}`}>
                          <td>
                            <div className="font-bold">{o.courierName}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              {o.cheapest && <Badge tone="success">Cheapest</Badge>}
                              {o.fastest && <Badge tone="info">Fastest</Badge>}
                              {o.bestValue && <Badge tone="warning"><Star className="size-3" /> Best value</Badge>}
                              {o.recommended && <Badge>Partner pick</Badge>}
                              <span className="text-[11px] text-[color:var(--text-muted)]">
                                {o.partner} · {o.isSurface ? 'Surface' : 'Air'}{o.codAvailable ? ' · COD ok' : ''} · {o.chargeableWeightKg ?? '—'} kg
                              </span>
                            </div>
                          </td>
                          <td className="text-right tabular-nums">{inr(o.freight)}</td>
                          <td className="text-right tabular-nums">{o.codCharge > 0 ? inr(o.codCharge) : '—'}</td>
                          <td className="text-right text-[14px] font-bold tabular-nums">{inr(o.rate)}</td>
                          <td className="whitespace-nowrap">
                            <span className="inline-flex items-center gap-1"><Clock className="size-3 text-[color:var(--text-muted)]" />{o.estimatedDays ? `${o.estimatedDays} days` : '—'}</span>
                            {o.etd && <div className="text-[11px] text-[color:var(--text-muted)]">by {o.etd}</div>}
                          </td>
                          <td className="text-right tabular-nums">{o.rating != null ? `★ ${Number(o.rating).toFixed(1)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="border-t border-[color:var(--border)] px-3 py-2 text-[11px] text-[color:var(--text-muted)]">
                Live rates from each partner, usually incl. GST. The final bill can change if the courier weighs the parcel heavier (weight discrepancy).
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Group({ icon: Icon, title, children }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">
        <Icon className="size-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

function Unit({ unit, left, children }) {
  return (
    <div className="relative">
      {children}
      <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[12px] text-[color:var(--text-muted)] ${left ? 'left-2.5' : 'right-2.5'}`}>{unit}</span>
    </div>
  );
}

function WeightCell({ label, value, strong }) {
  return (
    <div className={strong ? 'bg-[color:var(--primary-soft)] px-2 py-1.5' : 'bg-[color:var(--surface)] px-2 py-1.5'}>
      <div className="text-[11px] text-[color:var(--text-muted)]">{label}</div>
      <div className={`tabular-nums ${strong ? 'font-bold text-[color:var(--primary)]' : 'font-semibold'}`}>{value} kg</div>
    </div>
  );
}
