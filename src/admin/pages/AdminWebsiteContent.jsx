import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2, ExternalLink, Info } from 'lucide-react';
import api from '@/services/api';
import { DEFAULT_BLOCKS } from '@/content/siteDefaults';
import { PageHeader, Card, Button, IconButton, Tabs, Segmented, Field, Badge, EmptyState, Skeleton, cn } from '@/admin/ui';

/* ───────────────────────── helpers ───────────────────────── */

const errMsg = (err, fallback) => err?.response?.data?.error?.message || fallback;
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));

// Same rules as the backend (SiteContentLogic.IsValidLink): site paths, http(s) URLs, mailto:, tel:, "#".
const LINK_KEYS = new Set(['path', 'url', 'link', 'href', 'maplink', 'ctalink', 'photo']);
function isHttpUrl(s) {
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.host; } catch { return false; }
}
function isValidLink(raw) {
  const s = String(raw).trim();
  if (s === '#') return true;
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes(' ')) return true;
  if (/^mailto:/i.test(s)) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.slice(7));
  if (/^tel:/i.test(s)) return /^\+?[0-9 -]{6,20}$/.test(s.slice(4));
  return isHttpUrl(s);
}
/** Returns the first invalid link in a block as a readable message, or null. */
function findBadLink(node, where = '') {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) { const e = findBadLink(node[i], `${where}[${i + 1}]`); if (e) return e; }
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const here = where ? `${where} › ${k}` : k;
      if (typeof v === 'string' && v.trim()) {
        if (LINK_KEYS.has(k.toLowerCase()) && !isValidLink(v)) return `"${v}" is not a valid link (${here}). Use a site path like /about or a full https:// URL.`;
        if (k === 'mapEmbedUrl' && !isHttpUrl(v.trim())) return `Map embed URL must be a full https:// URL.`;
      }
      const e = findBadLink(v, here); if (e) return e;
    }
  }
  return null;
}

const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/* ───────────────────────── generic editors ───────────────────────── */

function Text({ label, value, onChange, placeholder, hint, multiline, rows = 3, type = 'text', className, required }) {
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      {multiline
        ? <textarea className="input-field w-full" rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input type={type} className="input-field w-full" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Row controls: move up / down / remove */
function RowActions({ i, count, onMove, onRemove }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton label="Move up" onClick={() => onMove(i, -1)} disabled={i === 0} className="disabled:opacity-30"><ArrowUp className="size-3.5" /></IconButton>
      <IconButton label="Move down" onClick={() => onMove(i, 1)} disabled={i === count - 1} className="disabled:opacity-30"><ArrowDown className="size-3.5" /></IconButton>
      <IconButton label="Remove" tone="danger" onClick={() => onRemove(i)}><Trash2 className="size-3.5" /></IconButton>
    </div>
  );
}

/** Editable list of plain strings (add / remove / reorder). */
function StringList({ label, hint, items, onChange, placeholder, addLabel = 'Add item', multiline }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div>
      {label && <div className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">{label}</div>}
      <div className="space-y-1.5">
        {list.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {multiline
              ? <textarea className="input-field w-full" rows={3} value={v} placeholder={placeholder} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
              : <input type="text" className="input-field w-full" value={v} placeholder={placeholder} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />}
            <RowActions i={i} count={list.length} onMove={(a, d) => onChange(move(list, a, d))} onRemove={(a) => onChange(list.filter((_, j) => j !== a))} />
          </div>
        ))}
        {list.length === 0 && <div className="text-[12px] text-[color:var(--text-muted)]">None yet.</div>}
      </div>
      <Button variant="tertiary" size="sm" className="mt-1.5" onClick={() => onChange([...list, ''])}><Plus className="size-3.5" />{addLabel}</Button>
      {hint && <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">{hint}</div>}
    </div>
  );
}

/**
 * Editable list of objects. `fields` = [{ key, label, placeholder, type: 'text'|'textarea'|'checkbox'|'select', options, span }]
 * or pass `renderItem(item, set)` for nested editors.
 */
function ObjectList({ label, hint, items, onChange, fields, newItem, addLabel = 'Add', renderItem, itemTitle }) {
  const list = Array.isArray(items) ? items : [];
  const setItem = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div>
      {label && <div className="mb-1 text-[12px] font-bold text-[color:var(--text-secondary)]">{label}</div>}
      <div className="space-y-2">
        {list.map((item, i) => (
          <div key={i} className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-bold text-[color:var(--text-muted)]">{itemTitle ? itemTitle(item, i) : `#${i + 1}`}</span>
              <RowActions i={i} count={list.length} onMove={(a, d) => onChange(move(list, a, d))} onRemove={(a) => onChange(list.filter((_, j) => j !== a))} />
            </div>
            {renderItem ? renderItem(item, (patch) => setItem(i, patch)) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                {fields.map((f) => (
                  <div key={f.key} className={cn(f.span === 'full' ? 'sm:col-span-6' : f.span === 'sm' ? 'sm:col-span-1' : f.span === 'md' ? 'sm:col-span-2' : 'sm:col-span-3')}>
                    {f.type === 'checkbox' ? (
                      <div className="pt-5"><Toggle label={f.label} checked={item[f.key]} onChange={(v) => setItem(i, { [f.key]: v })} /></div>
                    ) : f.type === 'select' ? (
                      <Field label={f.label}>
                        <select className="input-field w-full" value={item[f.key] ?? ''} onChange={(e) => setItem(i, { [f.key]: e.target.value })}>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </Field>
                    ) : (
                      <Text label={f.label} placeholder={f.placeholder} multiline={f.type === 'textarea'} rows={f.rows || 3}
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={item[f.key]} onChange={(v) => setItem(i, { [f.key]: f.type === 'number' ? Number(v) : v })} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="text-[12px] text-[color:var(--text-muted)]">None yet.</div>}
      </div>
      <Button variant="tertiary" size="sm" className="mt-1.5" onClick={() => onChange([...list, clone(newItem)])}><Plus className="size-3.5" />{addLabel}</Button>
      {hint && <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">{hint}</div>}
    </div>
  );
}

const LINK_FIELDS = [
  { key: 'label', label: 'Label', placeholder: 'About Us' },
  { key: 'path', label: 'Link', placeholder: '/about or https://…' },
];

/* ───────────────────────── section editors ───────────────────────── */

function HeaderEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <StringList label="Announcement bar items" hint="Shown in the green top bar, separated by “ | ”." items={d.announcementItems} onChange={(v) => set({ announcementItems: v })} placeholder="🌿 100% Natural Ingredients" />
      <ObjectList label="Top bar links (Help Desk, Track Order …)" items={d.topLinks} onChange={(v) => set({ topLinks: v })} fields={LINK_FIELDS} newItem={{ label: '', path: '/' }} addLabel="Add link" itemTitle={(x) => x.label || 'New link'} />
      <Toggle label="Show the store phone number in the top bar (number comes from Settings → General)" checked={d.showPhone !== false} onChange={(v) => set({ showPhone: v })} />
      <ObjectList label="Main menu links (after Home and Products)" hint="Use site paths such as /blog." items={d.navLinks} onChange={(v) => set({ navLinks: v })} fields={LINK_FIELDS} newItem={{ label: '', path: '/' }} addLabel="Add menu link" itemTitle={(x) => x.label || 'New link'} />
      <Text label="Search box placeholder" value={d.searchPlaceholder} onChange={(v) => set({ searchPlaceholder: v })} />
      <StringList label="Popular searches (search popup)" items={d.popularSearches} onChange={(v) => set({ popularSearches: v })} placeholder="Garam Masala" />
    </div>
  );
}

function FooterEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <Text label="Brand description" multiline value={d.description} onChange={(v) => set({ description: v })} />
      <StringList label="Trust badges" items={d.badges} onChange={(v) => set({ badges: v })} placeholder="100% Natural" />
      <ObjectList
        label="Link columns"
        items={d.columns}
        onChange={(v) => set({ columns: v })}
        newItem={{ title: 'New column', links: [] }}
        addLabel="Add column"
        itemTitle={(c) => c.title || 'Column'}
        renderItem={(col, setCol) => (
          <div className="space-y-2">
            <Text label="Column title" value={col.title} onChange={(v) => setCol({ title: v })} />
            <ObjectList items={col.links} onChange={(v) => setCol({ links: v })} fields={LINK_FIELDS} newItem={{ label: '', path: '/' }} addLabel="Add link" itemTitle={(x) => x.label || 'New link'} />
          </div>
        )}
      />
      <Text label="Copyright line" value={d.copyright} onChange={(v) => set({ copyright: v })} hint="{{year}} and {{siteName}} are filled in automatically." />
    </div>
  );
}

const PLATFORMS = ['Facebook', 'Instagram', 'YouTube', 'Twitter', 'LinkedIn', 'WhatsApp', 'Other'];
function SocialEditor({ d, set }) {
  return (
    <ObjectList
      label="Social links"
      hint="Enabled links show as icons in the footer; the Contact page lists enabled links that have a handle or URL. Leave URL empty to show the icon without a link."
      items={d.items}
      onChange={(v) => set({ items: v })}
      newItem={{ platform: 'Instagram', url: '', handle: '', enabled: true }}
      addLabel="Add social link"
      itemTitle={(x) => `${x.platform || 'Link'}${x.enabled === false ? ' (hidden)' : ''}`}
      fields={[
        { key: 'platform', label: 'Platform', type: 'select', options: PLATFORMS, span: 'md' },
        { key: 'handle', label: 'Handle / name', placeholder: '@wahspices', span: 'md' },
        { key: 'enabled', label: 'Show on website', type: 'checkbox', span: 'md' },
        { key: 'url', label: 'Profile URL', placeholder: 'https://instagram.com/wahspices', span: 'full' },
      ]}
    />
  );
}

function ContactEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Page title" value={d.title} onChange={(v) => set({ title: v })} />
        <Text label="Subtitle" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
        <Text label="Phone card note" value={d.phoneNote} onChange={(v) => set({ phoneNote: v })} hint="Also used as support hours on Track Order." />
        <Text label="Email card note" value={d.emailNote} onChange={(v) => set({ emailNote: v })} />
        <Text label="Address suffix" value={d.addressSuffix} onChange={(v) => set({ addressSuffix: v })} hint='Appended to the second address line, e.g. ", India".' />
        <Text label="Working hours title" value={d.hoursTitle} onChange={(v) => set({ hoursTitle: v })} />
        <Text label="Working hours" value={d.hours} onChange={(v) => set({ hours: v })} />
        <Text label="Working hours note" value={d.hoursNote} onChange={(v) => set({ hoursNote: v })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StringList label="Extra phone numbers" items={d.extraPhones} onChange={(v) => set({ extraPhones: v })} placeholder="+91 …" addLabel="Add phone" />
        <StringList label="Extra email addresses" items={d.extraEmails} onChange={(v) => set({ extraEmails: v })} placeholder="orders@…" addLabel="Add email" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Form title" value={d.formTitle} onChange={(v) => set({ formTitle: v })} />
        <Text label="Success message" value={d.successMessage} onChange={(v) => set({ successMessage: v })} />
      </div>
      <StringList label="Subjects (form dropdown)" items={d.subjects} onChange={(v) => set({ subjects: v })} placeholder="Order Query" addLabel="Add subject" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Social box title" value={d.followTitle} onChange={(v) => set({ followTitle: v })} />
        <Text label="Map label" value={d.mapLabel} onChange={(v) => set({ mapLabel: v })} />
        <Text label="“Open in Google Maps” link" value={d.mapLink} onChange={(v) => set({ mapLink: v })} placeholder="https://maps.google.com/?q=…" />
        <Text label="Map embed URL (optional)" value={d.mapEmbedUrl} onChange={(v) => set({ mapEmbedUrl: v })} placeholder="https://www.google.com/maps/embed?pb=…" hint="Google Maps → Share → Embed a map → copy the src URL." />
      </div>
    </div>
  );
}

function FeedbackPageEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Page title" value={d.title} onChange={(v) => set({ title: v })} />
        <Text label="Subtitle" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
        <Text label="Rating question" value={d.ratingQuestion} onChange={(v) => set({ ratingQuestion: v })} />
        <Text label="Recommend question" value={d.recommendQuestion} onChange={(v) => set({ recommendQuestion: v })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StringList label="Products (dropdown)" items={d.products} onChange={(v) => set({ products: v })} addLabel="Add product" />
        <StringList label="Recommend options" items={d.recommendOptions} onChange={(v) => set({ recommendOptions: v })} addLabel="Add option" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Text label="Thank-you title" value={d.thankYouTitle} onChange={(v) => set({ thankYouTitle: v })} />
        <Text label="Thank-you text" value={d.thankYouText} onChange={(v) => set({ thankYouText: v })} />
        <Text label="Thank-you note" value={d.thankYouNote} onChange={(v) => set({ thankYouNote: v })} />
      </div>
    </div>
  );
}

function HelpEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Text label="Page title" value={d.title} onChange={(v) => set({ title: v })} />
        <Text label="Subtitle" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
        <Text label="Search placeholder" value={d.searchPlaceholder} onChange={(v) => set({ searchPlaceholder: v })} />
      </div>
      <ObjectList label="Quick links" items={d.quickLinks} onChange={(v) => set({ quickLinks: v })} newItem={{ label: '', icon: '📦', path: '/' }} addLabel="Add quick link"
        itemTitle={(x) => `${x.icon || ''} ${x.label || 'New link'}`}
        fields={[{ key: 'icon', label: 'Emoji', span: 'sm' }, { key: 'label', label: 'Label', span: 'md' }, { key: 'path', label: 'Link', placeholder: '/track-order', span: 'md' }]} />
      <ObjectList
        label="FAQ categories"
        items={d.faqs}
        onChange={(v) => set({ faqs: v })}
        newItem={{ category: 'New topic', questions: [] }}
        addLabel="Add category"
        itemTitle={(c) => `${c.category || 'Category'} · ${(c.questions || []).length} questions`}
        renderItem={(cat, setCat) => (
          <div className="space-y-2">
            <Text label="Category name" value={cat.category} onChange={(v) => setCat({ category: v })} />
            <ObjectList items={cat.questions} onChange={(v) => setCat({ questions: v })} newItem={{ q: '', a: '' }} addLabel="Add question"
              itemTitle={(x) => x.q || 'New question'}
              fields={[{ key: 'q', label: 'Question', span: 'full' }, { key: 'a', label: 'Answer', type: 'textarea', span: 'full' }]} />
          </div>
        )}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Bottom box title" value={d.ctaTitle} onChange={(v) => set({ ctaTitle: v })} />
        <Text label="Bottom box text" value={d.ctaText} onChange={(v) => set({ ctaText: v })} />
        <Text label="Button label" value={d.ctaButton} onChange={(v) => set({ ctaButton: v })} />
        <Text label="Button link" value={d.ctaLink} onChange={(v) => set({ ctaLink: v })} placeholder="/contact" />
      </div>
    </div>
  );
}

const VALUE_ICON_NAMES = ['Leaf', 'Shield', 'Award', 'Heart', 'Users', 'MapPin', 'Star', 'Truck', 'Sparkles', 'ThumbsUp'];
function AboutEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Hero badge" value={d.heroBadge} onChange={(v) => set({ heroBadge: v })} />
        <Text label="Hero title" value={d.heroTitle} onChange={(v) => set({ heroTitle: v })} />
      </div>
      <Text label="Hero text" multiline value={d.heroText} onChange={(v) => set({ heroText: v })} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Mission heading" value={d.missionTitle} onChange={(v) => set({ missionTitle: v })} />
        <Text label="Mission heading (highlighted word)" value={d.missionHighlight} onChange={(v) => set({ missionHighlight: v })} />
      </div>
      <StringList label="Mission paragraphs" multiline items={d.missionParagraphs} onChange={(v) => set({ missionParagraphs: v })} addLabel="Add paragraph" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="History button label" value={d.historyButton?.label} onChange={(v) => set({ historyButton: { ...(d.historyButton || {}), label: v } })} hint="Leave empty to hide the button." />
        <Text label="History button link" value={d.historyButton?.path} onChange={(v) => set({ historyButton: { ...(d.historyButton || {}), path: v } })} />
      </div>
      <ObjectList label="Stats (logo card)" items={d.stats} onChange={(v) => set({ stats: v })} newItem={{ value: '', label: '' }} addLabel="Add stat"
        itemTitle={(x) => `${x.value || '—'} · ${x.label || ''}`}
        fields={[{ key: 'value', label: 'Value', placeholder: '10K+' }, { key: 'label', label: 'Label', placeholder: 'Happy Families' }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Values heading" value={d.valuesTitle} onChange={(v) => set({ valuesTitle: v })} />
        <Text label="Values heading (highlighted word)" value={d.valuesHighlight} onChange={(v) => set({ valuesHighlight: v })} />
      </div>
      <ObjectList label="Core values" items={d.values} onChange={(v) => set({ values: v })} newItem={{ icon: 'Leaf', title: '', desc: '' }} addLabel="Add value"
        itemTitle={(x) => x.title || 'New value'}
        fields={[{ key: 'icon', label: 'Icon', type: 'select', options: VALUE_ICON_NAMES, span: 'md' }, { key: 'title', label: 'Title', span: 'md' }, { key: 'desc', label: 'Description', span: 'full' }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Text label="Team heading start" value={d.teamTitle} onChange={(v) => set({ teamTitle: v })} />
        <Text label="Team heading (highlighted)" value={d.teamHighlight} onChange={(v) => set({ teamHighlight: v })} />
        <Text label="Team heading end" value={d.teamTitleSuffix} onChange={(v) => set({ teamTitleSuffix: v })} />
      </div>
      <ObjectList label="Team members" items={d.team} onChange={(v) => set({ team: v })} newItem={{ name: '', role: '', state: '', photo: '' }} addLabel="Add member"
        itemTitle={(x) => x.name || 'New member'}
        fields={[{ key: 'name', label: 'Name', span: 'md' }, { key: 'role', label: 'Role', span: 'md' }, { key: 'state', label: 'Location', span: 'md' }, { key: 'photo', label: 'Photo URL', placeholder: '/yash.jpeg or https://…', span: 'full' }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Bottom banner title" value={d.ctaTitle} onChange={(v) => set({ ctaTitle: v })} />
        <Text label="Bottom banner text" value={d.ctaText} onChange={(v) => set({ ctaText: v })} />
        <Text label="Button label" value={d.ctaButton} onChange={(v) => set({ ctaButton: v })} />
        <Text label="Button link" value={d.ctaLink} onChange={(v) => set({ ctaLink: v })} placeholder="/products" />
      </div>
    </div>
  );
}

function PolicyEditor({ d, set }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Text className="sm:col-span-3" label="Page title" value={d.title} onChange={(v) => set({ title: v })} />
        <Text className="sm:col-span-1" label="Emoji" value={d.emoji} onChange={(v) => set({ emoji: v })} />
        <Text className="sm:col-span-2" label="Last updated" value={d.lastUpdated} onChange={(v) => set({ lastUpdated: v })} placeholder="June 2026" />
      </div>
      <ObjectList
        label="Sections"
        hint="One paragraph per line · start a line with “## ” for a sub-heading · wrap text in **double asterisks** for bold."
        items={d.sections}
        onChange={(v) => set({ sections: v })}
        newItem={{ title: '', body: '' }}
        addLabel="Add section"
        itemTitle={(x) => x.title || 'New section'}
        fields={[{ key: 'title', label: 'Heading', span: 'full' }, { key: 'body', label: 'Text', type: 'textarea', rows: 5, span: 'full' }]}
      />
    </div>
  );
}

function HomeHeroEditor({ d, set }) {
  const slides = Array.isArray(d.slides) ? d.slides : [];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-[6px] bg-[color:var(--info-bg)] p-2.5 text-[12px] text-[color:var(--info)]">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>The home page hero cycles through these slides — photo, spice, where it comes from and the text under the heading. Images: a site path like <b>/images/hero/chilli.jpg</b> or a full https:// link (landscape, about 1920×1080). The optional small image (about 960×540) is used on phones.</span>
      </div>
      <Text label="Seconds per slide (3–30)" value={String(d.intervalSeconds ?? 6)} onChange={(v) => set({ intervalSeconds: Math.min(30, Math.max(3, Number(v.replace(/[^0-9]/g, '')) || 6)) })} />
      <ObjectList items={slides} onChange={(v) => set({ slides: v })}
        newItem={{ spice: '', region: '', image: '', imageSmall: '', alt: '', text: '' }} addLabel="Add slide"
        itemTitle={(x) => [x.spice, x.region].filter(Boolean).join(' — ') || 'New slide'}
        fields={[
          { key: 'spice', label: 'Spice', placeholder: 'Lal Mirch', span: 'md' },
          { key: 'region', label: 'Comes from', placeholder: 'Guntur, Andhra Pradesh', span: 'md' },
          { key: 'image', label: 'Photo', placeholder: '/images/hero/chilli.jpg', span: 'full' },
          { key: 'imageSmall', label: 'Small photo for phones (optional)', placeholder: '/images/hero/chilli-sm.jpg', span: 'full' },
          { key: 'alt', label: 'Photo description (for screen readers)', span: 'full' },
          { key: 'text', label: 'Text under the heading', type: 'textarea', span: 'full' },
        ]} />
    </div>
  );
}

function TestimonialsEditor({ d, set }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-[6px] bg-[color:var(--info-bg)] p-2.5 text-[12px] text-[color:var(--info)]">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>The home page shows customer feedback you <b>feature</b> in <Link to="/admin/feedback" className="underline">Feedback</Link>. These testimonials are shown only while no feedback is featured.</span>
      </div>
      <ObjectList items={d.items} onChange={(v) => set({ items: v })} newItem={{ name: '', city: '', rating: 5, text: '', product: '' }} addLabel="Add testimonial"
        itemTitle={(x) => x.name || 'New testimonial'}
        fields={[
          { key: 'name', label: 'Name', span: 'md' }, { key: 'city', label: 'City', span: 'md' }, { key: 'product', label: 'Product', span: 'md' },
          { key: 'rating', label: 'Stars (1–5)', type: 'number', span: 'sm' }, { key: 'text', label: 'Quote', type: 'textarea', span: 'full' },
        ]} />
    </div>
  );
}

function MaintenanceEditor({ d, set, settings }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        Maintenance mode is currently
        <Badge tone={settings?.maintenanceMode ? 'danger' : 'success'}>{settings?.maintenanceMode ? 'ON' : 'OFF'}</Badge>
        <span className="text-[color:var(--text-muted)]">— switch it in <Link to="/admin/settings" className="underline">Settings</Link>.</span>
      </div>
      <Text label="Title" value={d.title} onChange={(v) => set({ title: v })} />
      <Text label="Message" multiline value={d.message} onChange={(v) => set({ message: v })} />
      <Text label="Note" value={d.note} onChange={(v) => set({ note: v })} hint="{{phone}} and {{email}} come from Settings." />
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

const SECTIONS = [
  { id: 'home-hero', label: 'Home hero', keys: ['home-hero'], Editor: HomeHeroEditor, desc: 'Home page slideshow: spice photos, where each spice comes from, and the text under the heading.' },
  { id: 'header', label: 'Header', keys: ['header'], Editor: HeaderEditor, desc: 'Announcement bar, top links, main menu and search suggestions.' },
  { id: 'footer', label: 'Footer', keys: ['footer'], Editor: FooterEditor, desc: 'Brand text, trust badges, link columns and copyright.' },
  { id: 'social', label: 'Social links', keys: ['social'], Editor: SocialEditor, desc: 'Social profiles shown in the footer and on the Contact page.' },
  { id: 'contact', label: 'Contact page', keys: ['contact'], Editor: ContactEditor, desc: 'Contact page texts, hours, extra numbers, form subjects and map.' },
  { id: 'feedback', label: 'Feedback page', keys: ['feedback'], Editor: FeedbackPageEditor, desc: 'Share Your Feedback page texts and options.' },
  { id: 'help', label: 'Help & FAQ', keys: ['help'], Editor: HelpEditor, desc: 'Help Center quick links and FAQs.' },
  { id: 'about', label: 'About', keys: ['about'], Editor: AboutEditor, desc: 'About Us story, stats, values and team.' },
  { id: 'policies', label: 'Policies', keys: ['policy-shipping', 'policy-return', 'policy-privacy', 'policy-quality', 'policy-terms'], Editor: PolicyEditor, desc: 'Shipping, return, privacy, quality and terms pages.' },
  { id: 'testimonials', label: 'Testimonials', keys: ['testimonials'], Editor: TestimonialsEditor, desc: 'Default home-page testimonials.' },
  { id: 'maintenance', label: 'Maintenance', keys: ['maintenance'], Editor: MaintenanceEditor, desc: 'What customers see while maintenance mode is on.' },
];
const POLICY_LABELS = { 'policy-shipping': 'Shipping', 'policy-return': 'Return', 'policy-privacy': 'Privacy', 'policy-quality': 'Quality', 'policy-terms': 'Terms' };
const PUBLIC_PATH = { 'home-hero': '/', header: '/', footer: '/', social: '/contact', contact: '/contact', feedback: '/feedback', help: '/help', about: '/about', testimonials: '/', maintenance: '/',
  'policy-shipping': '/shipping-policy', 'policy-return': '/return-policy', 'policy-privacy': '/privacy-policy', 'policy-quality': '/quality-policy', 'policy-terms': '/terms-conditions' };

const PLACEHOLDERS = ['siteName', 'tagline', 'phone', 'email', 'address', 'freeDeliveryAbove', 'deliveryCharge', 'avgDeliveryDays', 'year'];

export default function AdminWebsiteContent() {
  const [state, setState] = useState('loading'); // loading | ready | error
  const [saved, setSaved] = useState({});       // key → data as stored
  const [drafts, setDrafts] = useState({});     // key → edited data
  const [meta, setMeta] = useState({});         // key → { updatedAt, updatedBy }
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('header');
  const [policyKey, setPolicyKey] = useState('policy-shipping');
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setState('loading');
    try {
      const res = await api.get('/admin/site-content');
      const rows = res.data?.data?.blocks || [];
      const s = {}; const m = {};
      Object.keys(DEFAULT_BLOCKS).forEach((k) => { s[k] = clone(DEFAULT_BLOCKS[k]); });
      rows.forEach((r) => {
        s[r.key] = { ...(DEFAULT_BLOCKS[r.key] ? clone(DEFAULT_BLOCKS[r.key]) : {}), ...(r.data || {}) };
        m[r.key] = { updatedAt: r.updatedAt, updatedBy: r.updatedBy, stored: true };
      });
      setSaved(s); setDrafts(clone(s)); setMeta(m);
      setSettings(res.data?.data?.settings || null);
      setState('ready');
    } catch (err) {
      setState('error');
      toast.error(errMsg(err, 'Failed to load website content'));
    }
  };
  useEffect(() => { load(); }, []);

  const section = SECTIONS.find((s) => s.id === tab) || SECTIONS[0];
  const key = section.id === 'policies' ? policyKey : section.keys[0];
  const draft = drafts[key] || {};
  const dirtyKeys = useMemo(() => Object.keys(drafts).filter((k) => JSON.stringify(drafts[k]) !== JSON.stringify(saved[k])), [drafts, saved]);
  const isDirty = dirtyKeys.includes(key);

  const set = (patch) => setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));

  const save = async () => {
    const bad = findBadLink(draft);
    if (bad) { toast.error(bad); return; }
    setBusy('save');
    try {
      const res = await api.put(`/admin/site-content/${key}`, { data: draft });
      const row = res.data?.data;
      const stored = { ...(DEFAULT_BLOCKS[key] ? clone(DEFAULT_BLOCKS[key]) : {}), ...(row?.data || draft) };
      setSaved((p) => ({ ...p, [key]: stored }));
      setDrafts((p) => ({ ...p, [key]: clone(stored) }));
      setMeta((p) => ({ ...p, [key]: { updatedAt: row?.updatedAt, updatedBy: row?.updatedBy, stored: true } }));
      toast.success('Saved — the website now shows this content');
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save'));
    } finally { setBusy(null); }
  };

  const reset = async () => {
    if (!window.confirm('Restore this section to the original website text? Your changes to it will be lost.')) return;
    setBusy('reset');
    try {
      const res = await api.post(`/admin/site-content/${key}/reset`);
      const row = res.data?.data;
      const stored = { ...clone(DEFAULT_BLOCKS[key] || {}), ...(row?.data || {}) };
      setSaved((p) => ({ ...p, [key]: stored }));
      setDrafts((p) => ({ ...p, [key]: clone(stored) }));
      setMeta((p) => ({ ...p, [key]: { updatedAt: row?.updatedAt, updatedBy: row?.updatedBy, stored: true } }));
      toast.success('Restored to default');
    } catch (err) {
      toast.error(errMsg(err, 'Failed to restore'));
    } finally { setBusy(null); }
  };

  const discard = () => setDrafts((p) => ({ ...p, [key]: clone(saved[key]) }));

  const tabs = SECTIONS.map((s) => ({ value: s.id, label: s.label, count: s.keys.some((k) => dirtyKeys.includes(k)) ? '•' : undefined }));
  const Editor = section.Editor;
  const m = meta[key];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Content"
        description="Edit the text, links and lists shown on the customer website. Each section saves on its own."
        actions={<a href={PUBLIC_PATH[key] || '/'} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="size-4" />View on website</Button></a>}
      />

      <Card bodyClassName="p-3">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[12px]">
          <div className="flex items-start gap-2 text-[color:var(--text-secondary)]">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[color:var(--info)]" />
            <span>
              Phone, email, address, tagline and delivery charges are managed once in <Link to="/admin/settings" className="font-bold underline">Settings</Link> and used everywhere on the site.
              In any text you can write <code className="rounded bg-[color:var(--surface-hover)] px-1">{'{{placeholder}}'}</code> to insert them.
            </span>
          </div>
          {settings && (
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <span key={p} title={p === 'year' ? String(new Date().getFullYear()) : String(settings[p] ?? '')} className="rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--text-secondary)]">
                  {`{{${p}}}`} <span className="text-[color:var(--text-muted)]">= {p === 'year' ? new Date().getFullYear() : String(settings[p] ?? '—')}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {state === 'loading' && (
        <Card bodyClassName="p-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="block h-9 w-full" />)}</Card>
      )}
      {state === 'error' && (
        <Card><EmptyState title="Couldn't load website content" action={<Button variant="secondary" onClick={load}>Retry</Button>}>The website keeps showing its last saved content.</EmptyState></Card>
      )}
      {state === 'ready' && (
        <Card
          title={section.id === 'policies' ? `${POLICY_LABELS[key]} policy` : section.label}
          actions={(
            <>
              {isDirty && <Badge tone="warning">Unsaved changes</Badge>}
              {isDirty && <Button variant="tertiary" size="sm" onClick={discard}>Discard</Button>}
              {DEFAULT_BLOCKS[key] && <Button variant="secondary" size="sm" onClick={reset} loading={busy === 'reset'}><RotateCcw className="size-3.5" />Reset to default</Button>}
              <Button size="sm" onClick={save} loading={busy === 'save'} disabled={!isDirty}><Save className="size-3.5" />Save section</Button>
            </>
          )}
          bodyClassName="p-4"
        >
          <p className="mb-3 text-[12px] text-[color:var(--text-muted)]">
            {section.desc}
            {m?.updatedAt && <> · Last saved {new Date(m.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{m.updatedBy ? ` by ${m.updatedBy}` : ''}</>}
          </p>
          {section.id === 'policies' && (
            <div className="mb-4">
              <Segmented
                options={section.keys.map((k) => ({ value: k, label: `${POLICY_LABELS[k]}${dirtyKeys.includes(k) ? ' •' : ''}` }))}
                value={policyKey}
                onChange={setPolicyKey}
              />
            </div>
          )}
          <Editor d={draft} set={set} settings={settings} />
        </Card>
      )}
    </div>
  );
}
