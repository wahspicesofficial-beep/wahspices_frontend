import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, FolderTree, Info } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchAdminCategories, createCategory, updateCategory,
  deleteCategory, reorderCategories,
} from '@/store/slices/adminSlice';
import { fetchCategories } from '@/store/slices/productSlice';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import { PageHeader, Card, Badge, Button, IconButton, EmptyState, DialogPanel, Field } from '@/admin/ui';

const emptyForm = { name: '', slug: '', icon: '', description: '', displayOrder: 0, isActive: true, parentId: '' };

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminCategories() {
  const dispatch = useAppDispatch();
  const { items } = useAppSelector((s) => s.admin.categories);
  const loading = useAppSelector((s) => s.admin.loading);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState('');

  useEffect(() => {
    dispatch(fetchAdminCategories());
  }, [dispatch]);

  // Show main categories followed by their sub-categories (one level deep)
  const byOrder = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0);
  const mains = items.filter((c) => !c.parentId).sort(byOrder);
  const ordered = [
    ...mains.flatMap((m) => [m, ...items.filter((c) => c.parentId === m.id).sort(byOrder)]),
    ...items.filter((c) => c.parentId && !mains.some((m) => m.id === c.parentId)), // orphans
  ];
  const parentName = (id) => items.find((c) => c.id === id)?.name;
  const hasChildren = (id) => items.some((c) => c.parentId === id);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm, displayOrder: items.length + 1 });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditItem(cat);
    setForm({
      name: cat.name, slug: cat.slug, icon: cat.icon || '',
      description: cat.description || '', displayOrder: cat.displayOrder, isActive: cat.isActive,
      parentId: cat.parentId ?? '',
    });
    setShowModal(true);
  };

  const handleNameChange = (val) => {
    setForm((f) => ({
      ...f,
      name: val,
      slug: editItem ? f.slug : slugify(val),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('Slug is required');
      return;
    }

    const payload = { ...form, parentId: form.parentId === '' ? null : Number(form.parentId) };
    if (editItem) {
      const res = await dispatch(updateCategory({ id: editItem.id, ...payload }));
      if (updateCategory.fulfilled.match(res)) {
        toast.success('Category updated!', { icon: '✅' });
        dispatch(fetchCategories()); // refresh public categories in header
      } else {
        toast.error(res.payload || 'Update failed');
        return;
      }
    } else {
      const res = await dispatch(createCategory(payload));
      if (createCategory.fulfilled.match(res)) {
        toast.success('Category created!', { icon: '🎉' });
        dispatch(fetchCategories());
      } else {
        toast.error(res.payload || 'Create failed');
        return;
      }
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    const res = await dispatch(deleteCategory(deleteId));
    if (deleteCategory.fulfilled.match(res)) {
      toast.success('Category deleted', { icon: '🗑️' });
      dispatch(fetchCategories());
    } else {
      toast.error(res.payload || 'Could not delete category');
    }
    setDeleteId(null);
    setDeleteName('');
  };

  const handleToggleActive = async (cat) => {
    const res = await dispatch(updateCategory({
      id: cat.id, name: cat.name, icon: cat.icon, description: cat.description,
      displayOrder: cat.displayOrder, isActive: !cat.isActive, parentId: cat.parentId ?? null,
    }));
    if (updateCategory.fulfilled.match(res)) {
      toast.success(cat.isActive ? 'Category hidden' : 'Category shown');
      dispatch(fetchCategories());
    } else {
      toast.error(res.payload || 'Could not change visibility');
    }
  };

  const siblingsOf = (cat) => items.filter((c) => (c.parentId ?? null) === (cat.parentId ?? null)).sort(byOrder);
  const move = async (cat, dir) => {
    const sibs = siblingsOf(cat);
    const i = sibs.findIndex((c) => c.id === cat.id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    const res = await dispatch(reorderCategories(sibs.map((c, k) => ({ id: c.id, displayOrder: k + 1 }))));
    await dispatch(fetchAdminCategories());
    if (!reorderCategories.fulfilled.match(res)) { toast.error(res.payload || 'Could not reorder'); return; }
    toast.success('Order updated');
    dispatch(fetchCategories());
  };
  const handleMoveUp = (cat) => move(cat, -1);
  const handleMoveDown = (cat) => move(cat, 1);
  const isFirst = (cat) => siblingsOf(cat)[0]?.id === cat.id;
  const isLast = (cat) => siblingsOf(cat).at(-1)?.id === cat.id;

  const closeDelete = () => { setDeleteId(null); setDeleteName(''); };
  const muted = 'font-normal text-[color:var(--text-muted)]';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Product Categories"
        description={<>{items.length} categories · shown in header &amp; product filters</>}
        actions={<Button onClick={openAdd}><Plus className="size-4" /> Add Category</Button>}
      />

      {/* Category list */}
      <Card bodyClassName="p-3">
        {items.length === 0 && !loading ? (
          <EmptyState icon={FolderTree} title="No categories yet">Add your first category!</EmptyState>
        ) : (
          <div className="grid-box">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Order</th>
                  <th className="w-14 text-center">Icon</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Slug</th>
                  <th className="text-left">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((cat) => (
                  <tr key={cat.id} className={!cat.isActive ? 'opacity-50' : ''}>
                    {/* Order controls */}
                    <td>
                      <div className="flex items-center gap-1">
                        <GripVertical className="size-4 text-[color:var(--text-muted)] opacity-50" />
                        <div className="flex flex-col">
                          <button type="button" aria-label="Move up" onClick={() => handleMoveUp(cat)} disabled={isFirst(cat)}
                            className="rounded-[3px] text-[color:var(--text-muted)] hover:text-[color:var(--primary)] disabled:opacity-20">
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button type="button" aria-label="Move down" onClick={() => handleMoveDown(cat)} disabled={isLast(cat)}
                            className="rounded-[3px] text-[color:var(--text-muted)] hover:text-[color:var(--primary)] disabled:opacity-20">
                            <ChevronDown className="size-3.5" />
                          </button>
                        </div>
                        <span className="ml-1 text-[12px] tabular-nums text-[color:var(--text-muted)]">{cat.displayOrder}</span>
                      </div>
                    </td>
                    {/* Icon */}
                    <td className="text-center text-[20px]">{cat.icon || '📦'}</td>
                    {/* Name & Description */}
                    <td>
                      <div className={`flex items-center font-bold text-[color:var(--text-primary)] ${cat.parentId ? 'relative pl-5' : ''}`}>
                        {cat.parentId && <span className="absolute left-0 text-[color:var(--text-muted)]">↳</span>}
                        {cat.name}
                        {cat.parentId
                          ? <Badge tone="accent" className="ml-2 !text-[11px]">Sub of {parentName(cat.parentId)}</Badge>
                          : hasChildren(cat.id) && <Badge tone="primary" className="ml-2 !text-[11px]">Main</Badge>}
                      </div>
                      {cat.description && (
                        <div className={`max-w-48 truncate text-[12px] text-[color:var(--text-muted)] ${cat.parentId ? 'pl-5' : ''}`}>{cat.description}</div>
                      )}
                    </td>
                    {/* Slug */}
                    <td>
                      <code className="rounded-[4px] bg-[color:var(--surface-secondary)] px-1.5 py-0.5 font-mono text-[12px] text-[color:var(--text-secondary)]">{cat.slug}</code>
                    </td>
                    {/* Status */}
                    <td>
                      <button type="button" onClick={() => handleToggleActive(cat)} title="Toggle visibility">
                        <Badge tone={cat.isActive ? 'success' : 'neutral'} className="cursor-pointer hover:brightness-95">
                          {cat.isActive ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                          {cat.isActive ? 'Visible' : 'Hidden'}
                        </Badge>
                      </button>
                    </td>
                    {/* Actions */}
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <IconButton label="Edit category" tone="primary" onClick={() => openEdit(cat)}><Edit2 className="size-3.5" /></IconButton>
                        <IconButton label="Delete category" tone="danger" onClick={() => { setDeleteId(cat.id); setDeleteName(cat.name); }}><Trash2 className="size-3.5" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-[8px] border border-[rgba(26,92,46,0.2)] bg-[color:var(--primary-soft)] px-3 py-2.5 text-[13px] text-[color:var(--primary)]">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <p><strong>Tip:</strong> Categories shown here appear in the website header dropdown and the Products page filter. Hide a category to remove it from the frontend without deleting it.</p>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <AdminModal onClose={() => setShowModal(false)}>
          <DialogPanel
            title={editItem ? 'Edit Category' : 'Add New Category'}
            onClose={() => setShowModal(false)}
            width="max-w-md"
            footer={<>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading}>{editItem ? 'Update' : 'Create'}</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Category Name" required>
                <input
                  type="text" value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Blend Masala"
                  className="input-field"
                />
              </Field>

              <Field
                label={<>Slug <span className="text-[color:var(--danger)]">*</span> <span className={muted}>(used in URL)</span></>}
                hint={editItem ? 'Slug cannot be changed after creation (it would break product links).' : undefined}
              >
                <input
                  type="text" value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="e.g. blend-masala"
                  className="input-field font-mono text-[13px]"
                  disabled={!!editItem}
                />
              </Field>

              <Field
                label={<>Parent Category <span className={muted}>leave empty for a main category</span></>}
                hint={editItem && hasChildren(editItem.id) ? 'This category has sub-categories, so it must stay a main category.' : undefined}
              >
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="input-field"
                  disabled={!!editItem && hasChildren(editItem.id)}
                >
                  <option value="">— None (main category) —</option>
                  {mains.filter((m) => m.id !== editItem?.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </Field>

              <Field label={<>Icon (emoji) <span className={muted}>optional</span></>}>
                <div className="flex items-center gap-3">
                  <span className="text-[26px] leading-none">{form.icon || '📦'}</span>
                  <input
                    type="text" value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    placeholder="🌶️"
                    className="input-field flex-1"
                    maxLength={4}
                  />
                </div>
              </Field>

              <Field label={<>Description <span className={muted}>optional</span></>}>
                <input
                  type="text" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of this category"
                  className="input-field"
                />
              </Field>

              <Field label="Display Order">
                <input
                  type="number" value={form.displayOrder} min={0}
                  onChange={(e) => setForm((f) => ({ ...f, displayOrder: +e.target.value }))}
                  className="input-field"
                />
              </Field>

              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="size-4 accent-brand-green" />
                <span className="text-[13px] text-[color:var(--text-secondary)]">Visible on website</span>
              </label>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <AdminModal onClose={closeDelete}>
          <DialogPanel
            title={`Delete "${deleteName}"?`}
            onClose={closeDelete}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={closeDelete}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}><Trash2 className="size-3.5" /> Delete</Button>
            </>}
          >
            <p className="text-[13px] text-[color:var(--text-secondary)]">This will fail if any products are still using this category.</p>
          </DialogPanel>
        </AdminModal>
      )}
    </div>
  );
}
