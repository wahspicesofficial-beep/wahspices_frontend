import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Megaphone, Plus, Mail, MessageCircle, Send, CalendarClock, Pause, Play, XCircle, RotateCcw, Copy, Trash2, Pencil,
  Gauge, AlertTriangle, RefreshCw, FlaskConical, Eye,
} from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Badge, Button, Tabs, SearchInput, Toolbar, EmptyState, Skeleton, Pagination, DialogPanel, Field, statusTone,
} from '@/admin/ui';
import { useLookups } from '@/admin/lookups';
import { TypeSelect, ImageUpload, ProductPicker, AudiencePicker, Progress, FieldGroup } from '@/admin/components/marketing/MarketingFields';
import { errMsg, fmtDate, fmtNum, toLocalInput, fromLocalInput, useDebounced, linkError } from '@/admin/components/marketing/marketingUtils';

const STATUS_TABS = ['all', 'Draft', 'Scheduled', 'Sending', 'Paused', 'Completed', 'Cancelled'];
const STATUS_TONE = { Draft: 'neutral', Scheduled: 'info', Sending: 'primary', Paused: 'warning', Completed: 'success', Cancelled: 'danger' };
const RECIPIENT_STATUSES = ['all', 'Pending', 'Sending', 'Sent', 'Failed', 'Skipped', 'Cancelled'];

const EMPTY = {
  type: 'Offer', title: '', body: '', imageUrl: '', buttonLabel: '', buttonUrl: '', productIds: [], couponCode: '',
  sendEmail: true, sendWhatsApp: false, audienceType: 'All', userIds: [],
};

const toRequest = (f) => ({
  type: f.type, title: f.title, body: f.body, imageUrl: f.imageUrl || null, buttonLabel: f.buttonLabel || null,
  buttonUrl: f.buttonUrl || null, productIds: f.productIds, couponCode: f.couponCode || null,
  sendEmail: f.sendEmail, sendWhatsApp: f.sendWhatsApp, audienceType: f.audienceType, userIds: f.audienceType === 'Selected' ? f.userIds : [],
});

const etaText = (eta) => {
  if (!eta) return '';
  const ms = new Date(eta) - Date.now();
  if (ms < 60_000) return 'finishing now';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `≈ ${min} min left`;
  const h = Math.round(min / 60);
  if (h < 48) return `≈ ${h} h left`;
  return `≈ ${Math.round(h / 24)} days left (${fmtDate(eta)})`;
};

/* ─────────────────────────────── Channel limits ─────────────────────────────── */

function UsageBar({ label, used, cap }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[11px] text-[color:var(--text-muted)]"><span>{label}</span><span className="tabular-nums">{fmtNum(used)} / {fmtNum(cap)}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-[color:var(--warning)]' : 'bg-[color:var(--primary)]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LimitsDialog({ ch, onClose, onSaved }) {
  const u = ch.usage;
  const [f, setF] = useState({ perMinute: u.perMinute, perHour: u.perHour, perDay: u.perDay, providerDailyLimit: u.providerDailyLimit, transactionalReserve: u.transactionalReserve });
  const [busy, setBusy] = useState(false);
  const num = (k) => (e) => setF((x) => ({ ...x, [k]: Number(e.target.value) }));
  const save = async () => {
    setBusy(true);
    try { const r = await api.put(`/admin/marketing/channels/${ch.channel}`, f); toast.success(r.data.message); onSaved(); onClose(); }
    catch (err) { toast.error(errMsg(err, 'Could not save limits')); }
    finally { setBusy(false); }
  };
  const d = ch.defaults;
  const effective = Math.max(0, Math.min(f.perDay, f.providerDailyLimit > 0 ? f.providerDailyLimit - f.transactionalReserve : f.perDay));
  return (
    <AdminModal onClose={onClose}>
      <DialogPanel title={`${ch.channel} sending limits`} onClose={onClose} width="max-w-lg"
        footer={<><Button variant="secondary" size="sm" onClick={() => setF({ perMinute: d.perMinute, perHour: d.perHour, perDay: d.perDay, providerDailyLimit: d.providerDailyLimit, transactionalReserve: d.transactionalReserve })}>Reset to defaults</Button><Button size="sm" loading={busy} onClick={save}>Save limits</Button></>}>
        <div className="space-y-3 text-[13px]">
          <p className="text-[color:var(--text-muted)]">
            Campaign messages are sent one by one and never faster than these limits (rolling windows). When a limit is reached, sending
            waits and continues automatically — a large “send to everyone” simply takes several days instead of getting the account blocked.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Per minute"><input type="number" min={1} className="input-field w-full" value={f.perMinute} onChange={num('perMinute')} /></Field>
            <Field label="Per hour"><input type="number" min={1} className="input-field w-full" value={f.perHour} onChange={num('perHour')} /></Field>
            <Field label="Per day (24 h)"><input type="number" min={1} className="input-field w-full" value={f.perDay} onChange={num('perDay')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Provider daily limit" hint={ch.channel === 'Email' ? 'Gmail ≈ 500 / 24 h (Workspace ≈ 2,000). 0 = not used.' : 'Your WhatsApp messaging tier (250 / 1K / 10K …).'}>
              <input type="number" min={0} className="input-field w-full" value={f.providerDailyLimit} onChange={num('providerDailyLimit')} />
            </Field>
            <Field label="Keep free for order / OTP mail" hint="Campaigns never use these sends.">
              <input type="number" min={0} className="input-field w-full" value={f.transactionalReserve} onChange={num('transactionalReserve')} />
            </Field>
          </div>
          <div className="rounded-[6px] bg-[color:var(--surface-secondary)] px-3 py-2">
            Campaigns may send at most <b>{fmtNum(effective)}</b> per 24 h on this channel{f.providerDailyLimit > 0 ? ` (min of per-day ${fmtNum(f.perDay)} and ${fmtNum(f.providerDailyLimit)} − ${fmtNum(f.transactionalReserve)} reserved)` : ''}.
          </div>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

function ChannelCards({ channels, reload }) {
  const [editing, setEditing] = useState(null);
  const resume = async (ch) => {
    try { const r = await api.post(`/admin/marketing/channels/${ch}/resume`); toast.success(r.data.message); reload(); }
    catch (err) { toast.error(errMsg(err, 'Could not resume')); }
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {channels.map((ch) => {
        const u = ch.usage;
        const Icon = ch.channel === 'Email' ? Mail : MessageCircle;
        return (
          <Card key={ch.channel} title={<span className="flex items-center gap-1.5"><Icon className="size-3.5" />{ch.channel}</span>}
            actions={<>
              {ch.configured ? <Badge tone="success">Ready</Badge> : <Badge tone="warning">Not configured</Badge>}
              <Button size="sm" variant="tertiary" onClick={() => setEditing(ch)}><Gauge className="size-3.5" />Limits</Button>
            </>}>
            <div className="space-y-2.5 p-3">
              {!ch.configured && (
                <div className="flex gap-2 rounded-[6px] bg-[color:var(--warning-bg)] px-3 py-2 text-[12px] text-[color:var(--warning)]">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{ch.notConfiguredReason}{ch.channel === 'WhatsApp' && ' Set WhatsApp:Enabled, AccessToken, PhoneNumberId and TemplateName in user-secrets / environment variables (see SECURITY.md).'}</span>
                </div>
              )}
              {u.pausedUntil && (
                <div className="flex flex-wrap items-center gap-2 rounded-[6px] bg-[color:var(--danger-bg)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">Paused until {fmtDate(u.pausedUntil)} — {u.pauseReason}</span>
                  <Button size="sm" variant="secondary" onClick={() => resume(ch.channel)}>Resume now</Button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <UsageBar label="Last minute" used={u.usedLastMinute} cap={u.perMinute} />
                <UsageBar label="Last hour" used={u.usedLastHour} cap={u.perHour} />
                <UsageBar label="Last 24 h" used={u.usedLast24h} cap={u.effectiveDailyCap} />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-[12px] text-[color:var(--text-muted)]">
                <span>
                  Limits {u.perMinute}/min · {fmtNum(u.perHour)}/h · {fmtNum(u.effectiveDailyCap)}/24 h
                  {ch.channel === 'Email' && u.providerDailyLimit > 0 && ` · ${fmtNum(u.transactionalReserve)} kept for order/OTP mail (${fmtNum(u.transactionalLast24h)} sent today)`}
                </span>
                <span>
                  {ch.pending > 0 ? <><b className="text-[color:var(--text-primary)]">{fmtNum(ch.pending)}</b> queued{u.waitingFor ? ` · waiting: ${u.waitingFor}` : ''}{ch.eta ? ` · ${etaText(ch.eta)}` : ''}</> : 'Nothing queued'}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
      {editing && <LimitsDialog ch={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

/* ─────────────────────────────── Composer ─────────────────────────────── */

function Composer({ initial, channels, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...EMPTY, ...initial }));
  const [preview, setPreview] = useState({ html: '', subject: '', error: '' });
  const [busy, setBusy] = useState(null);
  const [scheduleAt, setScheduleAt] = useState(initial?.scheduledAt ? toLocalInput(initial.scheduledAt) : '');
  const [testTo, setTestTo] = useState('');
  const debounced = useDebounced(f, 600);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const id = initial?.id;
  const waReady = channels.find((c) => c.channel === 'WhatsApp')?.configured;
  const emailReady = channels.find((c) => c.channel === 'Email')?.configured;
  const linkErr = linkError(f.buttonUrl);

  useEffect(() => {
    if (!debounced.title.trim()) { setPreview({ html: '', subject: '', error: '' }); return; }
    let alive = true;
    api.post('/admin/marketing/campaigns/preview', toRequest(debounced))
      .then((r) => alive && setPreview({ html: r.data.data.html, subject: r.data.data.subject, error: '' }))
      .catch((err) => alive && setPreview((p) => ({ ...p, error: errMsg(err, 'Preview failed') })));
    return () => { alive = false; };
  }, [debounced]);

  const save = async () => {
    const res = id ? await api.put(`/admin/marketing/campaigns/${id}`, toRequest(f)) : await api.post('/admin/marketing/campaigns', toRequest(f));
    return res.data.data;
  };

  const run = async (tag, fn) => {
    setBusy(tag);
    try { await fn(); } catch (err) { toast.error(errMsg(err, 'Something went wrong')); } finally { setBusy(null); }
  };

  const saveDraft = () => run('draft', async () => { await save(); toast.success('Saved as draft'); onSaved(); onClose(); });
  const sendNow = () => run('send', async () => {
    const c = await save();
    const r = await api.post(`/admin/marketing/campaigns/${c.id}/send`);
    toast.success(r.data.message, { duration: 5000 });
    onSaved(); onClose();
  });
  const schedule = () => run('schedule', async () => {
    if (!scheduleAt) { toast.error('Pick a date and time first'); return; }
    const c = await save();
    await api.post(`/admin/marketing/campaigns/${c.id}/schedule`, { scheduledAt: fromLocalInput(scheduleAt) });
    toast.success(`Scheduled for ${fmtDate(fromLocalInput(scheduleAt))}`);
    onSaved(); onClose();
  });
  const sendTest = () => run('test', async () => {
    const emails = testTo.split(/[,\s]+/).filter(Boolean);
    const r = await api.post('/admin/marketing/campaigns/test-send', { campaign: toRequest(f), emails });
    toast.success(r.data.message);
  });

  const confirmSend = () => {
    const who = f.audienceType === 'All' ? 'ALL eligible customers' : `${fmtNum(f.userIds.length)} selected customer(s)`;
    if (window.confirm(`Send “${f.title}” to ${who} now?\n\nMessages go out gradually within the channel limits.`)) sendNow();
  };

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={id ? 'Edit campaign' : 'New campaign'}
        onClose={onClose}
        width="max-w-6xl"
        footer={(
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="mr-auto flex flex-wrap items-center gap-1.5">
              <input type="email" className="input-field h-8 w-56" placeholder="Test email(s)" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Send test to" />
              <Button size="sm" variant="secondary" onClick={sendTest} loading={busy === 'test'} disabled={!testTo.trim() || !f.title.trim() || !emailReady}><FlaskConical className="size-3.5" />Send test</Button>
            </div>
            <Button size="sm" variant="secondary" onClick={saveDraft} loading={busy === 'draft'}>Save draft</Button>
            <input type="datetime-local" className="input-field h-8 w-48" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} aria-label="Schedule for" />
            <Button size="sm" variant="secondary" onClick={schedule} loading={busy === 'schedule'} disabled={!scheduleAt}><CalendarClock className="size-3.5" />Schedule</Button>
            <Button size="sm" onClick={confirmSend} loading={busy === 'send'}><Send className="size-3.5" />Send now</Button>
          </div>
        )}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <TypeSelect value={f.type} onChange={(type) => set({ type })} />
              <Field label="Title / email subject" required hint={`${f.title.length}/150`}>
                <input type="text" className="input-field w-full" maxLength={150} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Diwali special: 20% off every masala" />
              </Field>
            </div>
            <Field label="Message" required hint={`Plain text — blank line starts a new paragraph. ${f.body.length}/4000`}>
              <textarea className="input-field w-full" rows={6} maxLength={4000} value={f.body} onChange={(e) => set({ body: e.target.value })} placeholder={'Celebrate with fresh, small-batch masalas…\n\nUse the code below at checkout.'} />
            </Field>
            <ImageUpload value={f.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <Field label="Button text"><input type="text" className="input-field w-full" maxLength={40} value={f.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} placeholder="Shop now" /></Field>
              <Field label="Button link" error={linkErr} hint="Site path like /products?category=blended-masala or https:// link">
                <input type="text" className="input-field w-full" value={f.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} placeholder="/products" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <Field label="Coupon code" hint="Optional; must exist and be active">
                <input type="text" className="input-field w-full uppercase" maxLength={50} value={f.couponCode} onChange={(e) => set({ couponCode: e.target.value.toUpperCase() })} placeholder="DIWALI20" />
              </Field>
              <ProductPicker value={f.productIds} onChange={(productIds) => set({ productIds })} />
            </div>

            <FieldGroup label="Channels" required>
              <div className="flex flex-wrap gap-4 text-[13px]">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.sendEmail} onChange={(e) => set({ sendEmail: e.target.checked })} /><Mail className="size-3.5" />Email</label>
                <label className={`flex items-center gap-1.5 ${waReady ? '' : 'opacity-60'}`} title={waReady ? '' : 'WhatsApp is not configured yet'}>
                  <input type="checkbox" disabled={!waReady} checked={f.sendWhatsApp} onChange={(e) => set({ sendWhatsApp: e.target.checked })} /><MessageCircle className="size-3.5" />WhatsApp {!waReady && <Badge tone="warning">not configured</Badge>}
                </label>
              </div>
            </FieldGroup>

            <FieldGroup label="Audience" required>
              <AudiencePicker
                value={{ audienceType: f.audienceType, userIds: f.userIds }}
                onChange={(v) => set(v)}
                channels={['email', ...(waReady ? ['whatsApp'] : [])]}
                initialUsers={initial?.selectedUsers || []}
              />
            </FieldGroup>
            <p className="text-[12px] text-[color:var(--text-muted)]">
              Customers who unsubscribed, are disabled, unverified or only have a phone-signup placeholder email are skipped automatically.
              Every email carries an unsubscribe link.
            </p>
          </div>

          <div className="min-w-0">
            <div className="sticky top-0">
              <div className="mb-1.5 flex items-center justify-between text-[12px] text-[color:var(--text-muted)]">
                <span className="flex items-center gap-1"><Eye className="size-3.5" />Live email preview</span>
                {preview.subject && <span className="truncate pl-2">Subject: <b className="text-[color:var(--text-primary)]">{preview.subject}</b></span>}
              </div>
              {preview.error && <div className="mb-1.5 rounded-[6px] bg-[color:var(--danger-bg)] px-3 py-1.5 text-[12px] text-[color:var(--danger)]">{preview.error}</div>}
              {preview.html ? (
                <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[68vh] w-full rounded-[8px] border border-[color:var(--border)] bg-white" />
              ) : (
                <div className="flex h-[40vh] items-center justify-center rounded-[8px] border border-dashed border-[color:var(--border)] text-[13px] text-[color:var(--text-muted)]">Type a title to see the email</div>
              )}
            </div>
          </div>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

/* ─────────────────────────────── Detail ─────────────────────────────── */

function Detail({ id, onClose, onChanged, onEdit }) {
  const [data, setData] = useState(null);
  const [rec, setRec] = useState({ items: [], total: 0, totalPages: 1 });
  const [status, setStatus] = useState('all');
  const [channel, setChannel] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        api.get(`/admin/marketing/campaigns/${id}`),
        api.get(`/admin/marketing/campaigns/${id}/recipients`, { params: { status, channel, page, limit: pageSize } }),
      ]);
      setData(d.data.data); setRec(r.data.data);
    } catch (err) { toast.error(errMsg(err, 'Could not load campaign')); }
  }, [id, status, channel, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, channel]);
  const live = data?.summary?.status === 'Sending' || data?.summary?.status === 'Scheduled';
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [live, load]);

  const act = async (tag, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return false;
    setBusy(tag);
    try { const r = await fn(); toast.success(r.data.message || 'Done'); if (tag !== 'delete') await load(); onChanged(); return true; }
    catch (err) { toast.error(errMsg(err, 'Action failed')); return false; }
    finally { setBusy(null); }
  };

  if (!data) return <AdminModal onClose={onClose}><DialogPanel title="Campaign" onClose={onClose} width="max-w-4xl"><Skeleton className="h-40 w-full" /></DialogPanel></AdminModal>;
  const c = data.campaign;
  const s = data.summary;
  const n = s.counts || {};
  const editable = c.status === 'Draft' || c.status === 'Scheduled' || (c.status === 'Paused' && !c.startedAt);
  const base = `/admin/marketing/campaigns/${id}`;

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={<span className="flex items-center gap-2">{c.title} <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></span>}
        onClose={onClose}
        width="max-w-5xl"
        footer={(
          <div className="flex w-full flex-wrap items-center gap-1.5">
            {['Draft', 'Completed', 'Cancelled', 'Scheduled'].includes(c.status) && (
              <Button size="sm" variant="danger" className="mr-auto" loading={busy === 'delete'}
                onClick={() => act('delete', () => api.delete(base), 'Delete this campaign? Its history is removed from the list.').then((ok) => ok && onClose())}><Trash2 className="size-3.5" />Delete</Button>
            )}
            <Button size="sm" variant="secondary" loading={busy === 'dup'} onClick={() => act('dup', () => api.post(`${base}/duplicate`))}><Copy className="size-3.5" />Duplicate</Button>
            {editable && <Button size="sm" variant="secondary" onClick={() => onEdit({ ...c, selectedUsers: data.selectedUsers })}><Pencil className="size-3.5" />Edit</Button>}
            {(c.status === 'Sending' || c.status === 'Scheduled') && <Button size="sm" variant="secondary" loading={busy === 'pause'} onClick={() => act('pause', () => api.post(`${base}/pause`))}><Pause className="size-3.5" />Pause</Button>}
            {c.status === 'Paused' && <Button size="sm" loading={busy === 'resume'} onClick={() => act('resume', () => api.post(`${base}/resume`))}><Play className="size-3.5" />Resume</Button>}
            {n.failed > 0 && c.status !== 'Cancelled' && <Button size="sm" variant="secondary" loading={busy === 'retry'} onClick={() => act('retry', () => api.post(`${base}/retry-failed`, {}))}><RotateCcw className="size-3.5" />Retry {fmtNum(n.failed)} failed</Button>}
            {!['Completed', 'Cancelled'].includes(c.status) && (
              <Button size="sm" variant="danger" loading={busy === 'cancel'} onClick={() => act('cancel', () => api.post(`${base}/cancel`), 'Cancel this campaign? Messages not sent yet are dropped.')}><XCircle className="size-3.5" />Cancel</Button>
            )}
          </div>
        )}
      >
        <div className="space-y-4 text-[13px]">
          <div className="grid gap-2 sm:grid-cols-5">
            {[['Recipients', n.total], ['Sent', n.sent], ['Pending', (n.pending || 0) + (n.sending || 0)], ['Failed', n.failed], ['Skipped', n.skipped]].map(([k, v]) => (
              <div key={k} className="rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                <div className="text-[12px] text-[color:var(--text-muted)]">{k}</div>
                <div className="text-[18px] font-bold tabular-nums">{fmtNum(v)}</div>
              </div>
            ))}
          </div>
          {n.total > 0 && (
            <div>
              <Progress value={n.sent} total={Math.max(1, n.total - n.skipped - n.cancelled)} />
              <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">
                {s.status === 'Sending' ? (s.eta ? `Sending within the channel limits — ${etaText(s.eta)}` : 'Sending…') : s.status === 'Paused' ? 'Paused' : ''}
              </div>
            </div>
          )}
          <div className="grid gap-2 text-[12px] sm:grid-cols-3">
            <div><span className="text-[color:var(--text-muted)]">Channels:</span> {[c.sendEmail && 'Email', c.sendWhatsApp && 'WhatsApp'].filter(Boolean).join(' + ')}</div>
            <div><span className="text-[color:var(--text-muted)]">Audience:</span> {c.audienceType === 'All' ? 'All customers' : `${fmtNum(data.selectedCount)} selected`}</div>
            <div><span className="text-[color:var(--text-muted)]">{c.status === 'Scheduled' ? 'Scheduled for' : 'Started'}:</span> {fmtDate(c.status === 'Scheduled' ? c.scheduledAt : c.startedAt)}</div>
          </div>

          <Card title="Recipients" actions={<Button size="sm" variant="tertiary" onClick={load}><RefreshCw className="size-3.5" /></Button>}>
            <div className="space-y-2 p-2.5">
              <Toolbar>
                <select className="input-field h-8" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                  {RECIPIENT_STATUSES.map((x) => <option key={x} value={x}>{x === 'all' ? 'All statuses' : x}</option>)}
                </select>
                <select className="input-field h-8" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
                  <option value="all">All channels</option><option value="Email">Email</option><option value="WhatsApp">WhatsApp</option>
                </select>
              </Toolbar>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-left text-[color:var(--text-muted)]">
                    <th className="py-1.5 pr-2">Customer</th><th className="pr-2">Channel</th><th className="pr-2">Status</th><th className="pr-2">Attempts</th><th className="pr-2">Sent / next try</th><th className="pr-2">Note</th><th />
                  </tr></thead>
                  <tbody>
                    {rec.items.map((r) => (
                      <tr key={r.id} className="border-t border-[color:var(--border)] align-top">
                        <td className="py-1.5 pr-2"><div className="font-bold">{r.name || '—'}</div><div className="text-[color:var(--text-muted)]">{r.address}</div></td>
                        <td className="pr-2">{r.channel}</td>
                        <td className="pr-2"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                        <td className="pr-2 tabular-nums">{r.attempts}</td>
                        <td className="pr-2">{r.sentAt ? fmtDate(r.sentAt) : r.nextAttemptAt ? `retry ${fmtDate(r.nextAttemptAt)}` : '—'}</td>
                        <td className="max-w-[260px] pr-2 text-[color:var(--text-muted)]">{r.lastError || ''}</td>
                        <td>{r.status === 'Failed' && c.status !== 'Cancelled' && (
                          <Button size="sm" variant="tertiary" onClick={() => act(`r${r.id}`, () => api.post(`${base}/retry-failed`, { ids: [r.id] }))} loading={busy === `r${r.id}`}>Retry</Button>
                        )}</td>
                      </tr>
                    ))}
                    {rec.items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[color:var(--text-muted)]">{c.status === 'Draft' || c.status === 'Scheduled' ? 'Recipients are added when sending starts.' : 'No recipients with this filter.'}</td></tr>}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={rec.totalPages} total={rec.total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="recipients" />
            </div>
          </Card>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function AdminCampaigns() {
  const lk = useLookups();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState(null);
  const [channels, setChannels] = useState([]);
  const [composer, setComposer] = useState(null);   // null | {} | campaign
  const [detailId, setDetailId] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    try {
      const [l, ch] = await Promise.all([
        api.get('/admin/marketing/campaigns', { params: { status: tab, search: q || undefined, page, limit: pageSize } }),
        api.get('/admin/marketing/channels'),
      ]);
      if (my !== reqId.current) return;
      setData(l.data.data); setChannels(ch.data.data);
    } catch (err) { toast.error(errMsg(err, 'Could not load campaigns')); }
  }, [tab, q, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, q]);
  const anyLive = useMemo(() => (data?.items || []).some((c) => c.status === 'Sending') || channels.some((c) => c.pending > 0), [data, channels]);
  useEffect(() => {
    if (!anyLive) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [anyLive, load]);

  const openEdit = async (c) => {
    setDetailId(null);
    try {
      const r = await api.get(`/admin/marketing/campaigns/${c.id}`);
      setComposer({ ...r.data.data.campaign, couponCode: r.data.data.campaign.couponCode || '', buttonLabel: r.data.data.campaign.buttonLabel || '', buttonUrl: r.data.data.campaign.buttonUrl || '', imageUrl: r.data.data.campaign.imageUrl || '', selectedUsers: r.data.data.selectedUsers || [] });
    } catch (err) { toast.error(errMsg(err, 'Could not open campaign')); }
  };

  const counts = data?.statusCounts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campaigns"
        description="Email (and WhatsApp) offers, launches and sales — sent gradually within each channel's limits so the account never gets blocked."
        actions={<Button onClick={() => setComposer({})}><Plus className="size-4" />New campaign</Button>}
      />

      {channels.length > 0 ? <ChannelCards channels={channels} reload={load} /> : <Skeleton className="h-28 w-full" />}

      <Card>
        <Tabs
          className="px-2"
          value={tab}
          onChange={setTab}
          items={STATUS_TABS.map((s) => ({ value: s, label: s === 'all' ? 'All' : s, count: s === 'all' ? total : (counts[s] || 0) }))}
        />
        <div className="space-y-3 p-3">
          <Toolbar><SearchInput value={search} onChange={setSearch} placeholder="Search campaigns…" /></Toolbar>
          {!data ? <Skeleton className="h-40 w-full" /> : data.items.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns yet" action={<Button size="sm" onClick={() => setComposer({})}><Plus className="size-3.5" />Create the first one</Button>}>
              Announce an offer, a sale or a new product by email to all your customers or a hand-picked list.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-left text-[12px] text-[color:var(--text-muted)]">
                    <th className="py-2 pr-3">Campaign</th><th className="pr-3">Audience</th><th className="pr-3">Status</th><th className="min-w-[180px] pr-3">Progress</th><th className="pr-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => {
                    const n = c.counts || {};
                    const deliverable = Math.max(0, n.total - n.skipped - n.cancelled);
                    return (
                      <tr key={c.id} className="cursor-pointer border-b border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]" onClick={() => setDetailId(c.id)} data-testid="campaign-row">
                        <td className="py-2.5 pr-3">
                          <div className="font-bold">{c.title}</div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[color:var(--text-muted)]">
                            <Badge tone="accent">{lk.label('CampaignType', c.type)}</Badge>
                            {c.sendEmail && <Mail className="size-3.5" aria-label="Email" />}{c.sendWhatsApp && <MessageCircle className="size-3.5" aria-label="WhatsApp" />}
                          </div>
                        </td>
                        <td className="pr-3">{c.audienceType === 'All' ? 'All customers' : 'Selected'}</td>
                        <td className="pr-3"><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
                        <td className="pr-3">
                          {n.total > 0 ? (
                            <>
                              <Progress value={n.sent} total={Math.max(1, deliverable)} />
                              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                                {fmtNum(n.sent)}/{fmtNum(deliverable)} sent{n.failed ? ` · ${fmtNum(n.failed)} failed` : ''}{n.pending ? ` · ${fmtNum(n.pending)} pending` : ''}{n.skipped ? ` · ${fmtNum(n.skipped)} skipped` : ''}
                                {c.status === 'Sending' && c.eta ? ` · ${etaText(c.eta)}` : ''}
                              </div>
                            </>
                          ) : <span className="text-[12px] text-[color:var(--text-muted)]">—</span>}
                        </td>
                        <td className="whitespace-nowrap pr-3 text-[12px] text-[color:var(--text-muted)]">
                          {c.status === 'Scheduled' ? `Scheduled ${fmtDate(c.scheduledAt)}` : c.startedAt ? fmtDate(c.startedAt) : `Created ${fmtDate(c.createdAt)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && <Pagination page={page} pages={data.totalPages} total={data.total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="campaigns" />}
        </div>
      </Card>

      {composer && <Composer initial={composer} channels={channels} onClose={() => setComposer(null)} onSaved={load} />}
      {detailId && <Detail id={detailId} onClose={() => setDetailId(null)} onChanged={load} onEdit={(c) => openEdit(c)} />}
    </div>
  );
}
