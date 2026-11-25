import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Upload, ImageOff, Star, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import AdminModal from '@/admin/components/AdminModal';
import { getImageUrl } from '@/utils/product';
import { DialogPanel, Field, Button, IconButton } from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

/** "PouchPack" -> "Pouch Pack" (pack types are admin-managed names) */
export const packLabel = (v) => (v ? String(v).replace(/([a-z])([A-Z])/g, '$1 $2') : '—');

/** "250g" → 250, "1kg" / "1.5 kg" → 1000 / 1500 */
export function parseGrams(weight) {
  const m = String(weight || '').trim().toLowerCase().match(/^([\d.]+)\s*(kg|g|gm|gms)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(m[2] === 'kg' ? n * 1000 : n);
}

const EMPTY = {
  name: '', category: '', subCategory: '', packType: '', badge: '', state: '',
  hsnCode: '', gstRate: 5, featured: false, isDraft: false,
  description: '', ingredients: '', usages: '', seoTitle: '', seoDescription: '',
};

let tmpId = 0;
const blankRow = (size) => ({
  key: `new-${++tmpId}`, id: null,
  weight: size?.weight || '', grams: size?.grams || '', price: '', mrp: '', inStock: true, isDefault: false,
});

export default function ProductEditor({ product, categories, packTypes, onClose, onSaved }) {
  const isEdit = !!product;
  const lk = useLookups();
  // Standard pack sizes come from Settings -> Master data -> PackSize (e.g. "100g")
  const packSizeList = lk.list('PackSize');
  const standardSizes = useMemo(
    () => packSizeList.map((o) => ({ weight: o.value, grams: parseGrams(o.value), hint: o.label })).filter((x) => x.grams > 0),
    [packSizeList]
  );
  const badges = lk.list('ProductBadge');
  const gstSlabs = lk.list('GstSlab');
  const [form, setForm] = useState(EMPTY);
  // GST follows the HSN master: a matching HSN code sets (and locks) the rate — the server applies the same rule
  const hsnHit = lk.resolveHsn(form.hsnCode);
  useEffect(() => {
    if (hsnHit && Number(form.gstRate) !== Number(hsnHit.gstRate)) setForm((f) => ({ ...f, gstRate: Number(hsnHit.gstRate) }));
  }, [hsnHit?.code, hsnHit?.gstRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  const mains = useMemo(() => categories.filter((c) => !c.parentId).sort((a, b) => a.displayOrder - b.displayOrder), [categories]);
  const mainForForm = mains.find((c) => c.slug === form.category);
  const subs = useMemo(
    () => (mainForForm ? categories.filter((c) => c.parentId === mainForForm.id).sort((a, b) => a.displayOrder - b.displayOrder) : []),
    [categories, mainForForm]
  );
  const activePackTypes = packTypes.filter((p) => p.isActive);

  // Load full product (description, usages, variants…) when editing
  useEffect(() => {
    if (!isEdit) {
      setForm({ ...EMPTY, category: mains[0]?.slug || '', packType: activePackTypes[0]?.name || 'PouchPack' });
      setRows([{ ...blankRow({ weight: '100g', grams: 100 }), isDefault: true }]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/admin/products/${product.id}`);
        const d = res.data.data;
        if (!alive) return;
        setForm({
          name: d.name || '', category: d.category || '', subCategory: d.subCategory || '',
          packType: d.packType || '', badge: d.badge || '', state: d.state || '',
          hsnCode: d.hsnCode || '', gstRate: d.gstRate ?? 5, featured: !!d.featured, isDraft: !!d.isDraft,
          description: d.description || '', ingredients: d.ingredients || '',
          usages: (d.usages || []).join('\n'), seoTitle: d.seoTitle || '', seoDescription: d.seoDescription || '',
        });
        setImageUrl(d.imageUrl || null);
        const vs = (d.variants || []).map((v) => ({
          key: `v-${v.id}`, id: v.id, weight: v.weight, grams: v.weightGrams, price: v.price, mrp: v.mrp,
          inStock: v.inStock, isDefault: v.isDefault,
        }));
        // Products created before pack sizes existed: start from their single weight/price
        setRows(vs.length ? vs : [{ ...blankRow({ weight: d.weight, grams: parseGrams(d.weight) }), price: d.price, mrp: d.mrp, isDefault: true }]);
      } catch {
        toast.error('Could not load product details');
        onClose();
      } finally {
        if (alive) setLoadingDetail(false);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setDefault = (key) => setRows((rs) => rs.map((r) => ({ ...r, isDefault: r.key === key })));
  const removeRow = (key) => setRows((rs) => {
    const next = rs.filter((r) => r.key !== key);
    if (next.length && !next.some((r) => r.isDefault)) next[0] = { ...next[0], isDefault: true };
    return next;
  });
  const addSize = (size) => {
    if (size && rows.some((r) => parseGrams(r.weight) === size.grams)) return;
    setRows((rs) => [...rs, { ...blankRow(size), isDefault: rs.length === 0 }].sort((a, b) => (parseGrams(a.weight) || 1e9) - (parseGrams(b.weight) || 1e9)));
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|avif|gif)$/.test(f.type)) { toast.error('Please choose a PNG, JPG or WEBP image'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const validate = () => {
    if (!form.name.trim()) return 'Product name is required';
    if (!form.category) return 'Choose a category';
    if (!rows.length) return 'Add at least one pack size';
    const seen = new Set();
    for (const r of rows) {
      const g = Number(r.grams) || parseGrams(r.weight);
      if (!r.weight.trim() || !g) return `Enter a valid pack size like 100g or 1kg (row "${r.weight || 'blank'}")`;
      if (seen.has(g)) return `Pack size ${r.weight} is listed twice`;
      seen.add(g);
      if (!(Number(r.price) > 0)) return `Enter a selling price for ${r.weight}`;
      if (!(Number(r.mrp) > 0)) return `Enter the MRP for ${r.weight}`;
      if (Number(r.price) > Number(r.mrp)) return `Price can't be more than MRP for ${r.weight}`;
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const variants = rows.map((r) => ({
        id: r.id, weight: r.weight.trim(), weightGrams: Number(r.grams) || parseGrams(r.weight),
        price: Number(r.price), mrp: Number(r.mrp), inStock: r.inStock, isDefault: r.isDefault,
      }));
      const def = variants.find((v) => v.isDefault) || variants[0];
      const payload = {
        name: form.name.trim(), category: form.category, subCategory: form.subCategory || null,
        packType: form.packType || 'PouchPack', badge: form.badge || null, state: form.state || null,
        hsnCode: form.hsnCode || null, gstRate: Number(form.gstRate) || 0,
        featured: form.featured, isDraft: form.isDraft,
        description: form.description || null, ingredients: form.ingredients || null,
        usages: form.usages.split('\n').map((u) => u.trim()).filter(Boolean),
        seoTitle: form.seoTitle, seoDescription: form.seoDescription,
        // Base fields mirror the default pack size (the server also enforces this)
        price: def.price, mrp: def.mrp, weight: def.weight,
        variants,
      };
      const res = isEdit
        ? await api.put(`/admin/products/${product.id}`, payload)
        : await api.post('/admin/products', payload);
      let saved = res.data.data;

      if (file && saved?.id) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          const up = await api.post(`/admin/products/${saved.id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          saved = up.data.data || saved;
        } catch (e) {
          toast.error(e.response?.data?.error?.message || 'Product saved, but the image upload failed');
        }
      }
      toast.success(isEdit ? 'Product updated!' : 'Product added!', { style: { borderRadius: '12px' } });
      onSaved(saved, isEdit);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const shownImage = preview || getImageUrl(imageUrl);
  const cellInput = 'input-field !h-8 !px-2 text-[13px]';
  const muted = 'font-normal text-[color:var(--text-muted)]';

  return (
    <AdminModal onClose={onClose}>
      <DialogPanel
        title={isEdit ? `Edit — ${product.name}` : 'Add New Product'}
        onClose={onClose}
        width="max-w-4xl"
        footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={loadingDetail}>{isEdit ? 'Save Changes' : 'Add Product'}</Button>
        </>}
      >
        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[13px] text-[color:var(--text-muted)]">
            <Loader2 className="size-6 animate-spin text-[color:var(--primary)]" />
            Loading product…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Basics + image */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
              <div>
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[8px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)]">
                  {shownImage
                    ? <img src={shownImage} alt="" className="h-full w-full object-cover" />
                    : <div className="text-center text-[color:var(--text-muted)]"><ImageOff className="mx-auto mb-1 size-7" strokeWidth={1.5} /><span className="text-[12px]">No image</span></div>}
                </div>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={pickFile} />
                <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => fileInput.current?.click()}>
                  <Upload className="size-3.5" /> {shownImage ? 'Change image' : 'Upload image'}
                </Button>
                {file && <p className="mt-1 truncate text-[11px] text-[color:var(--text-muted)]">{file.name} — uploads on save</p>}
              </div>

              <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2">
                <Field label="Product Name" required className="sm:col-span-2">
                  <input value={form.name} onChange={set('name')} className="input-field" placeholder="e.g. Pav Bhaji Masala" />
                </Field>
                <Field label="Category" required>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subCategory: '' }))} className="input-field">
                    <option value="" disabled>Choose…</option>
                    {mains.map((c) => <option key={c.id} value={c.slug}>{c.icon} {c.name}</option>)}
                  </select>
                </Field>
                <Field label={<>Sub-category {subs.length === 0 && <span className={muted}>(none for this category)</span>}</>}>
                  <select value={form.subCategory} onChange={set('subCategory')} className="input-field" disabled={subs.length === 0}>
                    <option value="">— None —</option>
                    {subs.map((c) => <option key={c.id} value={c.slug}>{c.icon} {c.name}</option>)}
                  </select>
                </Field>
                <Field label="Pack Type">
                  <select value={form.packType} onChange={set('packType')} className="input-field">
                    {activePackTypes.length === 0 && <option value="PouchPack">Pouch Pack</option>}
                    {activePackTypes.map((pt) => <option key={pt.id} value={pt.name}>{packLabel(pt.name)}</option>)}
                  </select>
                </Field>
                <Field label="Badge">
                  <select value={form.badge} onChange={set('badge')} className="input-field">
                    <option value="">— None —</option>
                    {lookupOptions(badges, form.badge).map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="HSN Code" hint={hsnHit ? `${hsnHit.code} · ${hsnHit.description}` : (form.hsnCode ? 'Not in the HSN master — choose the GST % yourself' : 'Pick from the HSN master (GST & Tax)')}>
                  <input value={form.hsnCode} onChange={set('hsnCode')} className="input-field" placeholder="09109100" list="hsn-master-codes" />
                  <datalist id="hsn-master-codes">
                    {lk.hsnCodes.map((h) => <option key={h.code} value={h.code}>{`${h.gstRate}% — ${h.description}`}</option>)}
                  </datalist>
                </Field>
                <Field label="GST %" hint={hsnHit ? `From HSN master (${hsnHit.code}) — change it in GST & Tax → HSN Master` : undefined}>
                  <select value={form.gstRate} onChange={set('gstRate')} className="input-field" disabled={!!hsnHit}>
                    {lookupOptions(gstSlabs, String(form.gstRate)).map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </Field>
                <div className="flex flex-wrap gap-5 sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
                    <input type="checkbox" checked={form.featured} onChange={set('featured')} className="size-4 accent-brand-green" /> Featured on home page
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
                    <input type="checkbox" checked={form.isDraft} onChange={set('isDraft')} className="size-4 accent-brand-green" /> Draft (hidden from website)
                  </label>
                </div>
              </div>
            </div>

            {/* Pack sizes */}
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13px] font-bold text-[color:var(--text-primary)]">Pack Sizes &amp; Prices</h3>
                <div className="flex flex-wrap gap-1.5">
                  {standardSizes.map((s) => {
                    const has = rows.some((r) => parseGrams(r.weight) === s.grams);
                    return (
                      <Button key={s.weight} variant="secondary" size="sm" className="!h-7 !px-2 !text-[12px]" title={s.hint} disabled={has} onClick={() => addSize(s)}>
                        + {s.weight}
                      </Button>
                    );
                  })}
                  <Button variant="tertiary" size="sm" className="!h-7 !px-2 !text-[12px]" onClick={() => addSize(null)}><Plus className="size-3" /> Custom</Button>
                </div>
              </div>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Size</th>
                      <th className="text-left">Selling Price ₹</th>
                      <th className="text-left">MRP ₹</th>
                      <th className="text-right">Off</th>
                      <th className="text-center">In Stock</th>
                      <th className="text-center" title="Shown first on product cards">Default</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const off = Number(r.mrp) > Number(r.price) && Number(r.price) > 0 ? Math.round((1 - r.price / r.mrp) * 100) : 0;
                      return (
                        <tr key={r.key}>
                          <td>
                            <input value={r.weight} onChange={(e) => setRow(r.key, { weight: e.target.value, grams: parseGrams(e.target.value) })}
                              className={`${cellInput} w-24`} placeholder="100g" />
                          </td>
                          <td><input type="number" min="0" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value })} className={`${cellInput} w-28`} /></td>
                          <td><input type="number" min="0" value={r.mrp} onChange={(e) => setRow(r.key, { mrp: e.target.value })} className={`${cellInput} w-28`} /></td>
                          <td className="text-right text-[12px] font-bold text-[color:var(--success)]">{off ? `${off}%` : '—'}</td>
                          <td className="text-center"><input type="checkbox" checked={r.inStock} onChange={(e) => setRow(r.key, { inStock: e.target.checked })} className="size-4 accent-brand-green" /></td>
                          <td className="text-center">
                            <button type="button" aria-label="Make default size" onClick={() => setDefault(r.key)} className={r.isDefault ? 'text-[color:var(--accent-strong)]' : 'text-[color:var(--text-muted)] opacity-50 hover:opacity-100'}>
                              <Star className="size-4" fill={r.isDefault ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td className="text-right">
                            <IconButton label="Remove size" tone="danger" onClick={() => removeRow(r.key)}><Trash2 className="size-3.5" /></IconButton>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[12px] text-[color:var(--text-muted)]">Add at least one pack size using the buttons above.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Content */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Description" className="md:col-span-2">
                <textarea value={form.description} onChange={set('description')} rows={3} className="input-field" />
              </Field>
              <Field label="Ingredients">
                <textarea value={form.ingredients} onChange={set('ingredients')} rows={4} className="input-field" />
              </Field>
              <Field label={<>Uses / Perfect for <span className={muted}>(one per line)</span></>}>
                <textarea value={form.usages} onChange={set('usages')} rows={4} className="input-field" />
              </Field>
              <Field label="SEO Title">
                <input value={form.seoTitle} onChange={set('seoTitle')} className="input-field" maxLength={70} />
              </Field>
              <Field label="SEO Description">
                <input value={form.seoDescription} onChange={set('seoDescription')} className="input-field" maxLength={160} />
              </Field>
            </div>
          </div>
        )}
      </DialogPanel>
    </AdminModal>
  );
}
