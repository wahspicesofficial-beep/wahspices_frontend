import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Eye, Video, Image as ImageIcon, Loader2, FileText, Star } from 'lucide-react';
import { SkPageHeader, SkTable } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, togglePublish,
} from '@/store/slices/adminSlice';
import AdminModal from '@/admin/components/AdminModal';
import api from '@/services/api';
import {
  PageHeader, Card, Badge, Button, IconButton, EmptyState, DialogPanel, Field, usePagination, Pagination,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

const EMPTY = {
  title: '', slug: '', category: '', authorName: '', excerpt: '',
  content: '', imageUrl: '', videoUrl: '', readTime: '5 min read', tags: '',
  featured: false, isPublished: true, seoTitle: '', seoDescription: '',
};

/** Tags are stored as a JSON array string; show them comma separated */
const tagsText = (t) => {
  if (Array.isArray(t)) return t.join(', ');
  try { const a = JSON.parse(t || '[]'); return Array.isArray(a) ? a.join(', ') : String(t || ''); }
  catch { return String(t || ''); }
};

const CAT_TONE = { Recipe: 'accent', Health: 'success', Knowledge: 'info', Other: 'neutral' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

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

export default function AdminBlog() {
  const dispatch = useAppDispatch();
  const { items: posts, total } = useAppSelector((s) => s.admin.blog);
  const loading = useAppSelector((s) => s.admin.loading);

  const [showModal, setShow]   = useState(false);
  const [editPost, setEdit]    = useState(null);
  const [form, setForm]        = useState(EMPTY);
  const [deleteId, setDel]     = useState(null);
  const [preview, setPreview]  = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]    = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const lk = useLookups();
  const blogCats = lk.list('BlogCategory');

  useEffect(() => { dispatch(fetchBlogPosts({ limit: 500 })); }, [dispatch]);
  const pg = usePagination(posts, 20);

  if (loading && !posts.length) return (
    <div className="space-y-6"><SkPageHeader /><SkTable rows={7} cols={5} /></div>
  );

  const upd = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const openAdd = () => { setEdit(null); setForm({ ...EMPTY, category: blogCats[0]?.value || '' }); setShow(true); };
  const openEdit = async (p) => {
    // The list omits content/SEO fields, so load the full post before editing
    setLoadingPost(true);
    try {
      const res = await api.get(`/admin/blog/${p.id}`);
      const d = res.data.data;
      setEdit(d);
      setForm({
        title: d.title || '', slug: d.slug || '', category: d.category || '',
        authorName: d.author || '', excerpt: d.excerpt || '',
        content: d.content || '', imageUrl: d.imageUrl || '', videoUrl: d.videoUrl || '',
        readTime: d.readTime || '', tags: tagsText(d.tags),
        featured: !!d.featured, isPublished: !!d.isPublished,
        seoTitle: d.seoTitle || '', seoDescription: d.seoDescription || '',
      });
      setShow(true);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not load the post');
    } finally {
      setLoadingPost(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.excerpt.trim()) {
      toast.error('Title and Excerpt are required.', { style: { borderRadius: '12px' } });
      return;
    }
    if (!form.category) { toast.error('Choose a category'); return; }
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const payload = {
      title: form.title.trim(), slug: form.slug.trim() || null, category: form.category,
      author: form.authorName.trim() || null, excerpt: form.excerpt.trim(), content: form.content,
      imageUrl: form.imageUrl || null, videoUrl: form.videoUrl || null,
      readTime: form.readTime || null,
      tags: tags.length ? JSON.stringify(tags) : null,
      featured: form.featured, isPublished: form.isPublished,
      seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null,
    };
    setSaving(true);
    try {
      if (editPost) {
        await dispatch(updateBlogPost({ id: editPost.id, ...payload })).unwrap();
        toast.success('Post updated!', { style: { borderRadius: '12px' } });
      } else {
        await dispatch(createBlogPost(payload)).unwrap();
        toast.success(form.isPublished ? 'Post published!' : 'Draft saved', { style: { borderRadius: '12px' } });
      }
      setShow(false);
      dispatch(fetchBlogPosts({ limit: 500 }));
    } catch (err) {
      toast.error(err || 'Failed to save post', { style: { borderRadius: '12px' } });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteBlogPost(id)).unwrap();
      setDel(null);
      toast.success('Post deleted.', { style: { borderRadius: '12px' } });
    } catch (err) {
      toast.error(err || 'Failed to delete', { style: { borderRadius: '12px' } });
    }
  };

  const handleTogglePublish = async (id) => {
    try {
      const r = await dispatch(togglePublish(id)).unwrap();
      toast.success(r?.isPublished ? 'Post published' : 'Post moved to drafts');
    } catch (err) {
      toast.error(err || 'Could not change publish state');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog Posts"
        description={`${total || posts.length} articles`}
        actions={<Button onClick={openAdd}><Plus className="size-4" /> New Post</Button>}
      />

      <Card bodyClassName="p-3">
        {!loading && posts.length === 0 ? (
          <EmptyState icon={FileText} title="No blog posts yet" action={<Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> New Post</Button>} />
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Post</th>
                    <th className="text-left">Category</th>
                    <th className="text-left">Author</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[4px]"
                            style={{
                              backgroundColor: post.bgColor || '#1a5c2e',
                              backgroundImage: post.imageUrl ? `url(${post.imageUrl})` : undefined,
                              backgroundSize: 'cover', backgroundPosition: 'center',
                            }}
                          >
                            {post.videoUrl && (
                              <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"><Video className="size-2.5" /></span>
                            )}
                          </div>
                          <div className="min-w-0 max-w-md">
                            <div className="line-clamp-1 font-bold text-[color:var(--text-primary)]">{post.title}</div>
                            <div className="line-clamp-1 text-[12px] text-[color:var(--text-muted)]">{post.excerpt}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone={CAT_TONE[post.category] || 'neutral'}>{lk.label('BlogCategory', post.category)}</Badge></td>
                      <td className="whitespace-nowrap">{post.authorName || post.author || '—'}</td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDate(post.publishedAt || post.createdAt)}</td>
                      <td>
                        <button type="button" onClick={() => handleTogglePublish(post.id)} title={post.isPublished ? 'Unpublish' : 'Publish'}>
                          <Badge tone={post.isPublished ? 'accent' : 'neutral'} className="cursor-pointer hover:brightness-95">
                            <Star className="size-3" fill={post.isPublished ? 'currentColor' : 'none'} />
                            {post.isPublished ? 'Published' : 'Publish'}
                          </Badge>
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <IconButton label="Preview post" onClick={() => setPreview(post)}><Eye className="size-3.5" /></IconButton>
                          <IconButton label="Edit post" tone="primary" disabled={loadingPost} onClick={() => openEdit(post)}><Edit2 className="size-3.5" /></IconButton>
                          <IconButton label="Delete post" tone="danger" onClick={() => setDel(post.id)}><Trash2 className="size-3.5" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="posts" />
          </>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <AdminModal onClose={() => setShow(false)}>
          <DialogPanel
            title={editPost ? 'Edit Post' : 'New Blog Post'}
            onClose={() => setShow(false)}
            width="max-w-xl"
            footer={<>
              <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={uploading}>{editPost ? 'Update' : form.isPublished ? 'Publish' : 'Save draft'}</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Title" required>
                <input value={form.title} onChange={upd('title')} className="input-field" placeholder="Enter post title…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select value={form.category} onChange={upd('category')} className="input-field">
                    <option value="" disabled>Choose…</option>
                    {lookupOptions(blogCats, form.category).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Read Time">
                  <input value={form.readTime} onChange={upd('readTime')} className="input-field" placeholder="5 min read" />
                </Field>
              </div>
              <Field label="Author Name">
                <input value={form.authorName} onChange={upd('authorName')} className="input-field" placeholder="Author name" />
              </Field>
              <Field label="Excerpt" required>
                <textarea rows={2} value={form.excerpt} onChange={upd('excerpt')} className="input-field resize-none" placeholder="Short description…" />
              </Field>
              <Field label="Content">
                <textarea rows={4} value={form.content} onChange={upd('content')} className="input-field resize-none" placeholder="Full article content…" />
              </Field>

              {/* Image Upload */}
              <MediaUploader
                label="Cover Image"
                accept="image/*"
                value={form.imageUrl}
                savedValue={editPost?.imageUrl || ''}
                onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
                uploading={uploading}
                setUploading={setUploading}
                endpoint="/admin/blog/upload"
              />

              {/* Video Upload */}
              <MediaUploader
                label="Video (optional)"
                accept="video/*"
                value={form.videoUrl}
                savedValue={editPost?.videoUrl || ''}
                onChange={(url) => setForm(f => ({ ...f, videoUrl: url }))}
                uploading={uploading}
                setUploading={setUploading}
                endpoint="/admin/blog/upload"
              />

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
            title="Delete post?"
            onClose={() => setDel(null)}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteId)}><Trash2 className="size-3.5" /> Delete</Button>
            </>}
          >
            <p className="text-[13px] text-[color:var(--text-secondary)]">This permanently deletes the post and its uploaded image/video.</p>
          </DialogPanel>
        </AdminModal>
      )}

      {/* Preview */}
      {preview && (
        <AdminModal onClose={() => setPreview(null)}>
          <DialogPanel title="Post preview" onClose={() => setPreview(null)} width="max-w-lg">
            <Badge tone={CAT_TONE[preview.category] || 'neutral'} className="mb-3">{preview.category}</Badge>
            {preview.imageUrl && <img src={preview.imageUrl} alt="" className="mb-3 h-40 w-full rounded-[8px] object-cover" />}
            {preview.videoUrl && <video src={preview.videoUrl} controls className="mb-3 max-h-48 w-full rounded-[8px]" />}
            <h2 className="mb-2 text-[18px] font-bold text-[color:var(--text-primary)]">{preview.title}</h2>
            <p className="mb-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{preview.excerpt}</p>
            <div className="text-[12px] text-[color:var(--text-muted)]">
              By {preview.authorName || preview.author} · {preview.readTime}
              {(preview.publishedAt || preview.createdAt) && ` · ${fmtDate(preview.publishedAt || preview.createdAt)}`}
            </div>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
