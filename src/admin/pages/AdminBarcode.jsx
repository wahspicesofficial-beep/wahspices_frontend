import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SkPageHeader, SkTable } from '@/components/ui/Skeleton';
import {
  fetchBarcodeProducts, scanBarcode, generateBarcodeLog,
  logBarcodePrint, fetchBarcodeHistory, deleteBarcodeLog,
} from '@/store/slices/adminSlice';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import api from '@/services/api';
import { useLookups } from '@/admin/lookups';
import {
  QrCode, ScanLine, Printer, Clock, Settings2,
  Plus, Trash2, RefreshCw, CheckCircle,
  Package, AlertTriangle, X,
} from 'lucide-react';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, Segmented, SearchInput, Toolbar,
  EmptyState, Skeleton, usePagination, Pagination, Field,
} from '@/admin/ui';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'generate',  label: 'Generate',   icon: QrCode    },
  { key: 'scan',      label: 'Scan',       icon: ScanLine  },
  { key: 'bulk',      label: 'Bulk print', icon: Printer   },
  { key: 'history',   label: 'History',    icon: Clock     },
  { key: 'settings',  label: 'Settings',   icon: Settings2 },
];

const ACTION_TONE = { Scan: 'info', Generate: 'success', Print: 'accent' };

const inp = 'input-field w-full';
const muted = 'text-[color:var(--text-muted)]';

const SETTINGS_KEY = 'wah.barcodeLabelSettings';
const DEFAULT_TOGGLES = { showLogo: true, showMrp: true, showBatch: true, showMfg: false, showExp: true, showCompany: true };
const loadToggles = () => {
  try { return { ...DEFAULT_TOGGLES, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return DEFAULT_TOGGLES; }
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Self-contained SVG markup for a barcode / QR (no CSS classes, safe to print in a new window). */
function barcodeSvg(value, type, height = 50) {
  if (!value) return '';
  if (type === 'QR') return renderToStaticMarkup(<QRCodeSVG value={value} size={110} level="M" includeMargin />);
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const v = type === 'EAN13' ? value.replace(/\D/g, '').padEnd(12, '0').slice(0, 12) : value;
    JsBarcode(el, v, { format: type === 'EAN13' ? 'EAN13' : 'CODE128', width: 1.5, height, displayValue: true, fontSize: 10, margin: 4, background: '#ffffff', lineColor: '#1a1a1a' });
    el.setAttribute('style', 'max-width:100%;height:auto;display:block;margin:0 auto;');
    return el.outerHTML;
  } catch {
    return `<div style="font-family:monospace;letter-spacing:2px;border-top:1px solid #333;border-bottom:1px solid #333;padding:4px 0;margin:3px 0;">${esc(value)}</div>`;
  }
}

/** One printable label with inline styles only (the print window has no Tailwind). */
function labelHtml(product, type, settings) {
  const value = product?.sku || product?.productName || '';
  const meta = 'font-size:9px;color:#666;';
  const dates = [
    settings.showMfg && product?.manufactureDate ? `MFG: ${new Date(product.manufactureDate).toLocaleDateString('en-IN')}` : '',
    settings.showExp && product?.expiryDate ? `EXP: ${new Date(product.expiryDate).toLocaleDateString('en-IN')}` : '',
  ].filter(Boolean);
  return `<div style="border:1px solid #ccc;border-radius:6px;padding:8px;width:200px;display:inline-block;margin:4px;text-align:center;vertical-align:top;page-break-inside:avoid;background:#fff;font-family:Arial,sans-serif;">
    ${settings.showLogo ? `<img src="${window.location.origin}/wah_logo.jpg" alt="" style="height:28px;width:auto;object-fit:contain;display:block;margin:0 auto 2px;" onerror="this.style.display='none'"/>` : ''}
    <div style="font-weight:bold;font-size:12px;color:#111;line-height:1.2;">${esc(product?.productName)}</div>
    ${product?.weight ? `<div style="${meta}">${esc(product.weight)}</div>` : ''}
    <div style="margin:6px 0;">${barcodeSvg(value, type)}</div>
    ${dates.length ? `<div style="${meta}display:flex;justify-content:space-between;">${dates.map(d => `<span>${d}</span>`).join('')}</div>` : ''}
    ${settings.showMrp && product?.mrp > 0 ? `<div style="font-size:13px;font-weight:900;color:#c00;margin-top:2px;">MRP ₹${esc(product.mrp)}</div>` : ''}
    ${settings.showBatch && product?.batchNumber ? `<div style="${meta}">Batch: ${esc(product.batchNumber)}</div>` : ''}
    ${settings.showCompany && settings.companyName ? `<div style="${meta}margin-top:2px;">${esc(settings.companyName)}</div>` : ''}
  </div>`;
}

/** Opens a print window with the given labels; returns false if the popup was blocked. */
function printLabels(title, labels) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>body{margin:0;padding:10px;background:#fff;}@media print{@page{size:A4;margin:5mm;}body{padding:0;}}</style>
    </head><body>${labels.join('')}</body></html>`);
  w.document.close();
  // Give the logo a moment to load before opening the print dialog
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* window closed */ } }, 500);
  return true;
}

// ── Barcode Renderer ──────────────────────────────────────────────────────────

function BarcodeRenderer({ value, type = 'Code128', width = 200, height = 60 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!value || type === 'QR') return;
    if (!svgRef.current) return;
    try {
      // EAN13 needs exactly 12 digits (13th is checksum)
      let barcodeVal = value;
      if (type === 'EAN13') {
        const digits = value.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
        barcodeVal = digits;
      }
      JsBarcode(svgRef.current, barcodeVal, {
        format: type === 'EAN13' ? 'EAN13' : 'CODE128',
        width: 1.5,
        height: height,
        displayValue: true,
        fontSize: 10,
        margin: 4,
        background: '#ffffff',
        lineColor: '#1a1a1a',
      });
    } catch {
      // invalid value for format — show placeholder
      if (svgRef.current) svgRef.current.innerHTML = '';
    }
  }, [value, type, height]);

  if (!value) return <div className="text-xs text-gray-400 text-center py-4">No barcode value</div>;

  if (type === 'QR') {
    return (
      <div className="flex justify-center">
        <QRCodeSVG value={value} size={width} level="M" includeMargin />
      </div>
    );
  }

  return <svg ref={svgRef} className="w-full" />;
}

// ── Label Preview ─────────────────────────────────────────────────────────────

function LabelPreview({ product, barcodeType, settings }) {
  const value = product?.sku || product?.productName || '';

  return (
    <div className="no-grid border-2 border-dashed border-gray-200 rounded-xl p-4 bg-white max-w-xs mx-auto">
      <div className="text-center mb-2">
        {settings.showLogo && (
          <img src="/wah_logo.jpg" alt="Wah" onError={e => e.target.style.display='none'}
            className="h-8 w-auto object-contain mx-auto mb-1" />
        )}
        <div className="font-bold text-gray-900 text-sm leading-tight">{product?.productName}</div>
        {product?.weight && <div className="text-xs text-gray-500">{product.weight}</div>}
      </div>

      <div className="my-2">
        <BarcodeRenderer value={value} type={barcodeType} height={50} />
      </div>

      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
        {settings.showMfg && product?.manufactureDate && (
          <span>MFG: {new Date(product.manufactureDate).toLocaleDateString('en-IN')}</span>
        )}
        {settings.showExp && product?.expiryDate && (
          <span>EXP: {new Date(product.expiryDate).toLocaleDateString('en-IN')}</span>
        )}
      </div>

      {settings.showMrp && product?.mrp > 0 && (
        <div className="text-center text-sm font-black text-red-600 mt-1">MRP ₹{product.mrp}</div>
      )}
      {settings.showBatch && product?.batchNumber && (
        <div className="text-center text-[9px] text-gray-400">Batch: {product.batchNumber}</div>
      )}
      {settings.showCompany && (
        <div className="text-center text-[9px] text-gray-400 mt-0.5">{settings.companyName}</div>
      )}
    </div>
  );
}

// ── Generate Tab ──────────────────────────────────────────────────────────────

function GenerateTab({ products, loading, settings, barcodeTypes, onLogged }) {
  const dispatch = useDispatch();
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [barcodeType, setType]  = useState(barcodeTypes[0]?.value || 'Code128');
  const [qty, setQty]           = useState(1);

  const filtered = products.filter(p =>
    p.productName?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );
  const pg = usePagination(filtered, 20);

  const handleGenerate = async () => {
    if (!selected) return toast.error('Select a product first');
    if (!(qty >= 1 && qty <= 500)) return toast.error('Quantity must be between 1 and 500');
    const res = await dispatch(generateBarcodeLog({
      productId: selected.productId, productName: selected.productName, sku: selected.sku,
      barcodeValue: selected.sku, barcodeType, quantity: qty,
    }));
    if (generateBarcodeLog.fulfilled.match(res)) { toast.success('Barcode generated & logged'); onLogged(); }
    else toast.error(res.payload || 'Failed to log generation');
  };

  const handlePrint = async () => {
    if (!selected) return toast.error('Select a product first');
    if (!(qty >= 1 && qty <= 500)) return toast.error('Quantity must be between 1 and 500');
    const label = labelHtml(selected, barcodeType, settings);
    if (!printLabels(`Labels — ${selected.productName}`, Array.from({ length: qty }, () => label))) {
      return toast.error('Allow pop-ups for this site to print labels');
    }
    const res = await dispatch(logBarcodePrint({
      productId: selected.productId, productName: selected.productName,
      sku: selected.sku, barcodeValue: selected.sku,
      barcodeType, quantity: qty,
    }));
    if (logBarcodePrint.fulfilled.match(res)) { toast.success(`${qty} label(s) sent to printer`); onLogged(); }
    else toast.error(res.payload || 'Labels printed, but the print log failed');
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      {/* Product list */}
      <Card
        className="xl:col-span-2"
        title="Select product"
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Search…" className="!min-w-[160px] max-w-[220px] [&_input]:!h-7" />}
        bodyClassName="p-3"
      >
        {loading && products.length === 0 ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="block h-8 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No products">{products.length ? 'Try another search.' : 'Products with SKUs will appear here.'}</EmptyState>
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">SKU</th>
                    <th className="text-left">Product</th>
                    <th className="text-left">Weight</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">MRP</th>
                    <th className="text-center" />
                  </tr>
                </thead>
                <tbody>
                  {pg.items.map(p => {
                    const isSel = selected?.sku === p.sku;
                    return (
                      <tr key={p.sku} onClick={() => setSelected(isSel ? null : p)} className="cursor-pointer">
                        <td className={`font-mono text-[12px] font-bold ${muted} ${isSel ? '!bg-[color:var(--selection)]' : ''}`}>{p.sku}</td>
                        <td className={`font-bold ${isSel ? '!bg-[color:var(--selection)]' : ''}`}>{p.productName}</td>
                        <td className={`${muted} ${isSel ? '!bg-[color:var(--selection)]' : ''}`}>{p.weight}</td>
                        <td className={`text-right ${isSel ? '!bg-[color:var(--selection)]' : ''}`}>
                          <Badge tone={p.isLowStock ? 'danger' : 'success'}>{p.currentStock}</Badge>
                        </td>
                        <td className={`text-right ${isSel ? '!bg-[color:var(--selection)]' : ''}`}>₹{p.mrp || '—'}</td>
                        <td className={`text-center ${isSel ? '!bg-[color:var(--selection)]' : ''}`}>
                          <Button size="sm" variant={isSel ? 'primary' : 'secondary'} className="!h-7 !px-2 !text-[12px]" onClick={e => { e.stopPropagation(); setSelected(p); }}>
                            {isSel ? <><CheckCircle className="size-3" /> Selected</> : 'Select'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} noun="products" />
          </>
        )}
      </Card>

      {/* Label preview + controls */}
      <Card title="Label preview" bodyClassName="p-4">
        {selected ? (
          <>
            <div className="no-grid">
              <LabelPreview product={selected} barcodeType={barcodeType} settings={settings} />
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Barcode type">
                <select value={barcodeType} onChange={e => setType(e.target.value)} className={inp}>
                  {barcodeTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Quantity">
                <input type="number" value={qty} min={1} max={500} onChange={e => setQty(+e.target.value)} className={inp} />
              </Field>
              <Button variant="secondary" className="w-full" onClick={handleGenerate}>
                <QrCode className="size-3.5" /> Generate & log
              </Button>
              <Button className="w-full" onClick={handlePrint}>
                <Printer className="size-3.5" /> Print {qty} label{qty > 1 ? 's' : ''}
              </Button>
            </div>
          </>
        ) : (
          <EmptyState icon={QrCode} title="Select a product">Pick a product on the left to preview its label.</EmptyState>
        )}
      </Card>
    </div>
  );
}

// ── Scan Tab ──────────────────────────────────────────────────────────────────

function ScanTab({ onLogged }) {
  const dispatch = useDispatch();
  const [input, setInput]       = useState('');
  const [result, setResult]     = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleScan = async e => {
    e.preventDefault();
    if (!input.trim()) return;
    setScanning(true);
    setResult(null);
    setNotFound(false);
    const res = await dispatch(scanBarcode({ barcodeValue: input.trim() }));
    setScanning(false);
    onLogged(); // scans are logged even when nothing matches
    if (scanBarcode.fulfilled.match(res)) {
      setResult(res.payload);
      toast.success(`Found: ${res.payload.productName}`);
    } else {
      setNotFound(true);
      toast.error(res.payload || 'Product not found');
    }
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {/* Scanner input */}
      <Card
        title={<span className="flex items-center gap-1.5"><ScanLine className="size-3.5 text-[color:var(--primary)]" /> Scan barcode / enter SKU</span>}
        bodyClassName="p-4"
      >
        <form onSubmit={handleScan} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Scan or type barcode / SKU…"
            className="input-field flex-1 font-mono"
            autoComplete="off"
          />
          <Button type="submit" disabled={scanning}>{scanning ? '…' : 'Scan'}</Button>
        </form>
        <p className={`mt-2 text-[12px] ${muted}`}>USB scanner auto-submits on Enter. Scan is logged automatically.</p>
      </Card>

      {/* Result */}
      {result && (
        <Card
          title={<span className="flex items-center gap-1.5 text-[color:var(--success)]"><CheckCircle className="size-3.5" /> {result.productName}</span>}
          actions={<IconButton label="Dismiss" onClick={() => setResult(null)}><X className="size-3.5" /></IconButton>}
          bodyClassName="p-3"
        >
          <div className={`mb-2 text-[12px] ${muted}`}>SKU: <span className="font-mono">{result.sku}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Stock" value={result.currentStock != null ? `${result.currentStock} ${result.unit || 'pcs'}` : '—'} />
            <Stat label="MRP" value={result.mrp ? `₹${result.mrp}` : '—'} />
            <Stat label="Batch" value={result.batchNumber || '—'} />
            <Stat label="Expiry" value={result.expiryDate ? new Date(result.expiryDate).toLocaleDateString('en-IN') : '—'} />
          </div>
        </Card>
      )}

      {notFound && (
        <div className="flex items-center gap-2 rounded-[8px] border border-[rgba(176,56,47,0.3)] bg-[color:var(--danger-bg)] px-3.5 py-3 text-[color:var(--danger)]">
          <AlertTriangle className="size-4" />
          <span className="text-[13px] font-bold">Product not found for this barcode/SKU</span>
        </div>
      )}
    </div>
  );
}

// ── Bulk Print Tab ────────────────────────────────────────────────────────────

function BulkPrintTab({ products, settings, barcodeTypes, onLogged }) {
  const dispatch = useDispatch();
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState([]); // array of { product, qty, type }
  const [barcodeType, setType]  = useState(barcodeTypes[0]?.value || 'Code128');

  const filtered = products.filter(p =>
    p.productName?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const addProduct = p => {
    if (selected.find(s => s.product.sku === p.sku)) return;
    setSelected(prev => [...prev, { product: p, qty: 1, type: barcodeType }]);
  };

  const removeProduct = sku => setSelected(prev => prev.filter(s => s.product.sku !== sku));
  const updateQty = (sku, qty) => setSelected(prev => prev.map(s => s.product.sku === sku ? { ...s, qty } : s));

  const handleBulkPrint = async () => {
    if (selected.length === 0) return toast.error('Add products first');
    if (selected.some(x => !(x.qty >= 1 && x.qty <= 500))) return toast.error('Each product needs 1–500 labels');
    const labels = selected.flatMap(({ product, qty, type }) => {
      const html = labelHtml(product, type, settings);
      return Array.from({ length: qty }, () => html);
    });
    if (!printLabels('Bulk labels', labels)) return toast.error('Allow pop-ups for this site to print labels');
    const results = await Promise.all(selected.map(({ product, qty, type }) => dispatch(logBarcodePrint({
      productId: product.productId, productName: product.productName,
      sku: product.sku, barcodeValue: product.sku, barcodeType: type, quantity: qty,
    }))));
    const failed = results.filter(r => !logBarcodePrint.fulfilled.match(r)).length;
    if (failed) toast.error(`${failed} print log(s) failed to save`);
    else toast.success(`${labels.length} labels sent to printer`);
    onLogged();
  };

  const totalLabels = selected.reduce((s, x) => s + x.qty, 0);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {/* Left: product picker */}
      <Card title="Add products">
        <div className="space-y-3 p-3">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search…" />
            <select value={barcodeType} onChange={e => setType(e.target.value)} className="input-field w-auto" aria-label="Barcode type">
              {barcodeTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Toolbar>
          {filtered.length === 0 ? (
            <EmptyState icon={Package} title="No products" />
          ) : (
            <div className="max-h-80 divide-y divide-[color:var(--border)] overflow-y-auto rounded-[8px] border border-[color:var(--border)]">
              {filtered.map(p => {
                const added = !!selected.find(s => s.product.sku === p.sku);
                return (
                  <div key={p.sku} className="flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--surface-hover)]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">{p.productName}</div>
                      <div className={`font-mono text-[12px] ${muted}`}>{p.sku}</div>
                    </div>
                    <Button size="sm" variant="secondary" className="!h-7 !px-2 !text-[12px]" disabled={added} onClick={() => addProduct(p)}>
                      {added ? <><CheckCircle className="size-3" /> Added</> : <><Plus className="size-3" /> Add</>}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Right: selected queue */}
      <Card title={`Print queue · ${selected.length} products · ${totalLabels} labels`}>
        {selected.length === 0 ? (
          <EmptyState icon={Printer} title="Queue is empty">Add products from the left.</EmptyState>
        ) : (
          <div className="space-y-3 p-3">
            <div className="grid-box max-h-64">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Product</th>
                    <th className="text-left">SKU</th>
                    <th className="text-left">Type</th>
                    <th className="text-right">Labels</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selected.map(({ product, qty, type }) => (
                    <tr key={product.sku}>
                      <td className="max-w-[200px] truncate font-bold">{product.productName}</td>
                      <td className={`font-mono text-[12px] ${muted}`}>{product.sku}</td>
                      <td className={muted}>{type}</td>
                      <td className="!py-1 text-right">
                        <input type="number" value={qty} min={1} max={500}
                          onChange={e => updateQty(product.sku, +e.target.value)}
                          className="h-7 w-16 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-2 text-center text-[12px]" />
                      </td>
                      <td className="!px-1 text-center">
                        <IconButton label="Remove" tone="danger" onClick={() => removeProduct(product.sku)}><X className="size-3.5" /></IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="w-full" onClick={handleBulkPrint}>
              <Printer className="size-3.5" /> Print all labels (A4 sheet)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ history, onLogged }) {
  const dispatch = useDispatch();
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? history : history.filter(h => h.action === filter);
  const pg = usePagination(filtered, 20);

  const handleDelete = async id => {
    const res = await dispatch(deleteBarcodeLog(id));
    if (deleteBarcodeLog.fulfilled.match(res)) { toast.success('Log deleted'); onLogged(); }
    else toast.error(res.payload || 'Failed');
  };

  return (
    <Card
      title="Scan / generate / print history"
      actions={<Segmented size="sm" options={['All', 'Scan', 'Generate', 'Print']} value={filter} onChange={setFilter} />}
      bodyClassName="p-3"
    >
      {filtered.length === 0 ? (
        <EmptyState icon={Clock} title="No history yet">Scans, generated barcodes and prints are logged here.</EmptyState>
      ) : (
        <>
          <div className="grid-box">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Time</th>
                  <th className="text-left">Action</th>
                  <th className="text-left">Product</th>
                  <th className="text-left">SKU</th>
                  <th className="text-left">Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-left">By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pg.items.map(h => (
                  <tr key={h.id}>
                    <td className={`whitespace-nowrap ${muted}`}>
                      {new Date(h.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td><Badge tone={ACTION_TONE[h.action] || 'neutral'}>{h.action}</Badge></td>
                    <td className="max-w-[150px] truncate font-bold">{h.productName}</td>
                    <td className={`font-mono text-[12px] ${muted}`}>{h.sku}</td>
                    <td className={muted}>{h.barcodeType}</td>
                    <td className="text-right">{h.quantity}</td>
                    <td className={muted}>{h.createdBy}</td>
                    <td className="!px-1 text-center">
                      <IconButton label="Delete log" tone="danger" onClick={() => handleDelete(h.id)}><Trash2 className="size-3.5" /></IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pg} noun="entries" />
        </>
      )}
    </Card>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ settings, setSettings }) {
  const fields = [
    { key: 'showLogo',    label: 'Show company logo on label' },
    { key: 'showMrp',     label: 'Show MRP on label' },
    { key: 'showBatch',   label: 'Show batch number' },
    { key: 'showMfg',     label: 'Show manufacture date' },
    { key: 'showExp',     label: 'Show expiry date' },
    { key: 'showCompany', label: 'Show company name' },
  ];

  return (
    <Card title="Label settings" className="max-w-md" bodyClassName="p-4 space-y-4">
      <Field label="Company name on label" hint="From Settings → Store details (site name).">
        <input value={settings.companyName || ''} readOnly disabled className={inp} />
      </Field>
      <div className="space-y-2">
        {fields.map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={settings[key]}
              onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
              className="size-4 rounded" />
            <span className="text-[13px] text-[color:var(--text-secondary)]">{label}</span>
          </label>
        ))}
      </div>
      <p className={`border-t border-[color:var(--border)] pt-3 text-[12px] ${muted}`}>These label options are saved in this browser.</p>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminBarcode() {
  const dispatch  = useDispatch();
  const { products, history } = useSelector(s => s.admin.barcode);
  const loading   = useSelector(s => s.admin.loading);
  const lk        = useLookups();
  const barcodeTypes = lk.list('BarcodeType').length ? lk.list('BarcodeType') : [{ value: 'Code128', label: 'Code 128' }];

  const [tab, setTab] = useState('generate');
  const [toggles, setToggles] = useState(loadToggles);
  const [companyName, setCompanyName] = useState('');
  const [stats, setStats] = useState(null);
  const settings = { ...toggles, companyName };

  const setSettings = updater => setToggles(prev => {
    const next = typeof updater === 'function' ? updater({ ...prev, companyName }) : updater;
    const { companyName: _ignored, ...rest } = next; // eslint-disable-line no-unused-vars
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest)); } catch { /* storage unavailable */ }
    return rest;
  });

  const loadStats = useCallback(async () => {
    try { const res = await api.get('/admin/barcodes/stats'); setStats(res.data.data); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not load barcode stats'); }
  }, []);

  const onLogged = useCallback(() => {
    loadStats();
    dispatch(fetchBarcodeHistory({ limit: 500 }));
  }, [dispatch, loadStats]);

  useEffect(() => {
    dispatch(fetchBarcodeProducts());
    dispatch(fetchBarcodeHistory({ limit: 500 }));
    loadStats();
    api.get('/admin/settings').then(r => setCompanyName(r.data.data?.siteName || '')).catch(() => {});
  }, [dispatch, loadStats]);

  const refresh = async () => {
    const res = await dispatch(fetchBarcodeProducts());
    onLogged();
    if (fetchBarcodeProducts.fulfilled.match(res)) toast.success('Refreshed');
    else toast.error(res.payload || 'Refresh failed');
  };

  if (loading && !products.length) return (
    <div className="space-y-6"><SkPageHeader /><SkTable rows={6} cols={5} /></div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Barcodes & scanner"
        description={`${products.length} products · ${barcodeTypes.map(t => t.label).join(', ')}`}
        actions={<Button variant="secondary" onClick={refresh}><RefreshCw className="size-3.5" /> Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Products" value={products.length} icon={Package} tone="info" />
        <Stat label="Scans today" value={stats?.scansToday ?? '—'} icon={ScanLine} tone="success" />
        <Stat label="Generated today" value={stats?.generatedToday ?? '—'} icon={QrCode} tone="accent" />
        <Stat label="Labels printed today" value={stats?.labelsPrintedToday ?? '—'} icon={Printer} tone="primary" />
      </div>

      <Tabs items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} />

      {tab === 'generate' && <GenerateTab products={products} loading={loading} settings={settings} barcodeTypes={barcodeTypes} onLogged={onLogged} />}
      {tab === 'scan'     && <ScanTab onLogged={onLogged} />}
      {tab === 'bulk'     && <BulkPrintTab products={products} settings={settings} barcodeTypes={barcodeTypes} onLogged={onLogged} />}
      {tab === 'history'  && <HistoryTab history={history} onLogged={onLogged} />}
      {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} />}
    </div>
  );
}
