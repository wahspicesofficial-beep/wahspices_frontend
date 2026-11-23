import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDown, ArrowUp, Edit2, ExternalLink, Eye, EyeOff, Home, Image as ImageIcon, Loader2, Map as MapIcon,
  Plus, Search, Trash2, X,
} from 'lucide-react';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import {
  Badge, Button, Card, DialogPanel, EmptyState, Field, IconButton, PageHeader, Skeleton, Tabs,
} from '@/admin/ui';
import { regionImage, safeColor } from '@/utils/regions';
import { getThumbUrl } from '@/utils/product';

const EMPTY = {
  name: '', slug: '', mapStateId: '', tagline: '', cardText: '', landmark: '', featuredMasala: '',
  accentColor: '#1a5c2e', heroImageUrl: '', heroImageCredit: '', cardImageUrl: '',
  signatureMasalas: [], produces: [], dishes: [], productSlugs: [], autoLinkProducts: true,
  sections: [{ heading: '', body: '', imageUrl: '', imageAlt: '', imageCaption: '', imageCredit: '' }],
  seoTitle: '', seoDescription: '', isPublished: false, showOnHome: true,
};
const errMsg = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;
const toSlug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const move = (arr, i, d) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };

/* ── Image picker: upload (JPG/PNG/WEBP ≤ 8 MB) or a site path / https URL ── */
function ImageField({ label, value, savedValues, onChange, hint, busy, setBusy }) {
  const fileRef = useRef(null);
  const [draft, setDraft] = useState('');
  const isUnsavedUpload = (url) => url && url.startsWith('/uploads/regions/') && !savedValues.has(url);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('The image must be 8 MB or smaller.'); return; }
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    try {
      const res = await api.post('/admin/regions/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (isUnsavedUpload(value)) api.delete('/admin/regions/upload', { params: { url: value } }).catch(() => {});
      onChange(res.data.data.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(errMsg(err, 'Upload failed'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const remove = () => {
    if (isUnsavedUpload(value)) api.delete('/admin/regions/upload', { params: { url: value } }).catch(() => {});
    onChange('');
  };
  const applyUrl = () => {
    const u = draft.trim();
    if (!u) return;
    if (!/^(https:\/\/|\/(images|uploads)\/)/i.test(u)) { toast.error('Use a full https:// image URL or a site path like /images/…'); return; }
    onChange(u); setDraft('');
  };

  return (
    <div>
      <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">{label}</span>
      {value ? (
        <div className="relative overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)]">
          <img src={regionImage(value)} alt="" className="h-36 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-white hover:bg-black/75">Replace</button>
            <button type="button" onClick={remove} aria-label={`Remove ${label}`} className="rounded-full bg-[color:var(--danger)] p-1 text-white hover:brightness-110"><X className="size-3.5" /></button>
          </div>
          <div className="truncate border-t border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--text-muted)]">{value}</div>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="flex w-full flex-col items-center gap-1.5 rounded-[8px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] py-5 text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin text-[color:var(--primary)]" /> : <ImageIcon className="size-5" strokeWidth={1.75} />}
            <span className="text-[12px] font-bold">{busy ? 'Uploading…' : 'Click to upload a photo'}</span>
            <span className="text-[11px]">JPG, PNG, WebP · max 8 MB · landscape works best</span>
          </button>
          <div className="mt-1.5 flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } }}
              placeholder="Or paste https://… or /images/…" className="input-field flex-1 text-[12px]" aria-label={`${label} URL`} />
            <Button size="sm" variant="secondary" onClick={applyUrl} disabled={!draft.trim()}>Use</Button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {hint && <span className="mt-1 block text-[12px] text-[color:var(--text-muted)]">{hint}</span>}
    </div>
  );
}

/* ── Editable list of { name, note, icon? } ── */
function ListEditor({ title, hint, items, onChange, withIcon, namePlaceholder, notePlaceholder }) {
  const set = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <div>
          <div className="text-[13px] font-bold text-[color:var(--text-primary)]">{title}</div>
          {hint && <div className="text-[12px] text-[color:var(--text-muted)]">{hint}</div>}
        </div>
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, withIcon ? { name: '', note: '', icon: '' } : { name: '', note: '' }])} disabled={items.length >= 20}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 && <div className="rounded-[6px] border border-dashed border-[color:var(--border)] px-3 py-3 text-[12px] text-[color:var(--text-muted)]">Nothing yet.</div>}
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {withIcon && <input value={it.icon || ''} onChange={(e) => set(i, 'icon', e.target.value)} maxLength={8} placeholder="🌿" aria-label="Icon (emoji)" className="input-field w-12 text-center" />}
            <input value={it.name || ''} onChange={(e) => set(i, 'name', e.target.value)} maxLength={60} placeholder={namePlaceholder} aria-label="Name" className="input-field w-40 shrink-0 sm:w-48" />
            <input value={it.note || ''} onChange={(e) => set(i, 'note', e.target.value)} maxLength={300} placeholder={notePlaceholder} aria-label="Note" className="input-field min-w-0 flex-1" />
            <IconButton label="Move up" onClick={() => onChange(move(items, i, -1))} disabled={i === 0}><ArrowUp className="size-3.5" /></IconButton>
            <IconButton label="Move down" onClick={() => onChange(move(items, i, 1))} disabled={i === items.length - 1}><ArrowDown className="size-3.5" /></IconButton>
            <IconButton label="Remove" tone="danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></IconButton>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Linked products: explicit picks (ordered) ── */
function ProductPicker({ options, value, onChange }) {
  const [q, setQ] = useState('');
  const bySlug = useMemo(() => new Map(options.map((p) => [p.slug, p])), [options]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return options.filter((p) => !value.includes(p.slug) && (!s || p.name.toLowerCase().includes(s) || p.slug.includes(s))).slice(0, 30);
  }, [q, options, value]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1.5 text-[13px] font-bold text-[color:var(--text-primary)]">Picked products ({value.length})</div>
        {value.length === 0 && <div className="rounded-[6px] border border-dashed border-[color:var(--border)] px-3 py-3 text-[12px] text-[color:var(--text-muted)]">None picked. Search on the right to add.</div>}
        <ol className="space-y-1">
          {value.map((slug, i) => {
            const p = bySlug.get(slug);
            return (
              <li key={slug} className="flex items-center gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-2 py-1.5">
                <span className="w-5 text-right text-[11px] tabular-nums text-[color:var(--text-muted)]">{i + 1}</span>
                {p?.imageUrl ? <img src={getThumbUrl(p.imageUrl)} alt="" className="size-7 rounded object-cover" /> : <span className="size-7 rounded bg-[color:var(--surface-hover)]" />}
                <span className="min-w-0 flex-1 truncate text-[13px]">{p ? p.name : <span className="text-[color:var(--danger)]">{slug} (not found)</span>}{p?.isDraft && <Badge tone="warning" className="ml-1">Draft</Badge>}</span>
                <IconButton label="Move up" onClick={() => onChange(move(value, i, -1))} disabled={i === 0}><ArrowUp className="size-3.5" /></IconButton>
                <IconButton label="Move down" onClick={() => onChange(move(value, i, 1))} disabled={i === value.length - 1}><ArrowDown className="size-3.5" /></IconButton>
                <IconButton label="Remove" tone="danger" onClick={() => onChange(value.filter((s) => s !== slug))}><X className="size-3.5" /></IconButton>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products to add…" className="input-field w-full pl-8" aria-label="Search products" />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {results.map((p) => (
            <button key={p.slug} type="button" onClick={() => onChange([...value, p.slug])} disabled={value.length >= 40}
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-[color:var(--surface-hover)] disabled:opacity-50">
              {p.imageUrl ? <img src={getThumbUrl(p.imageUrl)} alt="" className="size-7 rounded object-cover" /> : <span className="size-7 rounded bg-[color:var(--surface-hover)]" />}
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <Plus className="size-3.5 text-[color:var(--primary)]" />
            </button>
          ))}
          {results.length === 0 && <div className="px-2 py-3 text-[12px] text-[color:var(--text-muted)]">No matching products.</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Editor dialog ── */
function RegionEditor({ initial, mapStates, takenMaps, products, onClose, onSaved }) {
  const [form, setForm] = useState(initial.form);
  const [tab, setTab] = useState('basics');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const saved = useMemo(() => new Set(initial.savedImages), [initial.savedImages]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const upd = (k) => (e) => set(k, e.target.value);
  const setSection = (i, k, v) => set('sections', form.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  const save = async (publishOverride) => {
    const payload = {
      ...form,
      isPublished: publishOverride ?? form.isPublished,
      slug: form.slug.trim() || toSlug(form.name),
      productSlugs: form.productSlugs,
      sections: form.sections,
    };
    if (!payload.name.trim()) { toast.error('Enter the region name'); setTab('basics'); return; }
    if (!payload.mapStateId) { toast.error('Choose the state on the map'); setTab('basics'); return; }
    setSaving(true);
    try {
      const res = initial.id ? await api.put(`/admin/regions/${initial.id}`, payload) : await api.post('/admin/regions', payload);
      toast.success(res.data?.message || 'Saved');
      onSaved(res.data.data);
    } catch (err) {
      const field = err?.response?.data?.error?.field;
      if (field) setTab({ sections: 'story', signatureMasalas: 'panel', produces: 'panel', dishes: 'panel', productSlugs: 'products', seoTitle: 'seo', seoDescription: 'seo' }[field] || 'basics');
      toast.error(errMsg(err, 'Could not save the region'));
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { value: 'basics', label: 'Basics & card' },
    { value: 'panel', label: 'Map panel', count: form.produces.length + form.signatureMasalas.length + form.dishes.length },
    { value: 'story', label: 'Story', count: form.sections.length },
    { value: 'products', label: 'Products', count: form.productSlugs.length },
    { value: 'seo', label: 'SEO' },
  ];

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={initial.id ? `Edit region — ${initial.form.name}` : 'New region'}
        onClose={onClose}
        width="max-w-4xl"
        footer={<>
          <label className="mr-auto flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)} className="size-4 accent-brand-green" /> Published
          </label>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save()} loading={saving} disabled={busy}>{form.isPublished ? 'Save & publish' : 'Save draft'}</Button>
        </>}
      >
        <Tabs items={TABS} value={tab} onChange={setTab} className="-mx-4 -mt-4 mb-4 px-2" />

        {tab === 'basics' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Region name" required hint="Shown as the page title, e.g. Kerala">
              <input value={form.name} maxLength={80} className="input-field"
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : toSlug(v) })); }} />
            </Field>
            <Field label="Page address" hint={`wahspices.in/regions/${form.slug || toSlug(form.name) || '…'}`}>
              <input value={form.slug} maxLength={80} className="input-field" onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }} placeholder="auto from name" />
            </Field>
            <Field label="State on the India map" required hint="Highlighted on the map; one story per state.">
              <select value={form.mapStateId} onChange={upd('mapStateId')} className="input-field">
                <option value="" disabled>Choose…</option>
                {mapStates.map((m) => (
                  <option key={m.id} value={m.id} disabled={takenMaps.has(m.id) && m.id !== initial.form.mapStateId}>
                    {m.name}{takenMaps.has(m.id) && m.id !== initial.form.mapStateId ? ' (has a story)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Accent colour" hint="Card bar, map highlight and page accents">
              <div className="flex items-center gap-2">
                <input type="color" value={safeColor(form.accentColor)} onChange={upd('accentColor')} className="h-9 w-12 cursor-pointer rounded border border-[color:var(--border)] bg-transparent" aria-label="Pick colour" />
                <input value={form.accentColor} onChange={upd('accentColor')} maxLength={7} className="input-field w-28 font-mono" />
              </div>
            </Field>
            <Field label="Tagline" className="md:col-span-2" hint="e.g. Land of spices (max 120)">
              <input value={form.tagline} maxLength={120} onChange={upd('tagline')} className="input-field" />
            </Field>
            <Field label="Card / intro text" className="md:col-span-2" hint={`${form.cardText.length}/400 — shown under the title on the page`}>
              <textarea rows={3} value={form.cardText} maxLength={400} onChange={upd('cardText')} className="input-field resize-y" />
            </Field>
            <Field label="Landmark badge" hint="On the card photo, e.g. Hawa Mahal">
              <input value={form.landmark} maxLength={80} onChange={upd('landmark')} className="input-field" />
            </Field>
            <Field label="Featured masala tag" hint="On the card photo, e.g. Chole Masala">
              <input value={form.featuredMasala} maxLength={60} onChange={upd('featuredMasala')} className="input-field" />
            </Field>
            <ImageField label="Hero photo (required to publish)" value={form.heroImageUrl} savedValues={saved} busy={busy} setBusy={setBusy}
              onChange={(v) => set('heroImageUrl', v)} hint="Wide landscape photo, at least 1600px wide." />
            <ImageField label="Card photo (optional)" value={form.cardImageUrl} savedValues={saved} busy={busy} setBusy={setBusy}
              onChange={(v) => set('cardImageUrl', v)} hint="Smaller image for the home carousel; uses the hero photo if empty." />
            <Field label="Hero photo credit" className="md:col-span-2" hint="Required for Creative Commons photos, e.g. Photo: Name · CC BY-SA 4.0 (Wikimedia Commons)">
              <input value={form.heroImageCredit} maxLength={300} onChange={upd('heroImageCredit')} className="input-field" />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--text-secondary)] md:col-span-2">
              <input type="checkbox" checked={form.showOnHome} onChange={(e) => set('showOnHome', e.target.checked)} className="size-4 accent-brand-green" /> Show in the home-page carousel
            </label>
          </div>
        )}

        {tab === 'panel' && (
          <div className="space-y-6">
            <ListEditor title="What grows here" hint="Crops and spices of the region (chips next to the map). Icon = one emoji." withIcon
              items={form.produces} onChange={(v) => set('produces', v)} namePlaceholder="e.g. Black pepper" notePlaceholder="Short note (optional)" />
            <ListEditor title="Signature masalas" items={form.signatureMasalas} onChange={(v) => set('signatureMasalas', v)}
              namePlaceholder="e.g. Sambar podi" notePlaceholder="What's in it / what it's for" />
            <ListEditor title="Famous dishes" items={form.dishes} onChange={(v) => set('dishes', v)}
              namePlaceholder="e.g. Appam & stew" notePlaceholder="Short description (optional)" />
          </div>
        )}

        {tab === 'story' && (
          <div className="space-y-4">
            <p className="text-[12px] text-[color:var(--text-muted)]">Plain text only — leave an empty line between paragraphs. Each section can have one photo; add the photographer credit for Creative Commons images.</p>
            {form.sections.map((s, i) => (
              <Card key={i} title={`Section ${i + 1}${s.heading ? ` — ${s.heading}` : ''}`} bodyClassName="p-3"
                actions={<>
                  <IconButton label="Move up" onClick={() => set('sections', move(form.sections, i, -1))} disabled={i === 0}><ArrowUp className="size-3.5" /></IconButton>
                  <IconButton label="Move down" onClick={() => set('sections', move(form.sections, i, 1))} disabled={i === form.sections.length - 1}><ArrowDown className="size-3.5" /></IconButton>
                  <IconButton label="Remove section" tone="danger" onClick={() => set('sections', form.sections.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></IconButton>
                </>}>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="space-y-3">
                    <Field label="Heading" required><input value={s.heading} maxLength={150} onChange={(e) => setSection(i, 'heading', e.target.value)} className="input-field" /></Field>
                    <Field label="Text" required hint={`${s.body.length}/8000`}>
                      <textarea rows={9} value={s.body} maxLength={8000} onChange={(e) => setSection(i, 'body', e.target.value)} className="input-field resize-y" />
                    </Field>
                  </div>
                  <div className="space-y-2">
                    <ImageField label="Photo (optional)" value={s.imageUrl} savedValues={saved} busy={busy} setBusy={setBusy} onChange={(v) => setSection(i, 'imageUrl', v)} />
                    {s.imageUrl && (<>
                      <Field label="Image description (alt)"><input value={s.imageAlt} maxLength={200} onChange={(e) => setSection(i, 'imageAlt', e.target.value)} className="input-field" /></Field>
                      <Field label="Caption"><input value={s.imageCaption} maxLength={300} onChange={(e) => setSection(i, 'imageCaption', e.target.value)} className="input-field" /></Field>
                      <Field label="Photo credit"><input value={s.imageCredit} maxLength={300} onChange={(e) => setSection(i, 'imageCredit', e.target.value)} className="input-field" /></Field>
                    </>)}
                  </div>
                </div>
              </Card>
            ))}
            <Button variant="secondary" onClick={() => set('sections', [...form.sections, { heading: '', body: '', imageUrl: '', imageAlt: '', imageCaption: '', imageCredit: '' }])} disabled={form.sections.length >= 12}>
              <Plus className="size-4" /> Add section
            </Button>
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[color:var(--text-secondary)]">
              <input type="checkbox" checked={form.autoLinkProducts} onChange={(e) => set('autoLinkProducts', e.target.checked)} className="mt-0.5 size-4 accent-brand-green" />
              <span>Also show products whose <b>State</b> (Products → edit) matches this region&apos;s name or map state. Picked products are shown first, in this order.</span>
            </label>
            <ProductPicker options={products} value={form.productSlugs} onChange={(v) => set('productSlugs', v)} />
          </div>
        )}

        {tab === 'seo' && (
          <div className="space-y-3">
            <Field label="SEO title" hint={`${form.seoTitle.length}/70 — browser tab and Google title; defaults to "<name> — Spices & Story | WAH! Spices"`}>
              <input value={form.seoTitle} maxLength={70} onChange={upd('seoTitle')} className="input-field" />
            </Field>
            <Field label="SEO description" hint={`${form.seoDescription.length}/160 — defaults to the card text`}>
              <textarea rows={3} value={form.seoDescription} maxLength={160} onChange={upd('seoDescription')} className="input-field resize-y" />
            </Field>
          </div>
        )}
      </DialogPanel>
    </AdminModal>
  );
}

const toForm = (d) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.entries(d).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? EMPTY[k]])),
  sections: (d.sections || []).map((s) => ({
    heading: s.heading || '', body: s.body || '', imageUrl: s.imageUrl || '', imageAlt: s.imageAlt || '', imageCaption: s.imageCaption || '', imageCredit: s.imageCredit || '',
  })),
});

/* ── Page ── */
export default function AdminRegions() {
  const [items, setItems] = useState(null);
  const [mapStates, setMapStates] = useState([]);
  const [products, setProducts] = useState([]);
  const [editor, setEditor] = useState(null);     // { id, form, savedImages }
  const [loadingId, setLoadingId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [orderBusy, setOrderBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/regions');
      setItems(res.data.data.items);
      setMapStates(res.data.data.mapStates);
    } catch (err) {
      toast.error(errMsg(err, 'Could not load regions'));
      setItems([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/admin/regions/product-options').then((r) => setProducts(r.data.data || [])).catch(() => {});
  }, []);

  const takenMaps = useMemo(() => new Set((items || []).map((r) => r.mapStateId)), [items]);
  const mapName = (id) => mapStates.find((m) => m.id === id)?.name || id;

  const openNew = () => setEditor({ id: null, form: { ...EMPTY, sections: EMPTY.sections.map((s) => ({ ...s })) }, savedImages: [] });
  const openEdit = async (r) => {
    setLoadingId(r.id);
    try {
      const res = await api.get(`/admin/regions/${r.id}`);
      const d = res.data.data;
      setEditor({ id: d.id, form: toForm(d), savedImages: [d.heroImageUrl, d.cardImageUrl, ...(d.sections || []).map((s) => s.imageUrl)].filter(Boolean) });
    } catch (err) {
      toast.error(errMsg(err, 'Could not load the region'));
    } finally {
      setLoadingId(null);
    }
  };

  const togglePublish = async (r) => {
    try {
      const res = await api.patch(`/admin/regions/${r.id}/publish`, { published: !r.isPublished });
      toast.success(res.data?.message || 'Saved');
      setItems((list) => list.map((x) => (x.id === r.id ? { ...x, isPublished: !r.isPublished } : x)));
    } catch (err) { toast.error(errMsg(err, 'Could not change publish state')); }
  };
  const toggleHome = async (r) => {
    try {
      const res = await api.patch(`/admin/regions/${r.id}/home`, { showOnHome: !r.showOnHome });
      toast.success(res.data?.message || 'Saved');
      setItems((list) => list.map((x) => (x.id === r.id ? { ...x, showOnHome: !r.showOnHome } : x)));
    } catch (err) { toast.error(errMsg(err, 'Could not update')); }
  };
  const reorder = async (i, d) => {
    const next = move(items, i, d);
    if (next === items) return;
    const prev = items;
    setItems(next);
    setOrderBusy(true);
    try { await api.put('/admin/regions/reorder', { ids: next.map((r) => r.id) }); }
    catch (err) { setItems(prev); toast.error(errMsg(err, 'Could not save the order')); }
    finally { setOrderBusy(false); }
  };
  const remove = async () => {
    const r = confirmDel;
    try {
      await api.delete(`/admin/regions/${r.id}`);
      toast.success(`${r.name} deleted`);
      setConfirmDel(null);
      load();
    } catch (err) { toast.error(errMsg(err, 'Could not delete')); }
  };
  const previewUrl = (r) => `/regions/${r.slug}?preview=${r.id}`;

  const published = (items || []).filter((r) => r.isPublished).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Regions"
        description={items ? `State stories for the home carousel and the /regions map · ${published} published of ${items.length}` : 'State stories for the home carousel and the /regions map'}
        actions={<>
          <a href="/regions" target="_blank" rel="noopener noreferrer"><Button variant="secondary"><ExternalLink className="size-4" /> View on website</Button></a>
          <Button onClick={openNew}><Plus className="size-4" /> New region</Button>
        </>}
      />

      <Card bodyClassName="p-3">
        {!items ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="block h-12 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={MapIcon} title="No regions yet" action={<Button size="sm" onClick={openNew}><Plus className="size-3.5" /> New region</Button>}>
            Add a state story to show it on the home page and the India map.
          </EmptyState>
        ) : (
          <div className="grid-box">
            <table>
              <thead>
                <tr>
                  <th className="w-20 text-left">Order</th>
                  <th className="text-left">Region</th>
                  <th className="text-left">Map state</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Home</th>
                  <th className="text-left">Content</th>
                  <th className="text-left">Updated</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-right text-[12px] tabular-nums text-[color:var(--text-muted)]">{i + 1}</span>
                        <IconButton label={`Move ${r.name} up`} onClick={() => reorder(i, -1)} disabled={i === 0 || orderBusy}><ArrowUp className="size-3.5" /></IconButton>
                        <IconButton label={`Move ${r.name} down`} onClick={() => reorder(i, 1)} disabled={i === items.length - 1 || orderBusy}><ArrowDown className="size-3.5" /></IconButton>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[4px]" style={{ backgroundColor: safeColor(r.accentColor) }}>
                          {r.cardImageUrl && <img src={regionImage(r.cardImageUrl)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                          <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: safeColor(r.accentColor) }} />
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <div className="truncate font-bold text-[color:var(--text-primary)]">{r.name}</div>
                          <div className="truncate text-[12px] text-[color:var(--text-muted)]">/regions/{r.slug}{r.tagline ? ` · ${r.tagline}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{mapName(r.mapStateId)}</td>
                    <td>
                      <button type="button" onClick={() => togglePublish(r)} title={r.isPublished ? 'Unpublish' : 'Publish'}>
                        <Badge tone={r.isPublished ? 'success' : 'neutral'} className="cursor-pointer hover:brightness-95">
                          {r.isPublished ? <Eye className="size-3" /> : <EyeOff className="size-3" />}{r.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => toggleHome(r)} title={r.showOnHome ? 'Hide from home page' : 'Show on home page'}>
                        <Badge tone={r.showOnHome ? 'info' : 'neutral'} className="cursor-pointer hover:brightness-95"><Home className="size-3" />{r.showOnHome ? 'On home' : 'Hidden'}</Badge>
                      </button>
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-[color:var(--text-muted)]">{r.sectionCount} sections · {r.productCount} products</td>
                    <td className="whitespace-nowrap text-[12px] text-[color:var(--text-muted)]">{fmtDate(r.updatedAt)}<div className="truncate">{r.updatedBy}</div></td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <a href={previewUrl(r)} target="_blank" rel="noopener noreferrer" title="Preview on the website" aria-label={`Preview ${r.name}`}
                          className="inline-flex size-7 items-center justify-center rounded-[4px] text-[color:var(--text-muted)] hover:bg-[color:var(--primary-soft)] hover:text-[color:var(--primary)]">
                          <ExternalLink className="size-3.5" />
                        </a>
                        <IconButton label={`Edit ${r.name}`} tone="primary" disabled={loadingId === r.id} onClick={() => openEdit(r)}>
                          {loadingId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Edit2 className="size-3.5" />}
                        </IconButton>
                        <IconButton label={`Delete ${r.name}`} tone="danger" onClick={() => setConfirmDel(r)}><Trash2 className="size-3.5" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editor && (
        <RegionEditor
          key={editor.id || 'new'}
          initial={editor}
          mapStates={mapStates}
          takenMaps={takenMaps}
          products={products}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); load(); }}
        />
      )}

      {confirmDel && (
        <AdminModal onClose={() => setConfirmDel(null)}>
          <DialogPanel title={`Delete ${confirmDel.name}?`} onClose={() => setConfirmDel(null)} width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={remove}><Trash2 className="size-3.5" /> Delete</Button>
            </>}>
            <p className="text-[13px] text-[color:var(--text-secondary)]">
              The story disappears from the website and the map. Photos uploaded for it are deleted. (A built-in region you delete is not re-created.)
              To hide it temporarily, unpublish it instead.
            </p>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
