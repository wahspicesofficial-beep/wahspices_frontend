import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SkPageHeader, SkTable } from '@/components/ui/Skeleton';
import {
  fetchProductionOrders, createProductionOrder, updateProductionOrderStatus, deleteProductionOrder,
  fetchBom, createBom, updateBom, deleteBom,
  fetchBatches, createBatch,
  fetchQualityChecks, createQualityCheck,
  fetchWastage, createWastage,
  fetchProductionReports, fetchProductionProducts, fetchProductionInventory,
} from '@/store/slices/adminSlice';
import { toast } from 'react-hot-toast';
import {
  Factory, BookOpen, Package, ShieldCheck, BarChart2, Plus, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock, XCircle,
  RefreshCw, Edit3, Play, TrendingUp, IndianRupee, Trash,
} from 'lucide-react';
import AdminModal from '@/admin/components/AdminModal';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, Segmented, SearchInput, Toolbar,
  EmptyState, usePagination, Pagination, DialogPanel, Field,
} from '@/admin/ui';
import { useLookups, lookupOptions } from '@/admin/lookups';

const TABS = [
  { key: 'orders',  label: 'Production orders', icon: Factory },
  { key: 'bom',     label: 'BOM / recipes',     icon: BookOpen },
  { key: 'batches', label: 'Batches (FSSAI)',   icon: Package },
  { key: 'quality', label: 'Quality checks',    icon: ShieldCheck },
  { key: 'wastage', label: 'Wastage',           icon: Trash },
  { key: 'reports', label: 'Reports',           icon: BarChart2 },
];

const STATUS_TONE = { Planned: 'info', InProgress: 'warning', Completed: 'success', Cancelled: 'danger' };
const QC_TONE     = { Passed: 'success', Failed: 'danger', Pending: 'warning' };

const inp = 'input-field w-full';
const ORDERS_ALL = { limit: 500 };
const today = () => new Date().toISOString().split('T')[0];

/* Unit <select> fed by the Unit master list */
function UnitSelect({ value, onChange, className = inp }) {
  const lk = useLookups();
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      {lookupOptions(lk.list('Unit'), value).map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
    </select>
  );
}
const muted = 'text-[color:var(--text-muted)]';

/* Local dialog wrapper: AdminModal backdrop + kit DialogPanel */
const Modal = ({ title, onClose, footer, width = 'max-w-lg', children }) => (
  <AdminModal onClose={onClose}>
    <DialogPanel title={title} onClose={onClose} footer={footer} width={width}>
      <div className="space-y-3">{children}</div>
    </DialogPanel>
  </AdminModal>
);

const RefreshBtn = ({ onClick }) => (
  <Button variant="secondary" onClick={onClick}><RefreshCw className="size-3.5" /> Refresh</Button>
);

export default function AdminProduction() {
  const dispatch = useDispatch();
  const { orders, bom, batches, quality, wastage, reports, products, inventory } = useSelector(s => s.admin.production);
  const loading = useSelector(s => s.admin.loading);
  const [tab, setTab] = useState('orders');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    dispatch(fetchProductionProducts());
    dispatch(fetchProductionInventory());
  }, [dispatch]);

  useEffect(() => {
    if (tab === 'orders')  dispatch(fetchProductionOrders(ORDERS_ALL));
    if (tab === 'bom')     dispatch(fetchBom());
    if (tab === 'batches') { dispatch(fetchBatches()); dispatch(fetchProductionOrders(ORDERS_ALL)); }
    if (tab === 'quality') { dispatch(fetchQualityChecks()); dispatch(fetchProductionOrders(ORDERS_ALL)); }
    if (tab === 'wastage') { dispatch(fetchWastage()); dispatch(fetchProductionOrders(ORDERS_ALL)); }
    if (tab === 'reports') {
      dispatch(fetchProductionReports({ type: 'yield' }));
    }
  }, [tab, dispatch]);

  if (loading && !orders.length && !products.length) return (
    <div className="space-y-6"><SkPageHeader /><SkTable rows={6} cols={5} /></div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production"
        description="BOM · orders · FSSAI batches · quality · reports"
        actions={inventory && (
          <div className="flex h-9 items-center gap-2 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-[12px] text-[color:var(--text-muted)]">
            Inventory items: <span className="font-bold text-[color:var(--text-primary)]">{inventory.items?.length || 0}</span>
            {inventory.lowStockCount > 0 && (
              <Badge tone="danger"><AlertTriangle className="size-3" /> {inventory.lowStockCount} low</Badge>
            )}
          </div>
        )}
      />

      <Tabs items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} />

      {tab === 'orders' && (
        <OrdersTab
          orders={orders || []}
          bom={bom || []}
          products={products || []}
          onAddClick={() => { dispatch(fetchBom()); setModal('createOrder'); }}
          dispatch={dispatch}
          onComplete={id => setModal(`updateStatus:${id}`)}
        />
      )}

      {tab === 'bom' && (
        <BomTab
          bom={bom || []}
          onAddClick={() => setModal('createBom')}
          onEdit={id => setModal(`editBom:${id}`)}
          dispatch={dispatch}
        />
      )}

      {tab === 'batches' && (
        <BatchesTab
          batches={batches || []}
          orders={orders || []}
          onAddClick={() => setModal('createBatch')}
          dispatch={dispatch}
        />
      )}

      {tab === 'quality' && (
        <QualityTab
          quality={quality || []}
          orders={orders || []}
          onAddClick={() => setModal('createQuality')}
          dispatch={dispatch}
        />
      )}

      {tab === 'wastage' && (
        <WastageTab
          wastage={wastage || []}
          onAddClick={() => setModal('createWastage')}
          dispatch={dispatch}
        />
      )}

      {tab === 'reports' && (
        <ReportsTab reports={reports} dispatch={dispatch} />
      )}

      {/* Modals */}
      {modal === 'createOrder' && (
        <CreateOrderModal
          bom={bom || []}
          products={products || []}
          onClose={() => setModal(null)}
          onSave={data => {
            dispatch(createProductionOrder(data)).unwrap()
              .then(() => { toast.success('Production order created!'); setModal(null); dispatch(fetchProductionOrders(ORDERS_ALL)); })
              .catch(e => toast.error(e));
          }}
        />
      )}

      {modal === 'createBom' && (
        <CreateBomModal
          onClose={() => setModal(null)}
          onSave={data => {
            dispatch(createBom(data)).unwrap()
              .then(() => { toast.success('BOM recipe created!'); setModal(null); dispatch(fetchBom()); })
              .catch(e => toast.error(e));
          }}
        />
      )}

      {modal?.startsWith('editBom:') && (
        <CreateBomModal
          initial={bom?.find(b => b.id === parseInt(modal.split(':')[1]))}
          onClose={() => setModal(null)}
          onSave={data => {
            const id = parseInt(modal.split(':')[1]);
            dispatch(updateBom({ id, ...data })).unwrap()
              .then(() => { toast.success('BOM updated!'); setModal(null); dispatch(fetchBom()); })
              .catch(e => toast.error(e));
          }}
        />
      )}

      {modal === 'createBatch' && (
        <CreateBatchModal
          orders={orders || []}
          onClose={() => setModal(null)}
          onSave={data => {
            dispatch(createBatch(data)).unwrap()
              .then(() => { toast.success('Batch created!'); setModal(null); dispatch(fetchBatches()); })
              .catch(e => toast.error(e));
          }}
        />
      )}

      {modal === 'createQuality' && (
        <CreateQualityModal
          orders={orders || []}
          onClose={() => setModal(null)}
          onSave={data => {
            dispatch(createQualityCheck(data)).unwrap()
              .then(() => { toast.success('Quality check logged!'); setModal(null); dispatch(fetchQualityChecks()); })
              .catch(e => toast.error(e));
          }}
        />
      )}

      {modal === 'createWastage' && (
        <CreateWastageModal
          orders={orders || []}
          onClose={() => setModal(null)}
          onSave={data => {
            dispatch(createWastage(data)).unwrap()
              .then(() => { toast.success('Wastage recorded'); setModal(null); dispatch(fetchWastage()); dispatch(fetchProductionOrders(ORDERS_ALL)); })
              .catch(e => toast.error(e));
          }}
        />
      )}

      {modal?.startsWith('updateStatus:') && (
        <UpdateStatusModal
          order={orders?.find(o => o.id === parseInt(modal.split(':')[1]))}
          onClose={() => setModal(null)}
          onSave={(id, data) => {
            dispatch(updateProductionOrderStatus({ id, ...data })).unwrap()
              .then(() => { toast.success('Order updated!'); setModal(null); dispatch(fetchProductionOrders(ORDERS_ALL)); })
              .catch(e => toast.error(e));
          }}
        />
      )}
    </div>
  );
}

// ── Orders Tab ───────────────────────────────────────────────────────

function OrdersTab({ orders, bom, products, onAddClick, dispatch, onComplete }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = orders.filter(o =>
    (!search || o.productName?.toLowerCase().includes(search.toLowerCase()) || o.orderNumber?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || o.status === statusFilter)
  );
  const pg = usePagination(filtered, 20);

  const handleDelete = id => {
    if (!confirm('Delete this production order?')) return;
    dispatch(deleteProductionOrder(id)).unwrap()
      .then(() => toast.success('Order deleted!'))
      .catch(e => toast.error(e));
  };

  const quickStatus = (id, status) => {
    dispatch(updateProductionOrderStatus({ id, status })).unwrap()
      .then(() => { toast.success(`Marked ${status}`); dispatch(fetchProductionOrders(ORDERS_ALL)); })
      .catch(e => toast.error(e));
  };

  const count = s => orders.filter(o => o.status === s).length;
  const rowBtn = '!h-7 !px-2 !text-[12px]';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Planned" value={count('Planned')} icon={Clock} tone="info" />
        <Stat label="In progress" value={count('InProgress')} icon={Factory} tone="warning" />
        <Stat label="Completed" value={count('Completed')} icon={CheckCircle} tone="success" />
        <Stat label="Cancelled" value={count('Cancelled')} icon={XCircle} tone="danger" />
      </div>

      <Card>
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search orders…" className="max-w-xs" />
            <Segmented
              options={[{ value: '', label: 'All' }, { value: 'Planned', label: 'Planned' }, { value: 'InProgress', label: 'In progress' }, { value: 'Completed', label: 'Completed' }, { value: 'Cancelled', label: 'Cancelled' }]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <div className="ml-auto flex items-center gap-2">
              <RefreshBtn onClick={() => dispatch(fetchProductionOrders(ORDERS_ALL))} />
              <Button onClick={onAddClick}><Plus className="size-4" /> New order</Button>
            </div>
          </Toolbar>

          {filtered.length === 0 ? (
            <EmptyState icon={Factory} title={orders.length ? 'No orders match these filters' : 'No production orders'}>
              {orders.length ? 'Try another status or clear the search.' : 'Create one to get started.'}
            </EmptyState>
          ) : (
            <>
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Order #</th>
                      <th className="text-left">Product</th>
                      <th className="text-right">Target</th>
                      <th className="text-right">Actual</th>
                      <th className="text-right">Yield %</th>
                      <th className="text-left">Shift</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pg.items.map(o => (
                      <tr key={o.id}>
                        <td className="whitespace-nowrap font-mono text-[12px] font-bold text-[color:var(--primary)]">{o.orderNumber}</td>
                        <td className="whitespace-nowrap font-bold">{o.productName}</td>
                        <td className="whitespace-nowrap text-right">{o.targetQuantity} {o.unit}</td>
                        <td className="whitespace-nowrap text-right text-[color:var(--success)]">{o.actualQuantity > 0 ? `${o.actualQuantity} ${o.unit}` : '—'}</td>
                        <td className="whitespace-nowrap text-right">{o.yieldPercentage > 0 ? `${o.yieldPercentage}%` : '—'}</td>
                        <td className="whitespace-nowrap">{o.shift}</td>
                        <td className={`whitespace-nowrap ${muted}`}>{new Date(o.plannedDate).toLocaleDateString()}</td>
                        <td className="whitespace-nowrap"><Badge tone={STATUS_TONE[o.status] || 'neutral'}>{o.status}</Badge></td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {o.status === 'Planned' && (
                              <Button size="sm" variant="secondary" className={rowBtn} onClick={() => quickStatus(o.id, 'InProgress')}><Play className="size-3" /> Start</Button>
                            )}
                            {o.status === 'InProgress' && (
                              <Button size="sm" className={rowBtn} onClick={() => onComplete(o.id)}><CheckCircle className="size-3" /> Complete</Button>
                            )}
                            {(o.status === 'Planned' || o.status === 'InProgress') && (
                              <Button size="sm" variant="danger" className={rowBtn} onClick={() => quickStatus(o.id, 'Cancelled')}>Cancel</Button>
                            )}
                            <IconButton label="Delete order" tone="danger" onClick={() => handleDelete(o.id)}><Trash2 className="size-3.5" /></IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pg} noun="orders" />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── BOM Tab ──────────────────────────────────────────────────────────

function BomTab({ bom, onAddClick, onEdit, dispatch }) {
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const filtered = bom.filter(b => !search || b.productName?.toLowerCase().includes(search.toLowerCase()));
  const pg = usePagination(filtered, 20);

  const handleDelete = id => {
    if (!confirm('Delete this BOM recipe?')) return;
    dispatch(deleteBom(id)).unwrap()
      .then(() => toast.success('Deleted!'))
      .catch(e => toast.error(e));
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search recipes…" className="max-w-xs" />
        <div className="ml-auto flex items-center gap-2">
          <RefreshBtn onClick={() => dispatch(fetchBom())} />
          <Button onClick={onAddClick}><Plus className="size-4" /> New recipe</Button>
        </div>
      </Toolbar>

      {filtered.length === 0 && (
        <Card>
          <EmptyState icon={BookOpen} title={bom.length ? 'No recipes match your search' : 'No BOM recipes yet'}>
            {bom.length ? 'Try a different name.' : 'Create one to define ingredient lists and costings.'}
          </EmptyState>
        </Card>
      )}
      {pg.items.map(recipe => (
        <Card key={recipe.id}>
          <div
            className="flex cursor-pointer items-center justify-between px-3.5 py-3 hover:bg-[color:var(--surface-hover)]"
            onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
          >
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold">{recipe.productName}</h3>
              <p className={`mt-0.5 text-[12px] ${muted}`}>
                {recipe.ingredients?.length || 0} ingredients · Expected yield: {recipe.expectedYield}%
                {recipe.totalCost > 0 && ` · Est. cost: ₹${recipe.totalCost?.toFixed(2)}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Edit recipe" tone="primary" onClick={e => { e.stopPropagation(); onEdit(recipe.id); }}><Edit3 className="size-3.5" /></IconButton>
              <IconButton label="Delete recipe" tone="danger" onClick={e => { e.stopPropagation(); handleDelete(recipe.id); }}><Trash2 className="size-3.5" /></IconButton>
              {expanded === recipe.id ? <ChevronUp className={`size-4 ${muted}`} /> : <ChevronDown className={`size-4 ${muted}`} />}
            </div>
          </div>
          {expanded === recipe.id && (
            <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-secondary)] p-3">
              {recipe.description && <p className="mb-3 text-[13px] text-[color:var(--text-secondary)]">{recipe.description}</p>}
              {recipe.ingredients?.length > 0 ? (
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Raw material</th>
                        <th className="text-right">Qty per unit</th>
                        <th className="text-left">Unit</th>
                        <th className="text-right">Cost/unit</th>
                        <th className="text-right">Sub-total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.ingredients.map((ing, i) => (
                        <tr key={i}>
                          <td>{ing.rawMaterialName}</td>
                          <td className="text-right">{ing.quantityPer}</td>
                          <td>{ing.unit}</td>
                          <td className="text-right">{ing.costPerUnit ? `₹${ing.costPerUnit}` : '—'}</td>
                          <td className="text-right font-bold">{ing.costPerUnit ? `₹${(ing.quantityPer * ing.costPerUnit).toFixed(2)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={`text-[13px] ${muted}`}>No ingredients defined.</p>
              )}
            </div>
          )}
        </Card>
      ))}
      <Pagination {...pg} noun="recipes" />
    </div>
  );
}

// ── Batches Tab ──────────────────────────────────────────────────────

function BatchesTab({ batches, orders, onAddClick, dispatch }) {
  const pg = usePagination(batches, 20);
  return (
    <Card
      title={`${batches.length} batch records · FSSAI-compliant tracking`}
      actions={<>
        <Button size="sm" variant="secondary" onClick={() => dispatch(fetchBatches())}><RefreshCw className="size-3.5" /> Refresh</Button>
        <Button size="sm" onClick={onAddClick}><Plus className="size-3.5" /> New batch</Button>
      </>}
      bodyClassName="p-3"
    >
      {batches.length === 0 ? (
        <EmptyState icon={Package} title="No batches recorded yet">Create a batch from an in-progress or completed order.</EmptyState>
      ) : (
        <>
          <div className="grid-box">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Batch code</th>
                  <th className="text-left">Product</th>
                  <th className="text-left">Order #</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-left">Mfg date</th>
                  <th className="text-left">Expiry</th>
                  <th className="text-left">FSSAI license</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pg.items.map(b => (
                  <tr key={b.id}>
                    <td className="font-mono text-[12px] font-bold text-[color:var(--primary)]">{b.batchCode}</td>
                    <td className="font-bold">{b.productName}</td>
                    <td className={`text-[12px] ${muted}`}>{b.orderNumber}</td>
                    <td className="text-right">{b.quantity} {b.unit}</td>
                    <td>{new Date(b.manufactureDate).toLocaleDateString()}</td>
                    <td>
                      {b.expiryDate ? (
                        <span className={new Date(b.expiryDate) < new Date() ? 'font-bold text-[color:var(--danger)]' : ''}>
                          {new Date(b.expiryDate).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="font-mono text-[12px]">{b.fssaiLicenseNo || '—'}</td>
                    <td><Badge tone={b.status === 'Active' ? 'success' : 'neutral'}>{b.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pg} noun="batches" />
        </>
      )}
    </Card>
  );
}

// ── Quality Tab ──────────────────────────────────────────────────────

function QualityTab({ quality, orders, onAddClick, dispatch }) {
  const passed  = quality.filter(q => q.status === 'Passed').length;
  const failed  = quality.filter(q => q.status === 'Failed').length;
  const pending = quality.filter(q => q.status === 'Pending').length;
  const pg = usePagination(quality, 20);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Passed" value={passed} icon={CheckCircle} tone="success" />
        <Stat label="Failed" value={failed} icon={XCircle} tone="danger" />
        <Stat label="Pending" value={pending} icon={Clock} tone="warning" />
      </div>

      <Card
        title={`${quality.length} quality checks total`}
        actions={<>
          <Button size="sm" variant="secondary" onClick={() => dispatch(fetchQualityChecks())}><RefreshCw className="size-3.5" /> Refresh</Button>
          <Button size="sm" onClick={onAddClick}><Plus className="size-3.5" /> Log check</Button>
        </>}
        bodyClassName="p-3"
      >
        {quality.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No quality checks logged yet" />
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Product</th>
                    <th className="text-left">Order #</th>
                    <th className="text-left">Checked by</th>
                    <th className="text-left">Result</th>
                    <th className="text-left">Remarks</th>
                    <th className="text-left">Failure reason</th>
                    <th className="text-left">Checked at</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map(q => (
                    <tr key={q.id}>
                      <td className="font-bold">{q.productName}</td>
                      <td className={`font-mono text-[12px] ${muted}`}>{q.orderNumber}</td>
                      <td>{q.checkedBy}</td>
                      <td><Badge tone={QC_TONE[q.status] || 'neutral'}>{q.status}</Badge></td>
                      <td className="max-w-xs truncate text-[color:var(--text-secondary)]">{q.remarks || '—'}</td>
                      <td className="max-w-xs truncate text-[12px] text-[color:var(--danger)]">{q.failureReason || '—'}</td>
                      <td className={`whitespace-nowrap ${muted}`}>{new Date(q.checkedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="checks" />
          </>
        )}
      </Card>
    </div>
  );
}

// ── Reports Tab ──────────────────────────────────────────────────────

function ReportsTab({ reports, dispatch }) {
  const [reportType, setReportType] = useState('yield');
  const [shiftDate, setShiftDate] = useState(today());

  const load = (type, date = shiftDate) => {
    setReportType(type);
    dispatch(fetchProductionReports(type === 'shift' ? { type, date } : { type }));
  };

  const data = reports?.type === reportType ? reports?.data : null;

  return (
    <div className="space-y-4">
      <Segmented
        options={[
          { value: 'yield', label: 'Yield tracking' },
          { value: 'shift', label: 'Shift report' },
          { value: 'cost',  label: 'Cost analysis' },
        ]}
        value={reportType}
        onChange={t => load(t)}
      />
      {reportType === 'shift' && (
        <Field label="Shift report date" className="max-w-[200px]">
          <input type="date" className={inp} value={shiftDate} onChange={e => { setShiftDate(e.target.value); load('shift', e.target.value); }} />
        </Field>
      )}

      {!data && (
        <Card><EmptyState icon={BarChart2} title="No report data">Select a report type to view data.</EmptyState></Card>
      )}

      {data && reportType === 'yield' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Avg yield (last 30 days)" value={`${data.avgYield}%`} icon={TrendingUp} tone="success" />
            <Stat label="Total wastage (qty)" value={data.totalWastage} icon={AlertTriangle} tone="danger" />
          </div>
          <Card title="Completed orders (last 30 days)" bodyClassName="p-3">
            {!data.orders?.length ? (
              <EmptyState icon={Factory} title="No completed orders in the last 30 days" />
            ) : (
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Order #</th>
                      <th className="text-left">Product</th>
                      <th className="text-right">Target</th>
                      <th className="text-right">Actual</th>
                      <th className="text-right">Wastage</th>
                      <th className="text-right">Yield %</th>
                      <th className="text-right">Cost/unit</th>
                      <th className="text-left">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders?.map(o => (
                      <tr key={o.id}>
                        <td className="font-mono text-[12px] font-bold text-[color:var(--primary)]">{o.orderNumber}</td>
                        <td>{o.productName}</td>
                        <td className="text-right">{o.targetQuantity}</td>
                        <td className="text-right text-[color:var(--success)]">{o.actualQuantity}</td>
                        <td className="text-right text-[color:var(--danger)]">{o.wastageQuantity}</td>
                        <td className="text-right">
                          <span className={`font-bold ${o.yieldPercentage >= 90 ? 'text-[color:var(--success)]' : o.yieldPercentage >= 75 ? 'text-[color:var(--warning)]' : 'text-[color:var(--danger)]'}`}>
                            {o.yieldPercentage}%
                          </span>
                        </td>
                        <td className="text-right">₹{o.costPerUnit?.toFixed(2)}</td>
                        <td className={muted}>{new Date(o.completedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {data && reportType === 'shift' && (
        <div className="space-y-3">
          <p className={`text-[13px] ${muted}`}>Report for: {data.date ? new Date(data.date).toLocaleDateString() : 'today'}</p>
          {data.shifts?.length === 0 && <Card><EmptyState icon={Clock} title="No production planned for this date" /></Card>}
          {data.shifts?.map(s => (
            <Card
              key={s.shift}
              title={`${s.shift} shift`}
              actions={<Badge>{s.completed}/{s.totalOrders} completed</Badge>}
              bodyClassName="p-3"
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Target" value={s.totalTarget} />
                <Stat label="Actual" value={s.totalActual} tone="success" />
                <Stat label="Wastage" value={s.totalWastage} tone="danger" />
                <Stat label="Total cost" value={`₹${s.totalCost?.toFixed(0)}`} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && reportType === 'cost' && (
        <Card
          title="Cost by product (last 30 days)"
          actions={<span className="flex items-center gap-1 text-[13px] font-bold"><IndianRupee className="size-3.5" />Total: ₹{data.totalCost?.toFixed(0)}</span>}
          bodyClassName="p-3"
        >
          {!data.products?.length ? (
            <EmptyState icon={BarChart2} title="No cost data available" />
          ) : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Product</th>
                    <th className="text-right">Batches</th>
                    <th className="text-right">Total qty</th>
                    <th className="text-right">Total cost</th>
                    <th className="text-right">Avg cost/unit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products?.map((p, i) => (
                    <tr key={i}>
                      <td className="font-bold">{p.productName}</td>
                      <td className="text-right">{p.totalBatches}</td>
                      <td className="text-right">{p.totalQuantity}</td>
                      <td className="text-right font-bold">₹{p.totalCost?.toFixed(0)}</td>
                      <td className="text-right">₹{p.avgCostPerUnit?.toFixed(2)}/unit</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Create Order Modal ────────────────────────────────────────────────

function CreateOrderModal({ bom, products, onClose, onSave }) {
  const lk = useLookups();
  const shifts = lk.list('ProductionShift');
  const [form, setForm] = useState({
    productName: '', productId: '', bomRecipeId: '',
    targetQuantity: '', unit: lk.values('Unit').includes('kg') ? 'kg' : (lk.values('Unit')[0] || 'kg'), shift: '',
    plannedDate: today(), notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleBomSelect = id => {
    set('bomRecipeId', id);
    const recipe = bom.find(b => b.id === parseInt(id));
    if (recipe && !form.productName) set('productName', recipe.productName);
  };

  const handleSubmit = () => {
    if (!form.productName.trim() || !form.plannedDate) {
      toast.error('Fill product name and planned date'); return;
    }
    if (!(parseFloat(form.targetQuantity) > 0)) { toast.error('Target quantity must be greater than zero'); return; }
    onSave({
      productName: form.productName,
      productId:   form.productId ? parseInt(form.productId) : null,
      bomRecipeId: form.bomRecipeId ? parseInt(form.bomRecipeId) : null,
      targetQuantity: parseFloat(form.targetQuantity),
      unit: form.unit, shift: form.shift || shifts[0]?.value || 'Morning',
      plannedDate: form.plannedDate,
      notes: form.notes || null,
    });
  };

  return (
    <Modal
      title="New production order"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Create order</Button>
      </>}
    >
      <Field label="BOM recipe (optional)">
        <select className={inp} value={form.bomRecipeId} onChange={e => handleBomSelect(e.target.value)}>
          <option value="">— Select recipe —</option>
          {bom.map(b => <option key={b.id} value={b.id}>{b.productName}</option>)}
        </select>
      </Field>
      <Field label="Catalog product (optional)">
        <select className={inp} value={form.productId} onChange={e => {
          const p = products.find(x => x.id === parseInt(e.target.value));
          setForm(f => ({ ...f, productId: e.target.value, productName: p ? p.name : f.productName }));
        }}>
          <option value="">— Not linked —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.weight ? ` (${p.weight})` : ''}</option>)}
        </select>
      </Field>
      <Field label="Product name" required>
        <input className={inp} value={form.productName} onChange={e => set('productName', e.target.value)} placeholder="e.g. Garam Masala" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target quantity" required>
          <input type="number" className={inp} value={form.targetQuantity} onChange={e => set('targetQuantity', e.target.value)} min="0" />
        </Field>
        <Field label="Unit">
          <UnitSelect value={form.unit} onChange={v => set('unit', v)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shift">
          <select className={inp} value={form.shift || shifts[0]?.value || ''} onChange={e => set('shift', e.target.value)}>
            {lookupOptions(shifts, form.shift).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Planned date" required>
          <input type="date" className={inp} value={form.plannedDate} onChange={e => set('plannedDate', e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Update Status Modal ───────────────────────────────────────────────

function UpdateStatusModal({ order, onClose, onSave }) {
  const [form, setForm] = useState({ status: 'Completed', actualQuantity: '', wastageQuantity: '', totalCost: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  if (!order) return null;
  return (
    <Modal
      title={`Complete: ${order.orderNumber}`}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            if (form.status === 'Completed' && !(parseFloat(form.actualQuantity) > 0)) { toast.error('Enter the actual quantity produced'); return; }
            if ([form.wastageQuantity, form.totalCost].some(v => v !== '' && parseFloat(v) < 0)) { toast.error('Values cannot be negative'); return; }
            onSave(order.id, {
            status: form.status,
            actualQuantity:  form.actualQuantity  ? parseFloat(form.actualQuantity)  : null,
            wastageQuantity: form.wastageQuantity ? parseFloat(form.wastageQuantity) : null,
            totalCost:       form.totalCost       ? parseFloat(form.totalCost)       : null,
            });
          }}
        >Save</Button>
      </>}
    >
      <p className={`text-[13px] ${muted}`}>
        <strong className="text-[color:var(--text-primary)]">{order.productName}</strong> · Target: {order.targetQuantity} {order.unit}
      </p>
      <Field label="New status">
        <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </Field>
      {form.status === 'Completed' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Actual quantity" required>
              <input type="number" className={inp} value={form.actualQuantity} onChange={e => set('actualQuantity', e.target.value)} placeholder={order.targetQuantity} />
            </Field>
            <Field label="Total wastage" hint={order.wastageQuantity > 0 ? `${order.wastageQuantity} ${order.unit} already logged` : undefined}>
              <input type="number" className={inp} value={form.wastageQuantity} onChange={e => set('wastageQuantity', e.target.value)} placeholder={order.wastageQuantity || '0'} />
            </Field>
          </div>
          <Field label="Total cost (₹)">
            <input type="number" className={inp} value={form.totalCost} onChange={e => set('totalCost', e.target.value)} placeholder="e.g. 2500" />
          </Field>
        </>
      )}
    </Modal>
  );
}

// ── Create BOM Modal ──────────────────────────────────────────────────

function CreateBomModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    productName:   initial?.productName   || '',
    description:   initial?.description   || '',
    expectedYield: initial?.expectedYield || 100,
  });
  const [ingredients, setIngredients] = useState(
    initial?.ingredients?.map(i => ({
      rawMaterialName: i.rawMaterialName,
      quantityPer: i.quantityPer,
      unit: i.unit,
      costPerUnit: i.costPerUnit ?? '',
    })) || [{ rawMaterialName: '', quantityPer: '', unit: 'kg', costPerUnit: '' }]
  );

  const addIng    = () => setIngredients(i => [...i, { rawMaterialName: '', quantityPer: '', unit: 'kg', costPerUnit: '' }]);
  const removeIng = idx => setIngredients(i => i.filter((_, j) => j !== idx));
  const setIng    = (idx, k, v) => setIngredients(i => i.map((item, j) => j === idx ? { ...item, [k]: v } : item));

  const handleSubmit = () => {
    if (!form.productName.trim()) { toast.error('Product name required'); return; }
    const y = parseFloat(form.expectedYield);
    if (!(y > 0 && y <= 100)) { toast.error('Expected yield must be between 1 and 100%'); return; }
    if (ingredients.some(i => i.rawMaterialName && !(parseFloat(i.quantityPer) > 0))) { toast.error('Every ingredient needs a quantity above zero'); return; }
    onSave({
      productName:   form.productName,
      description:   form.description || null,
      expectedYield: parseFloat(form.expectedYield) || 100,
      productId:     null,
      ingredients:   ingredients.filter(i => i.rawMaterialName).map(i => ({
        rawMaterialName: i.rawMaterialName,
        quantityPer:     parseFloat(i.quantityPer) || 0,
        unit:            i.unit,
        costPerUnit:     i.costPerUnit !== '' ? parseFloat(i.costPerUnit) : null,
      })),
    });
  };

  return (
    <Modal
      title={initial ? 'Edit BOM recipe' : 'New BOM recipe'}
      onClose={onClose}
      width="max-w-2xl"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>{initial ? 'Update' : 'Create'} recipe</Button>
      </>}
    >
      <Field label="Product name" required>
        <input className={inp} value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="Garam Masala" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expected yield (%)">
          <input type="number" className={inp} value={form.expectedYield} onChange={e => setForm(f => ({ ...f, expectedYield: e.target.value }))} min="1" max="100" />
        </Field>
        <Field label="Description">
          <input className={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes" />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[12px] font-bold text-[color:var(--text-secondary)]">Ingredients</p>
        <Button size="sm" variant="tertiary" onClick={addIng}><Plus className="size-3.5" /> Add row</Button>
      </div>

      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
        <div className={`grid grid-cols-12 gap-2 text-[11px] font-bold ${muted}`}>
          <span className="col-span-4">Raw material</span>
          <span className="col-span-2">Qty</span>
          <span className="col-span-2">Unit</span>
          <span className="col-span-3">₹/unit</span>
        </div>
        {ingredients.map((ing, idx) => (
          <div key={idx} className="grid grid-cols-12 items-center gap-2">
            <input className={`${inp} col-span-4`} placeholder="Raw material" value={ing.rawMaterialName} onChange={e => setIng(idx, 'rawMaterialName', e.target.value)} />
            <input type="number" className={`${inp} col-span-2`} placeholder="Qty" value={ing.quantityPer} onChange={e => setIng(idx, 'quantityPer', e.target.value)} min="0" />
            <UnitSelect className={`${inp} col-span-2`} value={ing.unit} onChange={v => setIng(idx, 'unit', v)} />
            <input type="number" className={`${inp} col-span-3`} placeholder="₹/unit" value={ing.costPerUnit} onChange={e => setIng(idx, 'costPerUnit', e.target.value)} min="0" />
            <div className="col-span-1 flex justify-center">
              <IconButton label="Remove ingredient" tone="danger" onClick={() => removeIng(idx)}><Trash2 className="size-3.5" /></IconButton>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Create Batch Modal ────────────────────────────────────────────────

function CreateBatchModal({ orders, onClose, onSave }) {
  const [form, setForm] = useState({
    productionOrderId: '', batchCode: '', quantity: '', unit: 'kg',
    manufactureDate: new Date().toISOString().split('T')[0],
    expiryDate: '', fssaiLicenseNo: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.productionOrderId || !form.batchCode.trim()) {
      toast.error('Order and batch code are required'); return;
    }
    if (!(parseFloat(form.quantity) > 0)) { toast.error('Quantity must be greater than zero'); return; }
    if (form.expiryDate && form.expiryDate < form.manufactureDate) { toast.error('Expiry date can\'t be before the manufacture date'); return; }
    onSave({
      productionOrderId: parseInt(form.productionOrderId),
      batchCode:     form.batchCode.trim(),
      quantity:      parseFloat(form.quantity),
      unit:          form.unit,
      manufactureDate: form.manufactureDate,
      expiryDate:    form.expiryDate || null,
      fssaiLicenseNo: form.fssaiLicenseNo || null,
    });
  };

  return (
    <Modal
      title="New batch record (FSSAI)"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Create batch</Button>
      </>}
    >
      <Field label="Production order" required>
        <select className={inp} value={form.productionOrderId} onChange={e => set('productionOrderId', e.target.value)}>
          <option value="">— Select order —</option>
          {orders.filter(o => ['InProgress','Completed'].includes(o.status)).map(o => (
            <option key={o.id} value={o.id}>{o.orderNumber} — {o.productName}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch code" required>
          <input className={inp} value={form.batchCode} onChange={e => set('batchCode', e.target.value)} placeholder="BATCH-20260615-001" />
        </Field>
        <Field label="FSSAI license no">
          <input className={inp} value={form.fssaiLicenseNo} onChange={e => set('fssaiLicenseNo', e.target.value)} placeholder="10123456789000" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" required>
          <input type="number" className={inp} value={form.quantity} onChange={e => set('quantity', e.target.value)} min="0" />
        </Field>
        <Field label="Unit">
          <UnitSelect value={form.unit} onChange={v => set('unit', v)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacture date" required>
          <input type="date" className={inp} value={form.manufactureDate} onChange={e => set('manufactureDate', e.target.value)} />
        </Field>
        <Field label="Expiry date">
          <input type="date" className={inp} value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ── Create Quality Check Modal ────────────────────────────────────────

function CreateQualityModal({ orders, onClose, onSave }) {
  const [form, setForm] = useState({
    productionOrderId: '', checkedBy: '', status: 'Passed', remarks: '', failureReason: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.productionOrderId) { toast.error('Select a production order'); return; }
    if (form.status === 'Failed' && !form.failureReason.trim()) { toast.error('Enter the failure reason'); return; }
    onSave({
      productionOrderId: parseInt(form.productionOrderId),
      checkedBy:    form.checkedBy || null,
      status:       form.status,
      remarks:      form.remarks || null,
      failureReason: form.status === 'Failed' ? (form.failureReason || null) : null,
    });
  };

  return (
    <Modal
      title="Log quality check"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Log check</Button>
      </>}
    >
      <Field label="Production order" required>
        <select className={inp} value={form.productionOrderId} onChange={e => set('productionOrderId', e.target.value)}>
          <option value="">— Select order —</option>
          {orders.filter(o => o.status !== 'Cancelled').map(o => (
            <option key={o.id} value={o.id}>{o.orderNumber} — {o.productName}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Checked by">
          <input className={inp} value={form.checkedBy} onChange={e => set('checkedBy', e.target.value)} placeholder="Inspector name" />
        </Field>
        <Field label="Result" required>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            <option>Passed</option>
            <option>Failed</option>
            <option>Pending</option>
          </select>
        </Field>
      </div>
      <Field label="Remarks">
        <textarea className={inp} rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Observations..." />
      </Field>
      {form.status === 'Failed' && (
        <Field label="Failure reason" required>
          <textarea className={inp} rows={2} value={form.failureReason} onChange={e => set('failureReason', e.target.value)} placeholder="Describe what failed..." />
        </Field>
      )}
    </Modal>
  );
}

// ── Wastage Tab ──────────────────────────────────────────────────────

function WastageTab({ wastage, onAddClick, dispatch }) {
  const pg = usePagination(wastage, 20);
  const byUnit = wastage.reduce((m, w) => ({ ...m, [w.unit]: (m[w.unit] || 0) + Number(w.wastageQty || 0) }), {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Wastage records" value={wastage.length} icon={Trash} tone="danger" />
        {Object.entries(byUnit).slice(0, 3).map(([unit, qty]) => (
          <Stat key={unit} label={`Total wasted (${unit})`} value={Math.round(qty * 100) / 100} icon={AlertTriangle} tone="warning" />
        ))}
      </div>
      <Card
        title={`${wastage.length} wastage records`}
        actions={<>
          <Button size="sm" variant="secondary" onClick={() => dispatch(fetchWastage())}><RefreshCw className="size-3.5" /> Refresh</Button>
          <Button size="sm" onClick={onAddClick}><Plus className="size-3.5" /> Record wastage</Button>
        </>}
        bodyClassName="p-3"
      >
        {wastage.length === 0 ? (
          <EmptyState icon={Trash} title="No wastage recorded">Log spillage, rejects or process loss against a production order.</EmptyState>
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Order #</th>
                    <th className="text-left">Product</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-left">Stage</th>
                    <th className="text-left">Reason</th>
                    <th className="text-left">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map(w => (
                    <tr key={w.id}>
                      <td className="font-mono text-[12px] font-bold text-[color:var(--primary)]">{w.orderNumber}</td>
                      <td className="font-bold">{w.productName}</td>
                      <td className="text-right text-[color:var(--danger)]">{w.wastageQty} {w.unit}</td>
                      <td>{w.stage || '—'}</td>
                      <td className="max-w-xs truncate text-[color:var(--text-secondary)]">{w.reason}</td>
                      <td className={`whitespace-nowrap ${muted}`}>{new Date(w.recordedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="records" />
          </>
        )}
      </Card>
    </div>
  );
}

function CreateWastageModal({ orders, onClose, onSave }) {
  const [form, setForm] = useState({ productionOrderId: '', wastageQty: '', unit: '', reason: '', stage: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const open = orders.filter(o => o.status !== 'Cancelled');
  const order = orders.find(o => o.id === parseInt(form.productionOrderId));

  const handleSubmit = () => {
    if (!form.productionOrderId) { toast.error('Select a production order'); return; }
    if (!(parseFloat(form.wastageQty) > 0)) { toast.error('Wastage quantity must be greater than zero'); return; }
    if (!form.reason.trim()) { toast.error('Reason is required'); return; }
    onSave({
      productionOrderId: parseInt(form.productionOrderId),
      wastageQty: parseFloat(form.wastageQty),
      unit: form.unit || order?.unit || null,
      reason: form.reason.trim(),
      stage: form.stage.trim() || null,
    });
  };

  return (
    <Modal
      title="Record wastage"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Record</Button>
      </>}
    >
      <Field label="Production order" required>
        <select className={inp} value={form.productionOrderId} onChange={e => set('productionOrderId', e.target.value)}>
          <option value="">— Select order —</option>
          {open.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.productName} ({o.status})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity wasted" required>
          <input type="number" min="0" step="any" className={inp} value={form.wastageQty} onChange={e => set('wastageQty', e.target.value)} />
        </Field>
        <Field label="Unit">
          <UnitSelect value={form.unit || order?.unit || ''} onChange={v => set('unit', v)} />
        </Field>
      </div>
      <Field label="Stage">
        <input className={inp} value={form.stage} onChange={e => set('stage', e.target.value)} placeholder="e.g. Grinding, Packing" />
      </Field>
      <Field label="Reason" required>
        <textarea className={inp} rows={2} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="What was lost and why…" />
      </Field>
    </Modal>
  );
}
