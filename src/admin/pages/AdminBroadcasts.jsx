import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, Plus, Send, CalendarClock, StopCircle, Trash2, Pencil, Eye, Bell, X, Users, Radio } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { PageHeader, Card, Badge, Button, Tabs, SearchInput, Toolbar, EmptyState, Skeleton, Pagination, DialogPanel, Field } from '@/admin/ui';
import { useLookups } from '@/admin/lookups';
import { getImageUrl } from '@/utils/product';
import { TypeSelect, ImageUpload, AudiencePicker, FieldGroup } from '@/admin/components/marketing/MarketingFields';
import { errMsg, fmtDate, fmtNum, toLocalInput, fromLocalInput, useDebounced, linkError } from '@/admin/components/marketing/marketingUtils';

const STATUS_TABS = ['all', 'Draft', 'Scheduled', 'Published', 'Ended'];
const STATUS_TONE = { Draft: 'neutral', Scheduled: 'info', Published: 'success', Ended: 'warning' };

const EMPTY = {
  type: 'Offer', title: '', message: '', imageUrl: '', buttonLabel: '', buttonUrl: '',
  audienceType: 'All', userIds: [], showAsBanner: true, activeFrom: '', activeUntil: '',
};

const toRequest = (f, action) => ({
  type: f.type, title: f.title, message: f.message, imageUrl: f.imageUrl || null,
  buttonLabel: f.buttonLabel || null, buttonUrl: f.buttonUrl || null,
  audienceType: f.audienceType, userIds: f.audienceType === 'Selected' ? f.userIds : [],
  showAsBanner: f.showAsBanner, activeFrom: fromLocalInput(f.activeFrom), activeUntil: fromLocalInput(f.activeUntil), action,
});

/** What the customer sees: banner card + bell row (same look as the website). */
function CustomerPreview({ f, typeLabel }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center gap-1 text-[12px] text-[color:var(--text-muted)]"><Eye className="size-3.5" />Banner (popup) preview{!f.showAsBanner && ' — banner is off, bell only'}</div>
        <div className={`rounded-[10px] bg-black/50 p-5 ${f.showAsBanner ? '' : 'opacity-40'}`}>
          <div className="relative mx-auto max-w-sm overflow-hidden rounded-3xl bg-white font-body shadow-2xl">
            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow"><X className="h-4 w-4" /></span>
            {f.imageUrl && <img src={getImageUrl(f.imageUrl)} alt="" className="block max-h-48 w-full object-cover" />}
            <div className="p-5">
              <span className="inline-block rounded-full bg-brand-orange/15 px-3 py-1 text-xs font-semibold text-[#9a5b00]">{typeLabel}</span>
              <div className="mt-2 pr-6 text-lg font-bold leading-snug text-brand-green-dark">{f.title || 'Your title'}</div>
              {f.message && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-600">{f.message}</p>}
              <div className="mt-4 flex gap-2">
                {f.buttonLabel && f.buttonUrl && <span className="rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white">{f.buttonLabel}</span>}
                <span className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600">{f.buttonLabel && f.buttonUrl ? 'Maybe later' : 'Got it'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-1 text-[12px] text-[color:var(--text-muted)]"><Bell className="size-3.5" />Notification bell preview</div>
        <div className="flex gap-3 rounded-[8px] border border-[color:var(--border)] bg-white p-3 font-body">
          {f.imageUrl ? <img src={getImageUrl(f.imageUrl)} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-cream text-brand-green"><Bell className="h-5 w-5" /></span>}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-gray-400"><span className="rounded-full bg-brand-orange/15 px-2 py-0.5 font-semibold text-[#9a5b00]">{typeLabel}</span> · just now</div>
            <div className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">{f.title || 'Your title'}</div>
            {f.message && <div className="line-clamp-2 text-xs text-gray-500">{f.message}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer({ initial, onClose, onSaved }) {
  const lk = useLookups();
  const [f, setF] = useState(() => ({ ...EMPTY, ...initial, activeFrom: toLocalInput(initial?.activeFrom), activeUntil: toLocalInput(initial?.activeUntil) }));
  const [busy, setBusy] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const id = initial?.id;
  const linkErr = linkError(f.buttonUrl);
  const scheduled = f.activeFrom && new Date(f.activeFrom) > new Date(Date.now() + 30_000);

  const submit = async (action) => {
    if (action === 'publish') {
      const who = f.audienceType === 'All' ? 'ALL customers' : `${fmtNum(f.userIds.length)} selected customer(s)`;
      const when = scheduled ? `at ${fmtDate(fromLocalInput(f.activeFrom))}` : 'now (customers who are online see it immediately)';
      if (!window.confirm(`Publish “${f.title}” to ${who} ${when}?`)) return;
    }
    setBusy(action);
    try {
      const body = toRequest(f, action);
      const r = id ? await api.put(`/admin/marketing/broadcasts/${id}`, body) : await api.post('/admin/marketing/broadcasts', body);
      toast.success(r.data.message);
      onSaved(); onClose();
    } catch (err) { toast.error(errMsg(err, 'Could not save')); }
    finally { setBusy(null); }
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={id ? 'Edit broadcast' : 'New broadcast'}
        onClose={onClose}
        width="max-w-5xl"
        footer={(
          <>
            <Button size="sm" variant="secondary" onClick={() => submit('draft')} loading={busy === 'draft'}>Save draft</Button>
            <Button size="sm" onClick={() => submit('publish')} loading={busy === 'publish'}>
              {scheduled ? <><CalendarClock className="size-3.5" />Schedule</> : <><Send className="size-3.5" />Publish now</>}
            </Button>
          </>
        )}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <TypeSelect value={f.type} onChange={(type) => set({ type })} />
              <Field label="Title" required hint={`${f.title.length}/150`}>
                <input type="text" className="input-field w-full" maxLength={150} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Flat 15% off this weekend" />
              </Field>
            </div>
            <Field label="Message" hint={`Plain text. Text, an image, or both. ${f.message.length}/2000`}>
              <textarea className="input-field w-full" rows={4} maxLength={2000} value={f.message} onChange={(e) => set({ message: e.target.value })} placeholder="Stock up on your favourite masalas — offer ends Sunday." />
            </Field>
            <ImageUpload value={f.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <Field label="Button text"><input type="text" className="input-field w-full" maxLength={40} value={f.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} placeholder="Shop now" /></Field>
              <Field label="Button link" error={linkErr} hint="Site path like /products or https:// link">
                <input type="text" className="input-field w-full" value={f.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} placeholder="/products" />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-0.5" checked={f.showAsBanner} onChange={(e) => set({ showAsBanner: e.target.checked })} />
              <span><b>Show as a banner popup</b><span className="block text-[12px] text-[color:var(--text-muted)]">Shown once (right away if the customer is online, otherwise after they sign in) — never on checkout or payment screens. It always appears in the notification bell too.</span></span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start at" hint="Empty = publish immediately">
                <input type="datetime-local" className="input-field w-full" value={f.activeFrom} onChange={(e) => set({ activeFrom: e.target.value })} />
              </Field>
              <Field label="Show until" hint="Optional — banner stops after this">
                <input type="datetime-local" className="input-field w-full" value={f.activeUntil} onChange={(e) => set({ activeUntil: e.target.value })} />
              </Field>
            </div>
            <FieldGroup label="Audience" required>
              <AudiencePicker value={{ audienceType: f.audienceType, userIds: f.userIds }} onChange={(v) => set(v)} channels={['inApp']} initialUsers={initial?.selectedUsers || []} />
            </FieldGroup>
          </div>
          <div className="min-w-0"><CustomerPreview f={f} typeLabel={lk.label('CampaignType', f.type)} /></div>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

export default function AdminBroadcasts() {
  const lk = useLookups();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState(null);
  const [composer, setComposer] = useState(null);
  const [busy, setBusy] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    try {
      const r = await api.get('/admin/marketing/broadcasts', { params: { status: tab, search: q || undefined, page, limit: pageSize } });
      if (my === reqId.current) setData(r.data.data);
    } catch (err) { toast.error(errMsg(err, 'Could not load broadcasts')); }
  }, [tab, q, page, pageSize]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, q]);
  // seen / read counters move while a broadcast is live
  useEffect(() => {
    if (!(data?.items || []).some((b) => b.status === 'Published' || b.status === 'Scheduled')) return undefined;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [data, load]);

  const act = async (tag, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(tag);
    try { const r = await fn(); toast.success(r.data.message || 'Done'); load(); }
    catch (err) { toast.error(errMsg(err, 'Action failed')); }
    finally { setBusy(null); }
  };

  const edit = async (b) => {
    try {
      const r = await api.get(`/admin/marketing/broadcasts/${b.id}`);
      const x = r.data.data.broadcast;
      setComposer({ ...x, message: x.message || '', imageUrl: x.imageUrl || '', buttonLabel: x.buttonLabel || '', buttonUrl: x.buttonUrl || '', selectedUsers: r.data.data.selectedUsers || [] });
    } catch (err) { toast.error(errMsg(err, 'Could not open broadcast')); }
  };

  const counts = data?.statusCounts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Broadcasts"
        description="In-app announcements: a one-time banner popup plus an entry in every customer's notification bell — delivered live to customers who are online."
        actions={<Button onClick={() => setComposer({})}><Plus className="size-4" />New broadcast</Button>}
      />
      <Card>
        <Tabs className="px-2" value={tab} onChange={setTab}
          items={STATUS_TABS.map((s) => ({ value: s, label: s === 'all' ? 'All' : s, count: s === 'all' ? total : (counts[s] || 0) }))} />
        <div className="space-y-3 p-3">
          <Toolbar><SearchInput value={search} onChange={setSearch} placeholder="Search broadcasts…" /></Toolbar>
          {!data ? <Skeleton className="h-40 w-full" /> : data.items.length === 0 ? (
            <EmptyState icon={BellRing} title="No broadcasts yet" action={<Button size="sm" onClick={() => setComposer({})}><Plus className="size-3.5" />Create one</Button>}>
              Tell customers about an offer, a sale or a new launch the moment they open the website.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-left text-[12px] text-[color:var(--text-muted)]">
                    <th className="py-2 pr-3">Broadcast</th><th className="pr-3">Audience</th><th className="pr-3">Status</th><th className="pr-3">Window</th><th className="pr-3 text-right">Reached</th><th className="pr-3 text-right">Banner closed</th><th className="pr-3 text-right">Read</th><th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((b) => (
                    <tr key={b.id} className="border-b border-[color:var(--border)] align-top" data-testid="broadcast-row">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-start gap-2">
                          {b.imageUrl ? <img src={getImageUrl(b.imageUrl)} alt="" className="size-9 rounded-[6px] object-cover" /> : <span className="flex size-9 items-center justify-center rounded-[6px] bg-[color:var(--surface-secondary)]"><Radio className="size-4 text-[color:var(--text-muted)]" /></span>}
                          <div className="min-w-0">
                            <div className="font-bold">{b.title}</div>
                            <div className="flex flex-wrap items-center gap-1 text-[12px] text-[color:var(--text-muted)]">
                              <Badge tone="accent">{lk.label('CampaignType', b.type)}</Badge>
                              {b.showAsBanner ? <Badge tone="info">Banner + bell</Badge> : <Badge tone="neutral">Bell only</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="pr-3">{b.audienceType === 'All' ? 'All customers' : <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{fmtNum(b.userIds?.length)} selected</span>}</td>
                      <td className="pr-3"><Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge></td>
                      <td className="whitespace-nowrap pr-3 text-[12px] text-[color:var(--text-muted)]">
                        {b.status === 'Scheduled' ? `Starts ${fmtDate(b.activeFrom)}` : b.publishedAt ? fmtDate(b.publishedAt) : '—'}
                        {b.activeUntil && <div>until {fmtDate(b.activeUntil)}</div>}
                        {b.endedAt && <div>ended {fmtDate(b.endedAt)}</div>}
                      </td>
                      <td className="pr-3 text-right tabular-nums">{fmtNum(b.recipients)}</td>
                      <td className="pr-3 text-right tabular-nums">{b.showAsBanner ? fmtNum(b.bannerSeen) : '—'}</td>
                      <td className="pr-3 text-right tabular-nums">{fmtNum(b.read)}</td>
                      <td className="whitespace-nowrap text-right">
                        {(b.status === 'Draft' || b.status === 'Scheduled') && <Button size="sm" variant="tertiary" onClick={() => edit(b)}><Pencil className="size-3.5" />Edit</Button>}
                        {(b.status === 'Draft' || b.status === 'Scheduled') && (
                          <Button size="sm" variant="tertiary" loading={busy === `p${b.id}`} onClick={() => act(`p${b.id}`, () => api.post(`/admin/marketing/broadcasts/${b.id}/publish`), `Publish “${b.title}” now?`)}><Send className="size-3.5" />Publish</Button>
                        )}
                        {b.status === 'Published' && (
                          <Button size="sm" variant="tertiary" loading={busy === `e${b.id}`} onClick={() => act(`e${b.id}`, () => api.post(`/admin/marketing/broadcasts/${b.id}/end`), 'End this broadcast now? Customers who haven’t seen the banner won’t get it; it stays in their notification list until read.')}><StopCircle className="size-3.5" />End</Button>
                        )}
                        <Button size="sm" variant="tertiary" loading={busy === `d${b.id}`} onClick={() => act(`d${b.id}`, () => api.delete(`/admin/marketing/broadcasts/${b.id}`), 'Delete this broadcast? It disappears from every customer’s notifications.')}><Trash2 className="size-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && <Pagination page={page} pages={data.totalPages} total={data.total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="broadcasts" />}
        </div>
      </Card>
      {composer && <Composer initial={composer} onClose={() => setComposer(null)} onSaved={load} />}
    </div>
  );
}
