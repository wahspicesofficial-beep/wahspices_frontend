import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, Package, FolderTree, Boxes, BarChart3 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchAdminProducts, deleteProduct,
  fetchAdminCategories, createCategory, updateCategory, deleteCategory,
  fetchPackTypes, createPackType, updatePackType, deletePackType,
} from '@/store/slices/adminSlice';
import toast from 'react-hot-toast';
import AdminModal from '@/admin/components/AdminModal';
import ProductEditor, { packLabel } from '@/admin/components/ProductEditor';
import ProductSalesPanel from '@/admin/components/ProductSalesPanel';
import { getThumbUrl } from '@/utils/product';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import {
  PageHeader, Card, Badge, Button, IconButton, Tabs, Segmented, SearchInput, Toolbar,
  EmptyState, Skeleton, DialogPanel, Field, usePagination, Pagination,
} from '@/admin/ui';

const EMPTY_CAT  = { name: '', slug: '', icon: '' };
const EMPTY_PT   = { name: '' };

/* Small confirm dialog used for the three delete prompts */
function ConfirmDelete({ title, message, onCancel, onConfirm }) {
  return (
    <AdminModal onClose={onCancel}>
      <DialogPanel
        title={title}
        onClose={onCancel}
        width="max-w-sm"
        footer={<>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}><Trash2 className="size-3.5" /> Delete</Button>
        </>}
      >
        <p className="text-[13px] text-[color:var(--text-secondary)]">{message}</p>
      </DialogPanel>
    </AdminModal>
  );
}

export default function AdminProducts() {
  const dispatch       = useAppDispatch();
  const { items, packTypes, total } = useAppSelector((s) => s.admin.products);
  const adminCategories = useAppSelector((s) => s.admin.categories.items);
  const loading        = useAppSelector((s) => s.admin.loading);

  const [tab, setTab]             = useState('products');
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [salesItem, setSalesItem] = useState(null);   // product whose website sales are shown

  // Category modal
  const [catModal, setCatModal]   = useState(false);
  const [editCat, setEditCat]     = useState(null);
  const [catForm, setCatForm]     = useState(EMPTY_CAT);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState(null);

  // Pack Type modal
  const [ptModal, setPtModal]   = useState(false);
  const [editPt, setEditPt]     = useState(null);
  const [ptForm, setPtForm]     = useState(EMPTY_PT);
  const [savingPt, setSavingPt] = useState(false);
  const [deletePtId, setDeletePtId] = useState(null);

  const loadProducts = () => dispatch(fetchAdminProducts({ limit: 500 }));

  useEffect(() => {
    loadProducts();
    if (adminCategories.length === 0) dispatch(fetchAdminCategories());
    if (packTypes.length === 0) dispatch(fetchPackTypes());
  }, [dispatch]);

  const catName = (slug) => adminCategories.find((c) => c.slug === slug)?.name || slug;
  const mainCats = adminCategories.filter((c) => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const filtered = useMemo(() => items.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = (p.name || '').toLowerCase().includes(q) || (p.slug || '').includes(q);
    const matchCat    = catFilter === 'all' || p.category === catFilter || p.subCategory === catFilter;
    return matchSearch && matchCat;
  }), [items, search, catFilter]);

  const pg = usePagination(filtered, 20);

  const openAdd = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (product) => { setEditItem(product); setShowModal(true); };
  const handleSaved = () => loadProducts();

  const handleDeleteProduct = async (id) => {
    const res = await dispatch(deleteProduct(id));
    if (deleteProduct.fulfilled.match(res)) toast.success('Product deleted.', { style: { borderRadius: '12px' } });
    else toast.error(res.payload || 'Failed to delete product');
    setDeleteId(null);
  };

  // ── Category handlers ──
  const openAddCat  = () => { setEditCat(null); setCatForm(EMPTY_CAT); setCatModal(true); };
  const openEditCat = (c)  => { setEditCat(c); setCatForm({ name: c.name, slug: c.slug, icon: c.icon || '' }); setCatModal(true); };
  // Send the full record so description / order / parent aren't wiped by a partial update
  const fullCat = (c) => ({ description: c.description, displayOrder: c.displayOrder, isActive: c.isActive, parentId: c.parentId ?? null });

  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Category name is required'); return; }
    const slug = catForm.slug.trim() || catForm.name.trim().toLowerCase().replace(/\s+/g, '-');
    setSavingCat(true);
    try {
      if (editCat) {
        await dispatch(updateCategory({ id: editCat.id, ...fullCat(editCat), name: catForm.name.trim(), slug, icon: catForm.icon })).unwrap();
        toast.success('Category updated!', { style: { borderRadius: '12px' } });
      } else {
        await dispatch(createCategory({ name: catForm.name.trim(), slug, icon: catForm.icon })).unwrap();
        toast.success('Category added!', { style: { borderRadius: '12px' } });
      }
      setCatModal(false);
    } catch (err) { toast.error(err || 'Failed to save category', { style: { borderRadius: '12px' } }); }
    finally { setSavingCat(false); }
  };

  const handleDeleteCat = async (id) => {
    const res = await dispatch(deleteCategory(id));
    if (deleteCategory.fulfilled.match(res)) toast.success('Category deleted', { style: { borderRadius: '12px' } });
    else toast.error(res.payload || 'Failed to delete category', { style: { borderRadius: '12px' } });
    setDeleteCatId(null);
  };

  // ── Pack Type handlers ──
  const openAddPt  = () => { setEditPt(null); setPtForm(EMPTY_PT); setPtModal(true); };
  const openEditPt = (pt) => { setEditPt(pt); setPtForm({ name: pt.name }); setPtModal(true); };

  const savePt = async () => {
    if (!ptForm.name.trim()) { toast.error('Pack type name is required'); return; }
    setSavingPt(true);
    try {
      if (editPt) {
        await dispatch(updatePackType({ id: editPt.id, name: ptForm.name.trim() })).unwrap();
        loadProducts(); // products follow a renamed pack type
        toast.success('Pack type updated!', { style: { borderRadius: '12px' } });
      } else {
        await dispatch(createPackType({ name: ptForm.name.trim() })).unwrap();
        toast.success('Pack type added!', { style: { borderRadius: '12px' } });
      }
      setPtModal(false);
    } catch (err) { toast.error(err || 'Failed to save pack type', { style: { borderRadius: '12px' } }); }
    finally { setSavingPt(false); }
  };

  const handleDeletePt = async (id) => {
    const res = await dispatch(deletePackType(id));
    if (deletePackType.fulfilled.match(res)) toast.success('Pack type deleted', { style: { borderRadius: '12px' } });
    else toast.error(res.payload || 'Failed to delete pack type', { style: { borderRadius: '12px' } });
    setDeletePtId(null);
  };

  if (loading && items.length === 0 && tab === 'products') return <div className="space-y-6"><SkPageHeader /><SkTabs tabCount={3} contentRows={6} /></div>;

  const catOptions = [
    { value: 'all', label: `All (${items.length})` },
    ...mainCats.map((c) => ({ value: c.slug, label: `${catName(c.slug)} (${items.filter((p) => p.category === c.slug).length})` })),
  ];

  const skeletonRows = (rows, cols) => Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => <td key={j}><Skeleton className="h-3 w-3/4" /></td>)}
    </tr>
  ));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description={`${total || items.length} total products`}
        actions={<>
          {tab === 'products'   && <Button onClick={openAdd}><Plus className="size-4" /> Add Product</Button>}
          {tab === 'categories' && <Button onClick={openAddCat}><Plus className="size-4" /> Add Category</Button>}
          {tab === 'packtypes'  && <Button onClick={openAddPt}><Plus className="size-4" /> Add Pack Type</Button>}
        </>}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'products', label: 'Products', icon: Package, count: items.length },
          { value: 'categories', label: 'Categories', icon: FolderTree, count: adminCategories.length },
          { value: 'packtypes', label: 'Pack Types', icon: Boxes, count: packTypes.length },
        ]}
      />

      {/* ── Tab: Products ─────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <Card>
          <div className="space-y-3 p-3">
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search products…" className="max-w-sm" />
              <div className="max-w-full overflow-x-auto">
                <Segmented options={catOptions} value={catFilter} onChange={setCatFilter} />
              </div>
            </Toolbar>

            {loading && items.length === 0 ? (
              <div className="grid-box">
                <table><tbody>{skeletonRows(6, 8)}</tbody></table>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Package} title={items.length ? 'No products found' : 'No products yet'}>
                {items.length ? 'Try another category or clear the search.' : 'Add your first product to get started.'}
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Product</th>
                        <th className="text-left">Category</th>
                        <th className="text-left">Pack Type</th>
                        <th className="text-left">Sizes</th>
                        <th className="text-right">Price</th>
                        <th className="text-left">Stock</th>
                        <th className="text-left">Badge</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pg.items.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              {p.imageUrl
                                ? <img src={getThumbUrl(p.imageUrl)} alt="" loading="lazy" className="h-10 w-8 shrink-0 rounded-[4px] bg-[color:var(--surface-secondary)] object-cover" />
                                : <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-black text-white" style={{ backgroundColor: p.bgColor || '#1a5c2e' }}>W!</div>}
                              <div className="min-w-0">
                                <div className="font-bold text-[color:var(--text-primary)]">{p.name}</div>
                                <div className="text-[11px] text-[color:var(--text-muted)]">{p.hsnCode ? `HSN ${p.hsnCode} · GST ${p.gstRate}%` : p.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge tone="primary">{catName(p.category) || '—'}</Badge>
                            {p.subCategory && <div className="mt-1 whitespace-nowrap text-[11px] text-[color:var(--accent-strong)]">↳ {catName(p.subCategory)}</div>}
                          </td>
                          <td className="whitespace-nowrap text-[color:var(--text-muted)]">{packLabel(p.packType)}</td>
                          <td>
                            <div className="flex max-w-[180px] flex-wrap gap-1">
                              {(p.variants?.length ? p.variants : [{ id: 0, weight: p.weight, inStock: true }]).map((v) => (
                                <span
                                  key={v.id}
                                  className={`rounded-[4px] border px-1.5 py-px text-[11px] ${v.inStock
                                    ? 'border-[color:var(--border)] text-[color:var(--text-secondary)]'
                                    : 'border-[rgba(176,56,47,0.25)] text-[color:var(--danger)] line-through opacity-60'}`}
                                >
                                  {v.weight}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-right">
                            {p.variants?.length > 1
                              ? <span className="font-bold text-[color:var(--primary)]">₹{Math.min(...p.variants.map((v) => v.price))} – ₹{Math.max(...p.variants.map((v) => v.price))}</span>
                              : <>
                                  <span className="font-bold text-[color:var(--primary)]">₹{p.price}</span>
                                  {p.mrp > p.price && <span className="ml-1 text-[11px] text-[color:var(--text-muted)] line-through">₹{p.mrp}</span>}
                                </>}
                          </td>
                          <td>
                            <Badge tone={p.inStock !== false ? 'success' : 'danger'}>
                              {p.inStock !== false ? <Check className="size-3" /> : <X className="size-3" />}
                              {p.inStock !== false ? 'In Stock' : 'Out'}
                            </Badge>
                          </td>
                          <td>
                            {p.badge ? <Badge tone="accent">{p.badge}</Badge> : <span className="text-[color:var(--text-muted)]">—</span>}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-1">
                              <IconButton label="Sales (who ordered it)" tone="primary" onClick={() => setSalesItem(p)}><BarChart3 className="size-3.5" /></IconButton>
                              <IconButton label="Edit product" tone="primary" onClick={() => openEdit(p)}><Edit2 className="size-3.5" /></IconButton>
                              <IconButton label="Delete product" tone="danger" onClick={() => setDeleteId(p.id)}><Trash2 className="size-3.5" /></IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...pg} noun="products" />
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Tab: Categories ───────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <Card bodyClassName="p-3">
          {!loading && adminCategories.length === 0 ? (
            <EmptyState icon={FolderTree} title="No categories yet" />
          ) : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="w-14 text-center">Icon</th>
                    <th className="text-left">Name</th>
                    <th className="text-left">Slug</th>
                    <th className="text-left">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && adminCategories.length === 0 ? skeletonRows(4, 5) : adminCategories.map((cat) => (
                    <tr key={cat.id}>
                      <td className="text-center text-[20px]">{cat.icon || '📦'}</td>
                      <td className="font-bold text-[color:var(--text-primary)]">{cat.name}</td>
                      <td className="font-mono text-[12px] text-[color:var(--text-muted)]">{cat.slug}</td>
                      <td>
                        <Badge tone={cat.isActive !== false ? 'success' : 'neutral'}>{cat.isActive !== false ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <IconButton label="Edit category" tone="primary" onClick={() => openEditCat(cat)}><Edit2 className="size-3.5" /></IconButton>
                          <IconButton label="Delete category" tone="danger" onClick={() => setDeleteCatId(cat.id)}><Trash2 className="size-3.5" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Pack Types ───────────────────────────────────────────────── */}
      {tab === 'packtypes' && (
        <Card bodyClassName="p-3">
          {!loading && packTypes.length === 0 ? (
            <EmptyState icon={Boxes} title="No pack types yet" />
          ) : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Pack Type Name</th>
                    <th className="text-left">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && packTypes.length === 0 ? skeletonRows(3, 3) : packTypes.map((pt) => (
                    <tr key={pt.id}>
                      <td className="font-bold text-[color:var(--text-primary)]">{pt.name}</td>
                      <td>
                        <Badge tone={pt.isActive ? 'success' : 'neutral'}>{pt.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <IconButton label="Edit pack type" tone="primary" onClick={() => openEditPt(pt)}><Edit2 className="size-3.5" /></IconButton>
                          <IconButton label="Delete pack type" tone="danger" onClick={() => setDeletePtId(pt.id)}><Trash2 className="size-3.5" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Add/Edit Product Modal ────────────────────────────────────────── */}
      {showModal && (
        <ProductEditor
          product={editItem}
          categories={adminCategories}
          packTypes={packTypes}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Delete Product Confirm ────────────────────────────────────────── */}
      {deleteId && (
        <ConfirmDelete
          title="Delete product?"
          message="This action cannot be undone."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => handleDeleteProduct(deleteId)}
        />
      )}

      {/* ── Add/Edit Category Modal ───────────────────────────────────────── */}
      {catModal && (
        <AdminModal onClose={() => setCatModal(false)}>
          <DialogPanel
            title={editCat ? 'Edit Category' : 'Add Category'}
            onClose={() => setCatModal(false)}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setCatModal(false)}>Cancel</Button>
              <Button onClick={saveCat} loading={savingCat}>{savingCat ? 'Saving…' : editCat ? 'Update' : 'Add Category'}</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Category Name" required>
                <input value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} className="input-field" placeholder="e.g. Blend Masala" />
              </Field>
              <Field label="Slug" hint={editCat ? 'Slug cannot be changed after creation (it would break product links).' : 'Used in URLs, e.g. blend-masala'}>
                <input value={catForm.slug} onChange={(e) => setCatForm((p) => ({ ...p, slug: e.target.value }))} className="input-field" placeholder="auto-generated if blank" disabled={!!editCat} />
              </Field>
              <Field label="Icon (emoji)">
                <input value={catForm.icon} onChange={(e) => setCatForm((p) => ({ ...p, icon: e.target.value }))} className="input-field" placeholder="e.g. 🌶️" />
              </Field>
            </div>
          </DialogPanel>
        </AdminModal>
      )}

      {/* ── Delete Category Confirm ───────────────────────────────────────── */}
      {deleteCatId && (
        <ConfirmDelete
          title="Delete category?"
          message="Only empty categories can be deleted. Move or remove its products and sub-categories first."
          onCancel={() => setDeleteCatId(null)}
          onConfirm={() => handleDeleteCat(deleteCatId)}
        />
      )}

      {/* ── Add/Edit Pack Type Modal ──────────────────────────────────────── */}
      {ptModal && (
        <AdminModal onClose={() => setPtModal(false)}>
          <DialogPanel
            title={editPt ? 'Edit Pack Type' : 'Add Pack Type'}
            onClose={() => setPtModal(false)}
            width="max-w-sm"
            footer={<>
              <Button variant="secondary" onClick={() => setPtModal(false)}>Cancel</Button>
              <Button onClick={savePt} loading={savingPt}>{savingPt ? 'Saving…' : editPt ? 'Update' : 'Add Pack Type'}</Button>
            </>}
          >
            <Field label="Pack Type Name" required>
              <input value={ptForm.name} onChange={(e) => setPtForm({ name: e.target.value })} className="input-field" placeholder="e.g. Tin Pack" />
            </Field>
          </DialogPanel>
        </AdminModal>
      )}

      {/* ── Delete Pack Type Confirm ──────────────────────────────────────── */}
      {deletePtId && (
        <ConfirmDelete
          title="Delete pack type?"
          message="A pack type that products still use cannot be deleted; mark it inactive or change those products first."
          onCancel={() => setDeletePtId(null)}
          onConfirm={() => handleDeletePt(deletePtId)}
        />
      )}

      {salesItem && <ProductSalesPanel product={salesItem} onClose={() => setSalesItem(null)} />}
    </div>
  );
}
