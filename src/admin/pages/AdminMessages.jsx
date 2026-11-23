import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, Phone, Trash2, Send, ShieldAlert, Eye, Inbox, Clock, CheckCircle2, RefreshCw, Reply } from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, SearchInput, Toolbar, EmptyState, Skeleton,
  Pagination, DialogPanel, Field,
} from '@/admin/ui';

const errMsg = (err, fallback) => err?.response?.data?.error?.message || fallback;
const STATUS_LABEL = { New: 'New', InProgress: 'In progress', Resolved: 'Resolved', Spam: 'Spam' };
const STATUS_TONE = { New: 'info', InProgress: 'warning', Resolved: 'success', Spam: 'danger' };
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const first = (name) => (name || '').trim().split(/\s+/)[0] || 'there';

function MessageDialog({ msg: initial, statuses, onClose, onChanged, onDeleted }) {
  const [msg, setMsg] = useState(initial);
  const [subject, setSubject] = useState(initial.defaultReplySubject || `Re: ${initial.subject}`);
  const [reply, setReply] = useState('');
  const [markResolved, setMarkResolved] = useState(true);
  const [busy, setBusy] = useState(null);
  const [loadingThread, setLoadingThread] = useState(true);

  // The list row has no reply history — load the full message (with every reply sent) when the dialog opens.
  useEffect(() => {
    let live = true;
    api.get(`/admin/contact-messages/${initial.id}`)
      .then((res) => { if (live) setMsg(res.data.data); })
      .catch((err) => toast.error(errMsg(err, 'Could not load the reply history')))
      .finally(() => { if (live) setLoadingThread(false); });
    return () => { live = false; };
  }, [initial.id]);

  const update = (m) => { setMsg(m); onChanged(m); };

  const setStatus = async (status) => {
    setBusy(status);
    try {
      const res = await api.patch(`/admin/contact-messages/${msg.id}/status`, { status });
      update(res.data.data);
      toast.success(res.data.message || `Marked ${STATUS_LABEL[status]}`);
    } catch (err) { toast.error(errMsg(err, 'Failed to update status')); } finally { setBusy(null); }
  };

  const sendReply = async () => {
    if (!subject.trim()) { toast.error('Enter an email subject'); return; }
    if (reply.trim().length < 2) { toast.error('Write your reply first'); return; }
    setBusy('reply');
    try {
      const res = await api.post(`/admin/contact-messages/${msg.id}/reply`, { subject: subject.trim(), message: reply.trim(), markResolved });
      update(res.data.data);
      setReply('');
      setSubject(res.data.data.defaultReplySubject || subject);
      toast.success(res.data.message || `Reply emailed to ${msg.email}`);
    } catch (err) { toast.error(errMsg(err, 'Failed to send reply'), { duration: 7000 }); } finally { setBusy(null); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete message ${msg.ticketId || ''} from ${msg.name}? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      await api.delete(`/admin/contact-messages/${msg.id}`);
      toast.success('Message deleted');
      onDeleted(msg.id);
    } catch (err) { toast.error(errMsg(err, 'Failed to delete')); setBusy(null); }
  };

  const replies = msg.replies || [];

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={<span className="flex items-center gap-2"><Mail className="size-4" /> {msg.ticketId || 'Contact message'} <Badge tone={STATUS_TONE[msg.status]}>{STATUS_LABEL[msg.status] || msg.status}</Badge></span>}
        onClose={onClose}
        width="max-w-3xl"
        footer={(
          <>
            <Button variant="danger" size="sm" onClick={remove} loading={busy === 'delete'} className="mr-auto"><Trash2 className="size-3.5" />Delete</Button>
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" onClick={sendReply} loading={busy === 'reply'}><Send className="size-3.5" />Send email</Button>
          </>
        )}
      >
        <div className="space-y-5 text-[13px]">
          {/* ── Who wrote in and why ── */}
          <section className="rounded-[8px] border border-[color:var(--border)]">
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 border-b border-[color:var(--border)] p-3 sm:grid-cols-2">
              <Info label="From"><span className="font-bold">{msg.name}</span></Info>
              <Info label="Received">{fmt(msg.createdAt)}</Info>
              <Info label="Email"><a href={`mailto:${msg.email}`} className="inline-flex items-center gap-1 text-[color:var(--primary)] hover:underline"><Mail className="size-3.5" />{msg.email}</a></Info>
              <Info label="Phone">{msg.phone ? <a href={`tel:${msg.phone}`} className="inline-flex items-center gap-1 text-[color:var(--primary)] hover:underline"><Phone className="size-3.5" />{msg.phone}</a> : '—'}</Info>
              <Info label="Subject" className="sm:col-span-2"><span className="font-bold">{msg.subject}</span></Info>
            </div>
            <div className="whitespace-pre-wrap p-3 leading-relaxed">{msg.message}</div>
          </section>

          {/* ── Status ── */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] font-bold text-[color:var(--text-secondary)]">Status</span>
            {statuses.map((s) => (
              <Button key={s} size="sm" variant={msg.status === s ? 'primary' : 'secondary'} loading={busy === s} disabled={msg.status === s} onClick={() => setStatus(s)}>
                {s === 'Spam' && <ShieldAlert className="size-3.5" />}{STATUS_LABEL[s] || s}
              </Button>
            ))}
          </div>

          {/* ── Replies already sent ── */}
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">
              <Reply className="size-3.5" /> Replies sent {replies.length > 0 && `(${replies.length})`}
            </div>
            {loadingThread ? <Skeleton className="block h-14 w-full" />
              : replies.length === 0 ? <p className="text-[12px] text-[color:var(--text-muted)]">No reply sent yet.</p>
              : (
                <div className="space-y-2">
                  {replies.map((r, i) => (
                    <div key={r.id || `legacy-${i}`} className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--success-bg)] p-3">
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
                        <span className="font-bold text-[color:var(--text-primary)]">{r.subject}</span>
                        <span className="text-[color:var(--text-muted)]">{fmt(r.sentAt)}{r.sentBy ? ` · ${r.sentBy}` : ''}</span>
                      </div>
                      <div className="mb-1 text-[11px] text-[color:var(--text-muted)]">To {r.toEmail}</div>
                      <div className="whitespace-pre-wrap leading-relaxed">{r.body}</div>
                    </div>
                  ))}
                </div>
              )}
          </section>

          {/* ── Compose ── */}
          <section className="space-y-3 rounded-[8px] border border-[color:var(--border)] p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">
              <Send className="size-3.5" /> {replies.length ? 'Send another reply' : 'Reply by email'}
            </div>
            <Field label="To">
              <input className="input-field w-full bg-[color:var(--surface-secondary)]" value={`${msg.name} <${msg.email}>`} readOnly />
            </Field>
            <Field label="Subject" required>
              <input className="input-field w-full" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Message" required hint={`The email starts with "Hi ${first(msg.name)}," and ends with "Warm regards, Team <store name>" — their original message is quoted below your reply.`}>
              <textarea className="input-field w-full" rows={7} maxLength={5000} value={reply} onChange={(e) => setReply(e.target.value)}
                placeholder="Thank you for getting in touch. …" />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={markResolved} onChange={(e) => setMarkResolved(e.target.checked)} />
                Mark as resolved after sending
              </label>
              <span className="text-[11px] text-[color:var(--text-muted)]">{reply.length}/5000</span>
            </div>
          </section>
        </div>
      </DialogPanel>
    </AdminModal>
  );
}

function Info({ label, className, children }) {
  return (
    <div className={className}>
      <div className="text-[11px] text-[color:var(--text-muted)]">{label}</div>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export default function AdminMessages() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, counts: {}, statuses: ['New', 'InProgress', 'Resolved', 'Spam'] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await api.get('/admin/contact-messages', { params: { status, search: q || undefined, page, limit: pageSize } });
      if (id === reqId.current) setData(res.data.data);
    } catch (err) {
      if (id === reqId.current) toast.error(errMsg(err, 'Failed to load messages'));
    } finally { if (id === reqId.current) setLoading(false); }
  }, [status, q, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);
  const changeStatus = (s) => { setStatus(s); setPage(1); };
  const changePageSize = (n) => { setPageSize(n); setPage(1); };

  const counts = data.counts || {};
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const statuses = data.statuses || [];

  const onChanged = () => { load(); };
  const onDeleted = () => { setSelected(null); load(); };

  const quickStatus = async (m, s) => {
    try {
      await api.patch(`/admin/contact-messages/${m.id}/status`, { status: s });
      toast.success(`Marked ${STATUS_LABEL[s]}`);
      load();
    } catch (err) { toast.error(errMsg(err, 'Failed to update status')); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contact Messages"
        description="Messages from the website Contact Us form — see who wrote in and why, and reply by email right here."
        actions={<Button variant="secondary" onClick={load} loading={loading}><RefreshCw className="size-4" />Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="All messages" value={totalAll} icon={Inbox} loading={loading && !data.items.length} />
        <Stat label="New" value={counts.New ?? 0} icon={Mail} tone="info" loading={loading && !data.items.length} />
        <Stat label="In progress" value={counts.InProgress ?? 0} icon={Clock} tone="warning" loading={loading && !data.items.length} />
        <Stat label="Resolved" value={counts.Resolved ?? 0} icon={CheckCircle2} tone="success" loading={loading && !data.items.length} />
      </div>

      <Card bodyClassName="p-3">
        <Tabs
          className="mb-3"
          value={status}
          onChange={changeStatus}
          items={[{ value: 'all', label: 'All', count: totalAll }, ...statuses.map((s) => ({ value: s, label: STATUS_LABEL[s] || s, count: counts[s] ?? 0 }))]}
        />
        <Toolbar className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, ticket, subject or message…" />
        </Toolbar>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr><th>Received</th><th>Ticket</th><th>From</th><th>Subject</th><th>Message</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {loading && !data.items.length && [1, 2, 3].map((i) => (
                <tr key={i}>{[1, 2, 3, 4, 5, 6, 7].map((j) => <td key={j}><Skeleton className="block h-4 w-full" /></td>)}</tr>
              ))}
              {data.items.map((m) => (
                <tr key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                  <td className="whitespace-nowrap">{fmt(m.createdAt)}</td>
                  <td className="whitespace-nowrap font-mono text-[12px]">{m.ticketId}</td>
                  <td><div className="font-bold">{m.name}</div><div className="text-[12px] text-[color:var(--text-muted)]">{m.email}</div></td>
                  <td>{m.subject}</td>
                  <td className="max-w-[320px]"><div className="truncate">{m.message}</div>{m.adminReply && <div className="text-[11px] text-[color:var(--success)]">Replied {fmt(m.repliedAt)}</div>}</td>
                  <td><Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status] || m.status}</Badge></td>
                  <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <IconButton label="Open" tone="primary" onClick={() => setSelected(m)}><Eye className="size-3.5" /></IconButton>
                    <IconButton label="Reply" tone="primary" onClick={() => setSelected(m)}><Reply className="size-3.5" /></IconButton>
                    {m.status !== 'Resolved' && <IconButton label="Mark resolved" tone="primary" onClick={() => quickStatus(m, 'Resolved')}><CheckCircle2 className="size-3.5" /></IconButton>}
                    {m.status !== 'Spam' && <IconButton label="Mark spam" tone="danger" onClick={() => quickStatus(m, 'Spam')}><ShieldAlert className="size-3.5" /></IconButton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !data.items.length && (
          <EmptyState icon={Inbox} title={q || status !== 'all' ? 'No messages match' : 'No messages yet'}>
            {q || status !== 'all' ? 'Try a different filter or search.' : 'Messages sent from the website Contact Us page will appear here.'}
          </EmptyState>
        )}
        <Pagination page={page} pages={Math.max(1, data.totalPages || 1)} total={data.total || 0} pageSize={pageSize} setPage={setPage} setPageSize={changePageSize} noun="messages" />
      </Card>

      {selected && (
        <MessageDialog key={selected.id} msg={selected} statuses={statuses} onClose={() => setSelected(null)} onChanged={onChanged} onDeleted={onDeleted} />
      )}
    </div>
  );
}
