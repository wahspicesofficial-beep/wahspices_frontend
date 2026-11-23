import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Eye, Video, Image as ImageIcon, Clock, Users, ChefHat, Loader2, Star, CookingPot } from 'lucide-react';
import { SkPageHeader, SkCardList } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchRecipes, createRecipe, updateRecipe, deleteRecipe, toggleRecipePublish,
} from '@/store/slices/adminSlice';
import AdminModal from '@/admin/components/AdminModal';
import api from '@/services/api';
import {
  PageHeader, Card, Badge, Button, IconButton, Segmented, SearchInput, Toolbar, EmptyState,
  DialogPanel, Field, usePagination, Pagination,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

const EMPTY = {
  title: '', slug: '', description: '', category: '', cookTime: '', prepTime: '',
  servings: '2', difficulty: '', ingredients: '', steps: '', tips: '',
  imageUrl: '', videoUrl: '', relatedMasala: '', tags: '',
  featured: false, isPublished: true, seoTitle: '', seoDescription: '',
};

/** JSON array string (or array) → one item per line */
const linesOf = (v) => {
  let arr = v;
  if (typeof v === 'string') { try { arr = JSON.parse(v); } catch { return v; } }
  return Array.isArray(arr) ? arr.map(x => (x && typeof x === 'object' ? x.instruction : x)).join('\n') : '';
};
const tagsText = (t) => linesOf(t).split('\n').filter(Boolean).join(', ');

const DIFF_TONE = { Easy: 'success', Medium: 'warning', Hard: 'danger' };

function MediaUploader({ label, accept, value, savedValue, onChange, uploading, setUploading, endpoint }) {
  const fileRef = useRef();
  const [urlDraft, setUrlDraft] = useState('');
  const isVideo = accept.includes('video');

  const handleFile = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Replacing an upload made in this session: drop the now-unused file
      if (value && value !== savedValue) api.delete(`${endpoint}?url=${encodeURIComponent(value)}`).catch(() => {});
      onChange(res.data.data.url);
      toast.success(`${label} uploaded!`, { style: { borderRadius: '12px' } });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed', { style: { borderRadius: '12px' } });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    // A file uploaded in this session (not yet saved) is deleted now; the saved file is
    // removed by the server when the record is saved without it.
    if (value && value !== savedValue) {
      try { await api.delete(`${endpoint}?url=${encodeURIComponent(value)}`); } catch { /* file already gone */ }
    }
    onChange('');
  };

  const applyUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/)/i.test(url)) { toast.error('Enter a full URL starting with http(s):// or /'); return; }
    onChange(url);
    setUrlDraft('');
  };

  return (
    <div>
      {/* Not a <Field>/<label> wrapper: it contains buttons and media controls */}
      <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">{label}</span>
      {value ? (
        <div className="relative overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)]">
          {isVideo ? (
            <video src={value} controls className="max-h-40 w-full object-contain" />
          ) : (
            <img src={value} alt="" className="max-h-36 w-full object-cover" />
          )}
          <button type="button" onClick={handleRemove} aria-label={`Remove ${label.toLowerCase()}`}
            className="absolute right-2 top-2 rounded-full bg-[color:var(--danger)] p-1 text-white hover:brightness-110">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center gap-1.5 rounded-[8px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] py-5 text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-[color:var(--primary)]" />
          ) : isVideo ? <Video className="size-5" strokeWidth={1.75} /> : <ImageIcon className="size-5" strokeWidth={1.75} />}
          <span className="text-[12px] font-bold">
            {uploading ? 'Uploading…' : `Click to upload ${label.toLowerCase()}`}
          </span>
          <span className="text-[11px]">{isVideo ? 'MP4, WebM, MOV · max 200 MB' : 'JPG, PNG, WebP · max 10 MB'}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      {!value && (
        <div className="mt-1.5 flex gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } }}
            onBlur={applyUrl}
            placeholder="Or paste a URL…"
            className="input-field flex-1 text-[12px]"
            aria-label={`${label} URL`}
          />
          <Button size="sm" variant="secondary" onClick={applyUrl} disabled={!urlDraft.trim()}>Use URL</Button>
        </div>
      )}
    </div>
  );
}

export default function AdminRecipes() {
  const dispatch = useAppDispatch();
  const { items: recipes, total } = useAppSelector((s) => s.admin.recipes);
  const loading = useAppSelector((s) => s.admin.loading);

  const [showModal, setShow]   = useState(false);
  const [editRec, setEdit]     = useState(null);
  const [form, setForm]        = useState(EMPTY);
  const [deleteId, setDel]     = useState(null);
  const [preview, setPreview]  = useState(null);
  const [uploading, setUploading] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [search, setSearch]    = useState('');
  const [saving, setSaving]    = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const lk = useLookups();
  const CATEGORIES = lk.list('RecipeCategory');
  const DIFFICULTIES = lk.list('RecipeDifficulty');

  useEffect(() => { dispatch(fetchRecipes({ limit: 500 })); }, [dispatch]);

  const filtered = recipes.filter(r => {
    const matchSearch = !search || (r.title || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || r.category === catFilter;
    return matchSearch && matchCat;
  });

  const pg = usePagination(filtered, 20);

  if (loading && !recipes.length) return (
    <div className="space-y-6"><SkPageHeader /><SkCardList count={6} /></div>
  );

  const upd = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const openAdd = () => {
    setEdit(null);
    setForm({ ...EMPTY, category: CATEGORIES[0]?.value || '', difficulty: DIFFICULTIES[0]?.value || '' });
    setShow(true);
  };
  const openEdit = async (row) => {
    // The list omits ingredients/steps/tips/SEO, so load the full recipe before editing
    setLoadingRec(true);
    try {
      const res = await api.get(`/admin/recipes/${row.id}`);
      const r = res.data.data;
      setEdit(r);
      setForm({
        title: r.title || '', slug: r.slug || '', description: r.description || '',
        category: r.category || '', cookTime: r.cookTime || '', prepTime: r.prepTime || '',
        servings: String(r.servings || 2), difficulty: r.difficulty || '',
        ingredients: linesOf(r.ingredients), steps: linesOf(r.steps),
        tips: r.tips || '', imageUrl: r.imageUrl || '', videoUrl: r.videoUrl || '',
        relatedMasala: r.relatedMasala || '', tags: tagsText(r.tags),
        featured: !!r.featured, isPublished: !!r.isPublished,
        seoTitle: r.seoTitle || '', seoDescription: r.seoDescription || '',
      });
      setShow(true);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not load the recipe');
    } finally {
      setLoadingRec(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required.', { style: { borderRadius: '12px' } });
      return;
    }
    const ingredients = form.ingredients.split('\n').map(s => s.trim()).filter(Boolean);
    const steps = form.steps.split('\n').map((s, i) => ({ step: i + 1, instruction: s.trim() })).filter(s => s.instruction);

    if (!(parseInt(form.servings) >= 1)) { toast.error('Servings must be at least 1'); return; }
    const payload = {
      title: form.title.trim(), slug: form.slug.trim() || null,
      description: form.description || null,
      category: form.category,
      cookTime: form.cookTime || null, prepTime: form.prepTime || null,
      servings: parseInt(form.servings) || 2, difficulty: form.difficulty,
      ingredients: ingredients.length ? JSON.stringify(ingredients) : null,
      steps: steps.length ? JSON.stringify(steps) : null,
      tips: form.tips || null,
      imageUrl: form.imageUrl || null, videoUrl: form.videoUrl || null,
      relatedMasala: form.relatedMasala || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean).length
        ? JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)) : null,
      featured: form.featured, isPublished: form.isPublished,
      seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null,
    };
    setSaving(true);
    try {
      if (editRec) {
        await dispatch(updateRecipe({ id: editRec.id, ...payload })).unwrap();
        toast.success('Recipe updated!', { style: { borderRadius: '12px' } });
      } else {
        await dispatch(createRecipe(payload)).unwrap();
        toast.success('Recipe added!', { style: { borderRadius: '12px' } });
      }
      setShow(false);
      dispatch(fetchRecipes({ limit: 500 }));
    } catch (err) {
      toast.error(err || 'Failed to save recipe', { style: { borderRadius: '12px' } });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteRecipe(id)).unwrap();
      setDel(null);
      toast.success('Recipe deleted.', { style: { borderRadius: '12px' } });
    } catch (err) {
      toast.error(err || 'Failed to delete', { style: { borderRadius: '12px' } });
    }
  };

  const handleToggle = async (id) => {
    try {
      const r = await dispatch(toggleRecipePublish(id)).unwrap();
      toast.success(r?.isPublished ? 'Recipe published' : 'Recipe moved to drafts');
    } catch (err) {
      toast.error(err || 'Could not change publish state');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recipes"
        description={`${total || recipes.length} recipes`}
        actions={<Button onClick={openAdd}><Plus className="size-4" /> New Recipe</Button>}
      />

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search recipes…" className="max-w-sm" />
            <div className="max-w-full overflow-x-auto">
              <Segmented
                options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))]}
                value={catFilter}
                onChange={setCatFilter}
              />
            </div>
          </Toolbar>

          {!loading && filtered.length === 0 ? (
            <EmptyState icon={CookingPot} title={recipes.length ? 'No recipes found' : 'No recipes yet'}>
              {recipes.length ? 'Try another category or clear the search.' : 'Add your first recipe to get started.'}
            </EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Recipe</th>
                      <th className="text-left">Category</th>
                      <th className="text-left">Difficulty</th>
                      <th className="text-left">Time</th>
                      <th className="text-right">Servings</th>
                      <th className="text-left">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pg.items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[4px]"
                              style={{
                                backgroundColor: '#1a5c2e',
                                backgroundImage: r.imageUrl ? `url(${r.imageUrl})` : undefined,
                                backgroundSize: 'cover', backgroundPosition: 'center',
                              }}
                            >
                              {r.videoUrl && (
                                <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"><Video className="size-2.5" /></span>
                              )}
                            </div>
                            <div className="min-w-0 max-w-md">
                              <div className="line-clamp-1 font-bold text-[color:var(--text-primary)]">{r.title}</div>
                              <div className="line-clamp-1 text-[12px] text-[color:var(--text-muted)]">{r.description}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge tone="primary">{lk.label('RecipeCategory', r.category)}</Badge></td>
                        <td><Badge tone={DIFF_TONE[r.difficulty] || 'neutral'}>{lk.label('RecipeDifficulty', r.difficulty)}</Badge></td>
                        <td>
                          <div className="flex items-center gap-2.5 whitespace-nowrap text-[12px] text-[color:var(--text-muted)]">
                            {r.prepTime && <span className="flex items-center gap-1" title="Prep time"><Clock className="size-3" />{r.prepTime}</span>}
                            {r.cookTime && <span className="flex items-center gap-1" title="Cook time"><ChefHat className="size-3" />{r.cookTime}</span>}
                            {!r.prepTime && !r.cookTime && '—'}
                          </div>
                        </td>
                        <td className="text-right">
                          {r.servings ? <span className="inline-flex items-center gap-1"><Users className="size-3 text-[color:var(--text-muted)]" />{r.servings}</span> : '—'}
                        </td>
                        <td>
                          <button type="button" onClick={() => handleToggle(r.id)} title={r.isPublished ? 'Unpublish' : 'Publish'}>
                            <Badge tone={r.isPublished ? 'accent' : 'neutral'} className="cursor-pointer hover:brightness-95">
                              <Star className="size-3" fill={r.isPublished ? 'currentColor' : 'none'} />
                              {r.isPublished ? 'Published' : 'Draft · Publish'}
                            </Badge>
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <IconButton label="Preview recipe" onClick={() => setPreview(r)}><Eye className="size-3.5" /></IconButton>
                            <IconButton label="Edit recipe" tone="primary" disabled={loadingRec} onClick={() => openEdit(r)}><Edit2 className="size-3.5" /></IconButton>
                            <IconButton label="Delete recipe" tone="danger" onClick={() => setDel(r.id)}><Trash2 className="size-3.5" /></IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pg} noun="recipes" />
            </>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <AdminModal onClose={() => setShow(false)}>
          <DialogPanel
            title={editRec ? 'Edit Recipe' : 'New Recipe'}
            onClose={() => setShow(false)}
            width="max-w-xl"
            footer={<>
              <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={uploading}>{editRec ? 'Update' : 'Save Recipe'}</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Title" required>
                <input value={form.title} onChange={upd('title')} className="input-field" placeholder="Recipe name…" />
              </Field>
              <Field label="Description">
                <textarea rows={2} value={form.description} onChange={upd('description')} className="input-field resize-none" placeholder="Short description…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select value={form.category} onChange={upd('category')} className="input-field">
                    {lookupOptions(CATEGORIES, form.category).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select value={form.difficulty} onChange={upd('difficulty')} className="input-field">
                    {lookupOptions(DIFFICULTIES, form.difficulty).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Prep Time">
                  <input value={form.prepTime} onChange={upd('prepTime')} className="input-field" placeholder="15 mins" />
                </Field>
                <Field label="Cook Time">
                  <input value={form.cookTime} onChange={upd('cookTime')} className="input-field" placeholder="30 mins" />
                </Field>
                <Field label="Servings">
                  <input type="number" min="1" value={form.servings} onChange={upd('servings')} className="input-field" />
                </Field>
              </div>
              <Field label="Ingredients (one per line)">
                <textarea rows={4} value={form.ingredients} onChange={upd('ingredients')} className="input-field resize-none font-mono text-[12px]" placeholder={"1 cup flour\n2 tsp salt\n..."} />
              </Field>
              <Field label="Steps (one per line)">
                <textarea rows={4} value={form.steps} onChange={upd('steps')} className="input-field resize-none font-mono text-[12px]" placeholder={"Mix all dry ingredients\nAdd water gradually\n..."} />
              </Field>
              <Field label="Tips">
                <textarea rows={2} value={form.tips} onChange={upd('tips')} className="input-field resize-none" placeholder="Pro tips for this recipe…" />
              </Field>

              <MediaUploader
                label="Cover Image"
                accept="image/*"
                value={form.imageUrl}
                savedValue={editRec?.imageUrl || ''}
                onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
                uploading={uploading}
                setUploading={setUploading}
                endpoint="/admin/recipes/upload"
              />

              <MediaUploader
                label="Recipe Video (optional)"
                accept="video/*"
                value={form.videoUrl}
                savedValue={editRec?.videoUrl || ''}
                onChange={(url) => setForm(f => ({ ...f, videoUrl: url }))}
                uploading={uploading}
                setUploading={setUploading}
                endpoint="/admin/recipes/upload"
              />

              <Field label="Related Masala (product slug)">
                <input value={form.relatedMasala} onChange={upd('relatedMasala')} className="input-field" placeholder="e.g. pav-bhaji-masala" />
              </Field>
              <Field label="Tags">
                <input value={form.tags} onChange={upd('tags')} className="input-field" placeholder="spicy, quick, vegetarian (comma separated)" />
              </Field>
              <Field label="Slug">
                <input value={form.slug} onChange={upd('slug')} className="input-field" placeholder="auto-generated if blank" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SEO title">
                  <input value={form.seoTitle} onChange={upd('seoTitle')} className="input-field" maxLength={70} />
                </Field>
                <Field label="SEO description">
                  <input value={form.seoDescription} onChange={upd('seoDescription')} className="input-field" maxLength={160} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-5">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
                  <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="size-4 accent-brand-green" /> Published
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="size-4 accent-brand-green" /> Featured
                </label>
              </div>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <AdminModal onClose={() => setDel(null)}>
          <DialogPanel
            title="Delete recipe?"
            onClose={() => setDel(null)}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteId)}><Trash2 className="size-3.5" /> Delete</Button>
            </>}
          >
            <p className="text-[13px] text-[color:var(--text-secondary)]">This will also delete any uploaded media.</p>
          </DialogPanel>
        </AdminModal>
      )}

      {/* Preview */}
      {preview && (
        <AdminModal onClose={() => setPreview(null)}>
          <DialogPanel title="Recipe preview" onClose={() => setPreview(null)} width="max-w-lg">
            <Badge tone={DIFF_TONE[preview.difficulty] || 'neutral'} className="mb-3">{preview.difficulty}</Badge>
            {preview.imageUrl && <img src={preview.imageUrl} alt="" className="mb-3 h-40 w-full rounded-[8px] object-cover" />}
            {preview.videoUrl && <video src={preview.videoUrl} controls className="mb-3 max-h-48 w-full rounded-[8px]" />}
            <h2 className="mb-2 text-[18px] font-bold text-[color:var(--text-primary)]">{preview.title}</h2>
            <p className="mb-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{preview.description}</p>
            <div className="flex gap-4 text-[12px] text-[color:var(--text-muted)]">
              {preview.prepTime && <span>Prep: {preview.prepTime}</span>}
              {preview.cookTime && <span>Cook: {preview.cookTime}</span>}
              <span>{preview.servings} servings</span>
              <span className="ml-auto">{lk.label('RecipeCategory', preview.category)}</span>
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
