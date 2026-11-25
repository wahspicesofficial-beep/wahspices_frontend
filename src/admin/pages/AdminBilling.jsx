import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAdminInvoices, generateInvoiceFromOrder, fetchInvoiceSettings,
  updateInvoiceSettings, fetchInvoiceById, createManualInvoice, updateInvoiceStatus,
  fetchAdminInventory,
} from '@/store/slices/adminSlice';
import { SkTable, SkPageHeader } from '@/components/ui/Skeleton';
import InvoiceTemplate from '@/components/InvoiceTemplate';
import toast from 'react-hot-toast';
import {
  FileText, Settings, RefreshCw, Plus, Eye, TrendingUp,
  CheckCircle, Clock, AlertCircle, ReceiptText, X,
  Download, Mail, Printer, FileJson, Image as ImageIcon, ExternalLink, CheckCircle2,
} from 'lucide-react';
import AdminModal from '@/admin/components/AdminModal';
import api from '@/services/api';
import { useLookups, lookupOptions } from '@/admin/lookups';
import {
  PageHeader, Card, Stat, Badge, Button, IconButton, Tabs, SearchInput, Toolbar,
  EmptyState, Skeleton, Pagination, DialogPanel, Field,
} from '@/admin/ui';
import { fetchFile, saveBlob, fileErrorMessage, invoiceFileName } from '@/utils/fileDownload';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',      label: 'All invoices', icon: FileText },
  { key: 'unpaid',   label: 'Unpaid',       icon: Clock },
  { key: 'paid',     label: 'Paid',         icon: CheckCircle },
  { key: 'settings', label: 'Template',     icon: Settings },
];

// Status <select> rendered as a badge-coloured pill
const STATUS_STYLES = {
  Paid:          'bg-[color:var(--success-bg)] text-[color:var(--success)]',
  Unpaid:        'bg-[color:var(--warning-bg)] text-[color:var(--warning)]',
  PartiallyPaid: 'bg-[color:var(--info-bg)] text-[color:var(--info)]',
  Overdue:       'bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
  Cancelled:     'bg-[color:var(--surface-hover)] text-[color:var(--text-muted)]',
};

// Status / invoice type / supply type / GST slab / unit / payment mode options all come from GET /admin/lookups.
const UNPAID_STATUSES = ['Unpaid', 'PartiallyPaid', 'Overdue'];

// Used only if the "PaymentMode" master-data list is empty (the server accepts free text).
const FALLBACK_PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'NetBanking', 'BankTransfer', 'Cheque', 'Credit', 'CashOnDelivery'];

// Indian GST state / UT codes — mirrors GstStates on the server (place of supply → CGST+SGST vs IGST).
const INDIAN_STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory'],
];
const squash = (v) => String(v || '').replace(/&/g, 'and').replace(/[^a-z0-9]/gi, '').toUpperCase();
/** "Gujarat" / "gujarat " / "24" / "24-Gujarat" → "24"; null when unknown. */
const stateCodeOf = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  const digits = (s.match(/^\d{1,2}/) || [])[0];
  if (digits) { const c = digits.padStart(2, '0'); if (INDIAN_STATES.some(([code]) => code === c)) return c; }
  return INDIAN_STATES.find(([, name]) => squash(name) === squash(s))?.[0] || null;
};
const stateNameOf = (v) => INDIAN_STATES.find(([code]) => code === stateCodeOf(v))?.[1] || null;
const sameState = (a, b) => {
  if (!String(a || '').trim() || !String(b || '').trim()) return true;
  const ca = stateCodeOf(a), cb = stateCodeOf(b);
  return ca && cb ? ca === cb : squash(a) === squash(b);
};

const MAX_IMAGE_BYTES = 300 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** "Sent 2 times, last to a@b.com on 16 Nov 2026" */
const sentSummary = (inv) => {
  const n = Number(inv?.sentCount || 0);
  if (!n) return 'Not emailed yet';
  return `Sent ${n} time${n === 1 ? '' : 's'}${inv.lastSentTo ? `, last to ${inv.lastSentTo}` : ''}${inv.lastSentAt ? ` on ${fmtDateTime(inv.lastSentAt)}` : ''}`;
};

const newItem = (lk) => {
  const slabs = lk.values('GstSlab').map(Number);
  const units = lk.values('Unit');
  return {
    productName: '', hsnCode: '', quantity: 1, unit: units.includes('pcs') ? 'pcs' : (units[0] || 'pcs'),
    unitPrice: 0, mrpPrice: 0, discountPercent: 0, gstRate: slabs.includes(18) ? 18 : (slabs[0] ?? 0),
    inventoryItemId: '', productId: null, variantId: null, _pick: '', _stock: null,
  };
};

const EMPTY_SETTINGS = {
  companyName: '', companyLogo: '', address: '', city: '', state: '', stateCode: '',
  pincode: '', phone: '', email: '', website: '', gstin: '', pan: '', fssai: '', udyamNumber: '',
  bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '', upiId: '',
  primaryColor: '#1a5c2e', invoicePrefix: '', invoiceTitle: 'Tax Invoice', numberFormat: 'FY',
  termsAndConditions: '', footerText: '', declaration: '',
  signatureImage: '', stampImage: '', authorisedSignatory: '',
  showSignature: false, showStamp: false, showHsnColumn: true, showDiscountColumn: true,
  showBankDetails: true, showUpiQr: true, showMrpColumn: false, showAmountInWords: true, showHsnSummary: true,
  autoGenerateOnOrder: true, attachPdfToEmails: true, eInvoiceEnabled: false,
};
// server values win; nulls fall back to the defaults so every input stays controlled
const withDefaults = (s) => ({ ...EMPTY_SETTINGS, ...Object.fromEntries(Object.entries(s || {}).filter(([, v]) => v != null)) });

// ── Shared primitives ─────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children, footer, wide = false, width }) => (
  <AdminModal onClose={onClose}>
    <DialogPanel title={title} onClose={onClose} footer={footer} width={width || (wide ? 'max-w-3xl' : 'max-w-lg')}>
      {children}
    </DialogPanel>
  </AdminModal>
);

const inp     = 'input-field w-full';
const cellInp = 'h-7 rounded-[4px] border bg-[color:var(--surface-elevated)] px-2 text-[12px]';
const muted   = 'text-[color:var(--text-muted)]';
const sectionLabel = 'mb-2 text-[12px] font-bold text-[color:var(--text-secondary)]';
const miniBadge = '!px-1.5 !py-0 !text-[10px]';

/** Object URL for a Blob, revoked when replaced or when the component unmounts. */
function useObjectUrl() {
  const [url, setUrl] = useState(null);
  const ref = useRef(null);
  const set = useCallback((blob) => {
    if (ref.current) URL.revokeObjectURL(ref.current);
    ref.current = blob ? URL.createObjectURL(blob) : null;
    setUrl(ref.current);
  }, []);
  useEffect(() => () => { if (ref.current) URL.revokeObjectURL(ref.current); }, []);
  return [url, set];
}

async function downloadInvoicePdf(inv) {
  const t = toast.loading('Preparing PDF…');
  try {
    const { blob, filename } = await fetchFile(`/admin/invoices/${inv.id}/pdf`);
    saveBlob(blob, filename || invoiceFileName(inv.invoiceNumber));
    toast.success('PDF downloaded', { id: t });
  } catch (err) {
    toast.error(await fileErrorMessage(err, 'Could not download the PDF'), { id: t });
  }
}

function printIframe(iframe, url) {
  try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
  catch { window.open(url, '_blank', 'noopener'); }
}

function PdfFrame({ url, loading, error, frameRef, title, className = 'h-[70vh]' }) {
  return (
    <div className={`relative overflow-hidden rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] ${className}`}>
      {url && <iframe ref={frameRef} src={url} title={title} className="size-full border-0 bg-white" />}
      {!url && (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
          {loading
            ? <><Skeleton className="block h-40 w-32" /><span className={`text-[13px] ${muted}`}>Rendering PDF…</span></>
            : <><AlertCircle className="size-6 text-[color:var(--danger)]" /><span className="text-[13px] text-[color:var(--text-secondary)]">{error || 'PDF not available'}</span></>}
        </div>
      )}
    </div>
  );
}

// ── PDF preview dialog (template preview) ─────────────────────────────────────

function PdfPreviewDialog({ url, title, onClose, filename }) {
  const frameRef = useRef(null);
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-4xl"
      footer={<>
        <Button variant="secondary" onClick={() => printIframe(frameRef.current, url)}><Printer className="size-3.5" /> Print</Button>
        <Button variant="secondary" onClick={() => { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); }}><Download className="size-3.5" /> Download</Button>
        <Button onClick={onClose}>Close</Button>
      </>}
    >
      <PdfFrame url={url} frameRef={frameRef} title={title} />
    </Modal>
  );
}

// ── Image (logo / signature / stamp) field: upload as data URL or paste a URL ──

function ImageField({ label, value, onChange, hint }) {
  const fileRef = useRef(null);
  const isData = String(value || '').startsWith('data:');
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) { toast.error('Use a PNG or JPG image'); return; }
    if (f.size > MAX_IMAGE_BYTES) { toast.error(`${f.name} is ${Math.round(f.size / 1024)} KB — max ${MAX_IMAGE_BYTES / 1024} KB. Crop or compress it first.`); return; }
    const r = new FileReader();
    r.onload = () => onChange(String(r.result || ''));
    r.onerror = () => toast.error('Could not read the image');
    r.readAsDataURL(f);
  };
  return (
    <div>
      <span className="mb-1 block text-[12px] font-bold text-[color:var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[color:var(--border)] bg-white">
          {value ? <img src={value} alt={label} className="max-h-12 max-w-[88px] object-contain" /> : <ImageIcon className={`size-5 ${muted}`} />}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            value={isData ? '' : (value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isData ? 'Uploaded image (paste a URL to replace)' : 'https://… or upload'}
            className={inp}
            aria-label={`${label} URL`}
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" className="!h-7" onClick={() => fileRef.current?.click()}>Upload</Button>
            {value && <Button size="sm" variant="tertiary" className="!h-7" onClick={() => onChange('')}>Remove</Button>}
          </div>
        </div>
      </div>
      <span className="mt-1 block text-[12px] text-[color:var(--text-muted)]">{hint || `PNG or JPG, up to ${MAX_IMAGE_BYTES / 1024} KB`}</span>
      <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={onFile} />
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="block text-[13px] text-[color:var(--text-secondary)]">{label}</span>
        {hint && <span className={`block text-[11px] ${muted}`}>{hint}</span>}
      </span>
    </label>
  );
}

// ── Invoice Settings ──────────────────────────────────────────────────────────

const fyLabel = () => {
  const d = new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
};

function SettingsPanel({ settings, onSave }) {
  const [form, setForm] = useState(() => withDefaults(settings));
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useObjectUrl();
  // editing the state clears the derived GST code (the server fills it from the state); editing the code sets the state
  const f = (k, v) => setForm(p => ({ ...p, [k]: v, ...(k === 'state' ? { stateCode: '' } : {}) }));

  useEffect(() => { if (settings) setForm(withDefaults(settings)); }, [settings]);

  const handleSave = async () => {
    if (!form.companyName?.trim()) { toast.error('Company name is required'); return; }
    if (!form.invoicePrefix?.trim()) { toast.error('Invoice prefix is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  // Renders a sample invoice with the CURRENT (unsaved) form
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { blob } = await fetchFile('/admin/invoices/settings/preview', { method: 'post', data: form });
      setPreviewUrl(blob);
    } catch (err) {
      toast.error(await fileErrorMessage(err, 'Could not render the preview'));
    }
    setPreviewing(false);
  };

  // Pull name / contact / GSTIN / FSSAI / Udyam from Settings → Store details (GET /admin/settings)
  const copyFromStore = async () => {
    setCopying(true);
    try {
      const res = await api.get('/admin/settings');
      const s = res.data?.data || {};
      setForm(p => ({
        ...p,
        companyName: s.siteName    || p.companyName,
        email:       s.email       || p.email,
        phone:       s.phone       || p.phone,
        address:     s.address     || p.address,
        gstin:       s.gstin || s.gst || p.gstin,
        fssai:       s.fssai       || p.fssai,
        udyamNumber: s.udyamNumber || p.udyamNumber,
      }));
      toast.success('Copied from store settings — review and save');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not load store settings');
    }
    setCopying(false);
  };

  const text = (key, label, props = {}) => (
    <Field key={key} label={label} required={key === 'companyName' || key === 'invoicePrefix'} hint={props.hint}>
      <input value={form[key] || ''} onChange={e => f(key, e.target.value)} className={inp} placeholder={props.placeholder} />
    </Field>
  );
  const prefix = (form.invoicePrefix || 'WAH').trim();
  const numberExample = form.numberFormat === 'Year' ? `${prefix}/${new Date().getFullYear()}/001` : `${prefix}/${fyLabel()}/001`;

  return (
    <div className="space-y-4">
      <Card
        title="Company & template settings"
        actions={<>
          <Button size="sm" variant="secondary" className="!h-7" onClick={copyFromStore} loading={copying}>Copy from store settings</Button>
          <Button size="sm" variant="secondary" className="!h-7" onClick={handlePreview} loading={previewing}><Eye className="size-3.5" /> Preview PDF</Button>
        </>}
        bodyClassName="p-4 space-y-5"
      >
        {/* Company */}
        <div>
          <p className={sectionLabel}>Company</p>
          <div className="grid grid-cols-2 gap-3">
            {text('companyName', 'Company Name')}
            {text('address', 'Address')}
            {text('city', 'City')}
            <Field label="State" hint="Decides CGST+SGST vs IGST on every invoice">
              <select value={stateNameOf(form.state) || form.state || ''} onChange={e => f('state', e.target.value)} className={inp}>
                <option value="">— Select state —</option>
                {form.state && !stateNameOf(form.state) && <option value={form.state}>{form.state}</option>}
                {INDIAN_STATES.map(([code, name]) => <option key={code} value={name}>{code} · {name}</option>)}
              </select>
            </Field>
            {text('stateCode', 'GST state code', { hint: 'Leave blank to fill from the state' })}
            {text('pincode', 'Pincode')}
            {text('phone', 'Phone')}
            {text('email', 'Email')}
            {text('website', 'Website')}
          </div>
        </div>

        {/* Registration */}
        <div>
          <p className={sectionLabel}>Tax & registration</p>
          <div className="grid grid-cols-2 gap-3">
            {text('gstin', 'GSTIN')}
            {text('pan', 'PAN')}
            {text('fssai', 'FSSAI No.')}
            {text('udyamNumber', 'Udyam (MSME) No.', { placeholder: 'UDYAM-GJ-00-0000000' })}
          </div>
        </div>

        {/* Bank & payment */}
        <div>
          <p className={sectionLabel}>Bank & payment</p>
          <div className="grid grid-cols-2 gap-3">
            {text('bankName', 'Bank Name')}
            {text('bankAccount', 'Account No.')}
            {text('bankIfsc', 'IFSC')}
            {text('bankBranch', 'Branch')}
            {text('upiId', 'UPI ID', { placeholder: 'wahspices@okaxis', hint: 'Shown as a scan-to-pay QR on unpaid invoices' })}
          </div>
        </div>

        {/* Numbering & title */}
        <div>
          <p className={sectionLabel}>Invoice title & numbering</p>
          <div className="grid grid-cols-2 gap-3">
            {text('invoiceTitle', 'Invoice title', { placeholder: 'Tax Invoice' })}
            {text('invoicePrefix', 'Invoice Prefix')}
            <Field label="Number format" hint={`Next numbers look like ${numberExample}`}>
              <select value={form.numberFormat || 'FY'} onChange={e => f('numberFormat', e.target.value)} className={inp}>
                <option value="FY">Financial year (April–March) · {prefix}/{fyLabel()}/001</option>
                <option value="Year">Calendar year · {prefix}/{new Date().getFullYear()}/001</option>
              </select>
            </Field>
            <Field label="Brand colour">
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor || '#1a5c2e'} onChange={e => f('primaryColor', e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-[6px] border border-[color:var(--border)]" />
                <input value={form.primaryColor || ''} onChange={e => f('primaryColor', e.target.value)} className={`${inp} flex-1`} />
              </div>
            </Field>
          </div>
        </div>

        {/* Branding images */}
        <div>
          <p className={sectionLabel}>Logo, signature & stamp</p>
          <div className="grid grid-cols-2 gap-4">
            <ImageField label="Logo" value={form.companyLogo} onChange={v => f('companyLogo', v)} />
            {text('authorisedSignatory', 'Authorised signatory', { placeholder: 'Name printed under the signature' })}
            <ImageField label="Signature" value={form.signatureImage} onChange={v => f('signatureImage', v)} hint={`Transparent PNG works best · up to ${MAX_IMAGE_BYTES / 1024} KB`} />
            <ImageField label="Stamp / seal" value={form.stampImage} onChange={v => f('stampImage', v)} hint={`Transparent PNG works best · up to ${MAX_IMAGE_BYTES / 1024} KB`} />
          </div>
        </div>

        {/* Texts */}
        <div className="space-y-3">
          <p className={`${sectionLabel} !mb-0`}>Printed text</p>
          <Field label="Declaration">
            <textarea value={form.declaration || ''} onChange={e => f('declaration', e.target.value)} rows={2} className={`${inp} resize-none`}
              placeholder="We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct." />
          </Field>
          <Field label="Terms & conditions">
            <textarea value={form.termsAndConditions || ''} onChange={e => f('termsAndConditions', e.target.value)}
              rows={3} className={`${inp} resize-none`} />
          </Field>
          <Field label="Footer text">
            <input value={form.footerText || ''} onChange={e => f('footerText', e.target.value)} className={inp} />
          </Field>
        </div>

        {/* Layout toggles */}
        <div>
          <p className={sectionLabel}>Show on the invoice</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
            {[
              ['showHsnColumn', 'HSN column'], ['showDiscountColumn', 'Discount column'], ['showMrpColumn', 'MRP column'],
              ['showHsnSummary', 'HSN-wise tax summary'], ['showAmountInWords', 'Amount in words'], ['showBankDetails', 'Bank details'],
              ['showUpiQr', 'UPI pay QR (unpaid invoices)'], ['showSignature', 'Signature'], ['showStamp', 'Stamp'],
            ].map(([key, label]) => <Toggle key={key} checked={form[key]} onChange={v => f(key, v)} label={label} />)}
          </div>
        </div>

        {/* Automation */}
        <div>
          <p className={sectionLabel}>Automation & e-invoicing</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Toggle checked={form.autoGenerateOnOrder} onChange={v => f('autoGenerateOnOrder', v)} label="Auto-generate on order"
              hint="When a COD order is placed or an online order is paid" />
            <Toggle checked={form.attachPdfToEmails} onChange={v => f('attachPdfToEmails', v)} label="Attach PDF to order emails"
              hint="Customers get the invoice PDF with their order email" />
            <Toggle checked={form.eInvoiceEnabled} onChange={v => f('eInvoiceEnabled', v)} label="e-Invoice (IRN)"
              hint="Shows the IRN / QR section on invoices and in the invoice view" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--border)] pt-3">
          <Button variant="secondary" onClick={handlePreview} loading={previewing}><Eye className="size-3.5" /> Preview PDF</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save template settings'}</Button>
        </div>
      </Card>

      {previewUrl && (
        <PdfPreviewDialog url={previewUrl} title="Invoice preview (unsaved settings)" filename="Invoice-preview.pdf" onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}

// ── Email dialog ──────────────────────────────────────────────────────────────

function EmailDialog({ invoice, onClose, onSent }) {
  const [email, setEmail] = useState(invoice.customerEmail || invoice.lastSentTo || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const to = email.trim();
    if (!EMAIL_RE.test(to)) { toast.error('Enter a valid email address'); return; }
    setSending(true);
    try {
      await api.post(`/admin/invoices/${invoice.id}/send`, { via: 'email', email: to, ...(message.trim() ? { message: message.trim() } : {}) }, { timeout: 60000 });
      toast.success(`Invoice ${invoice.invoiceNumber} emailed to ${to}`);
      onSent?.({ id: invoice.id, lastSentAt: new Date().toISOString(), lastSentTo: to, sentCount: Number(invoice.sentCount || 0) + 1 });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || (err.code === 'ECONNABORTED' ? 'The server took too long — check the email log before retrying' : 'Failed to send the email'));
    }
    setSending(false);
  };

  return (
    <Modal
      title={`Email invoice ${invoice.invoiceNumber}`}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={send} loading={sending}><Mail className="size-3.5" /> Send email</Button>
      </>}
    >
      <div className="space-y-3">
        <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2 text-[12px] text-[color:var(--text-secondary)]">
          {sentSummary(invoice)}
        </div>
        <Field label="Send to" required hint="The invoice PDF is attached to the email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inp} autoFocus placeholder="customer@example.com"
            onKeyDown={e => e.key === 'Enter' && send()} />
        </Field>
        <Field label="Message (optional)">
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={1000} className={`${inp} resize-none`}
            placeholder="Thank you for your purchase! Please find your invoice attached." />
        </Field>
      </div>
    </Modal>
  );
}

// ── e-Invoice (IRN) panel ─────────────────────────────────────────────────────

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function EInvoicePanel({ invoice, onSaved }) {
  const init = (inv) => ({ irn: inv.irn || '', ackNo: inv.irnAckNo || '', ackDate: toLocalInput(inv.irnAckDate), signedQrCode: inv.signedQrCode || '' });
  const [form, setForm] = useState(() => init(invoice));
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { setForm(init(invoice)); }, [invoice]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        irn: form.irn.trim(), ackNo: form.ackNo.trim(),
        ackDate: form.ackDate ? new Date(form.ackDate).toISOString() : '',
        signedQrCode: form.signedQrCode.trim(),
      };
      const res = await api.put(`/admin/invoices/${invoice.id}/e-invoice`, body);
      toast.success(body.irn ? 'e-Invoice details saved' : 'e-Invoice details cleared');
      onSaved(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save e-invoice details');
    }
    setSaving(false);
  };

  const exportJson = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await fetchFile(`/admin/invoices/${invoice.id}/e-invoice.json`);
      saveBlob(blob, filename || invoiceFileName(invoice.invoiceNumber, 'json').replace(/^Invoice-/, 'EInvoice-'));
    } catch (err) {
      toast.error(await fileErrorMessage(err, 'Could not build the e-invoice JSON'));
    }
    setExporting(false);
  };

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-2.5 rounded-[8px] border border-[color:var(--border)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-[color:var(--text-primary)]">e-Invoice (IRN)</p>
        {invoice.irn ? <Badge tone="success" className={miniBadge}>IRN set</Badge> : <Badge className={miniBadge}>No IRN</Badge>}
      </div>
      <p className={`text-[11px] ${muted}`}>Download the JSON, upload it on the IRP portal, then paste the IRN, Ack No/Date and signed QR here.</p>
      <Button size="sm" variant="secondary" className="w-full" onClick={exportJson} loading={exporting}><FileJson className="size-3.5" /> Download e-invoice JSON</Button>
      <Field label="IRN"><input value={form.irn} onChange={set('irn')} className={`${inp} font-mono text-[11px]`} placeholder="64-character IRN" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ack No"><input value={form.ackNo} onChange={set('ackNo')} className={inp} /></Field>
        <Field label="Ack date"><input type="datetime-local" value={form.ackDate} onChange={set('ackDate')} className={inp} /></Field>
      </div>
      <Field label="Signed QR code">
        <textarea value={form.signedQrCode} onChange={set('signedQrCode')} rows={3} className={`${inp} resize-none font-mono text-[11px]`} placeholder="Signed QR (JWT) from the IRP" />
      </Field>
      <Button size="sm" className="w-full" onClick={save} loading={saving}>Save e-invoice details</Button>
    </div>
  );
}

// ── View invoice dialog (server PDF) ──────────────────────────────────────────

function ViewInvoiceDialog({ invoice, settings, onClose, onEmail, onUpdated, lk }) {
  const frameRef = useRef(null);
  const [pdfUrl, setPdfBlob] = useObjectUrl();
  const [pdf, setPdf] = useState({ blob: null, filename: null, loading: true, error: null });
  const [version, setVersion] = useState(0);
  const [classic, setClassic] = useState(false);

  useEffect(() => {
    let alive = true;
    setPdf(p => ({ ...p, loading: true, error: null }));
    fetchFile(`/admin/invoices/${invoice.id}/pdf`, { params: { inline: true } })
      .then(({ blob, filename }) => { if (!alive) return; setPdfBlob(blob); setPdf({ blob, filename, loading: false, error: null }); })
      .catch(async (err) => { const msg = await fileErrorMessage(err, 'Could not load the PDF'); if (alive) { setPdfBlob(null); setPdf({ blob: null, filename: null, loading: false, error: msg }); } });
    return () => { alive = false; };
  }, [invoice.id, version, setPdfBlob]);

  const download = () => {
    if (pdf.blob) saveBlob(pdf.blob, pdf.filename || invoiceFileName(invoice.invoiceNumber));
    else downloadInvoicePdf(invoice);
  };

  const rows = [
    ['Customer', invoice.customerName],
    ['Email', invoice.customerEmail],
    ['Phone', invoice.customerPhone],
    ['GSTIN', invoice.customerGstin],
    ['Invoice date', fmtDate(invoice.invoiceDate || invoice.createdAt)],
    ['Order', invoice.orderNumber],
    ['Place of supply', invoice.placeOfSupply],
    ['Supply', invoice.gstType && lk.label('GstSupplyType', invoice.gstType)],
    ['Payment', invoice.paymentMethod],
    ['Total', money(invoice.totalAmount)],
  ].filter(([, v]) => v);

  return (
    <>
      <Modal
        title={`Invoice ${invoice.invoiceNumber}`}
        onClose={onClose}
        width="max-w-6xl"
        footer={<>
          <Button variant="tertiary" className="mr-auto" onClick={() => setClassic(true)} title="Old HTML view (also has WhatsApp share)"><ExternalLink className="size-3.5" /> Classic view</Button>
          <Button variant="secondary" onClick={() => pdfUrl && printIframe(frameRef.current, pdfUrl)} disabled={!pdfUrl}><Printer className="size-3.5" /> Print</Button>
          <Button variant="secondary" onClick={() => onEmail(invoice)}><Mail className="size-3.5" /> Email</Button>
          <Button onClick={download}><Download className="size-3.5" /> Download PDF</Button>
        </>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <PdfFrame url={pdfUrl} loading={pdf.loading} error={pdf.error} frameRef={frameRef} title={`Invoice ${invoice.invoiceNumber}`} />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={statusTone(invoice.status)}>{lk.label('InvoiceStatus', invoice.status)}</Badge>
              <Badge tone={invoice.type === 'B2B' ? 'accent' : 'neutral'}>{lk.label('InvoiceType', invoice.type)}</Badge>
              {invoice.source && <Badge tone={invoice.source === 'Offline' ? 'warning' : 'info'}>{invoice.source}</Badge>}
            </div>
            <dl className="space-y-1 text-[12px]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className={muted}>{k}</dt>
                  <dd className="text-right font-bold text-[color:var(--text-primary)]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-start gap-1.5 rounded-[6px] bg-[color:var(--surface-secondary)] px-2.5 py-2 text-[12px] text-[color:var(--text-secondary)]">
              <Mail className="mt-0.5 size-3.5 shrink-0" /> {sentSummary(invoice)}
            </div>
            {settings?.eInvoiceEnabled && (
              <EInvoicePanel invoice={invoice} onSaved={(inv) => { if (inv) onUpdated(inv); setVersion(v => v + 1); }} />
            )}
          </div>
        </div>
      </Modal>
      {/* InvoiceTemplate is a printable document: keep its own styling */}
      {classic && <div className="no-grid"><InvoiceTemplate invoice={invoice} onClose={() => setClassic(false)} /></div>}
    </>
  );
}

const statusTone = (status) => ({ Paid: 'success', Unpaid: 'warning', PartiallyPaid: 'info', Overdue: 'danger' }[status] || 'neutral');

// ── Create Manual (offline) Invoice Modal ─────────────────────────────────────

function CreateInvoiceModal({ onClose, onCreated, onView, onEmail, inventoryItems = [], settings, lk }) {
  const dispatch = useDispatch();
  const invoiceTypes = lk.list('InvoiceType');
  const supplyTypes  = lk.list('GstSupplyType');
  const paymentModes = lk.list('PaymentMode').length ? lk.list('PaymentMode') : FALLBACK_PAYMENT_METHODS.map(v => ({ value: v, label: v }));
  const companyState = settings?.state || '';
  const [form, setForm] = useState(() => ({
    customerName: '', customerEmail: '', customerPhone: '', customerGstin: '',
    type: invoiceTypes[0]?.value || 'B2C',
    placeOfSupply: stateNameOf(companyState) || '',
    overrideGst: false, gstType: supplyTypes[0]?.value || 'IntraState',
    billingAddress: '',
    invoiceDate: todayIso(),
    status: 'Paid', paymentMethod: paymentModes[0]?.value || 'Cash',
    sendEmail: false,
    deliveryCharge: 0, notes: '',
  }));
  const [items, setItems] = useState(() => [newItem(lk)]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [created, setCreated] = useState(null);

  // Store catalog for the product picker (prices there INCLUDE GST)
  useEffect(() => {
    let alive = true;
    api.get('/admin/products', { params: { limit: 500 } })
      .then(res => { const d = res.data?.data; if (alive) setProducts(Array.isArray(d) ? d : (d?.items || [])); })
      .catch(() => { /* picker just stays empty — manual entry still works */ });
    return () => { alive = false; };
  }, []);

  const setF       = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addItem    = () => setItems(p => [...p, newItem(lk)]);
  const removeItem = i => setItems(p => p.filter((_, j) => j !== i));
  // Typing an HSN that is in the HSN master fills its GST rate (the server bills at that rate too)
  const setItem    = (i, k, v) => setItems(p => p.map((it, j) => {
    if (j !== i) return it;
    const next = { ...it, [k]: v };
    if (k === 'hsnCode') { const hit = lk.resolveHsn(v); if (hit) next.gstRate = Number(hit.gstRate); }
    return next;
  }));

  const pickInventoryItem = (i, invId) => {
    const invItem = inventoryItems.find(inv => inv.id === Number(invId));
    setItems(p => p.map((it, j) => j !== i ? it : {
      ...it,
      inventoryItemId: invId,
      productId:       invItem ? invItem.productId : it.productId,
      productName:     invItem && !it._pick ? invItem.productName : it.productName,
      unit:            invItem?.unit || it.unit,
      _stock:          invItem ? invItem.currentStock : null,
    }));
  };

  // product → pack size: fills name "Garam Masala 100g", HSN, GST %, rate ex-GST and MRP
  const pickProduct = (i, key) => {
    if (!key) { setItem(i, '_pick', ''); return; }
    const [pid, vid] = key.split(':').map(Number);
    const p = products.find(x => x.id === pid);
    if (!p) return;
    const v = (p.variants || []).find(x => x.id === vid) || { id: null, weight: p.weight, price: p.price, mrp: p.mrp };
    const gst = Number(p.gstRate ?? 0);
    setItems(prev => prev.map((it, j) => j !== i ? it : {
      ...it,
      _pick:       key,
      productId:   p.id,
      variantId:   v.id || null,
      productName: [p.name, v.weight].filter(Boolean).join(' '),
      hsnCode:     p.hsnCode || it.hsnCode,
      gstRate:     lk.resolveHsn(p.hsnCode || it.hsnCode) ? Number(lk.resolveHsn(p.hsnCode || it.hsnCode).gstRate) : gst,
      unitPrice:   round2(Number(v.price || 0) / (1 + gst / 100)),
      mrpPrice:    Number(v.mrp || v.price || 0),
    }));
  };

  // B2B: the GSTIN's first two digits are the customer's state code
  const setGstin = (v) => setForm(p => {
    const code = /^\d{2}/.test(v.trim()) ? stateCodeOf(v.trim().slice(0, 2)) : null;
    return { ...p, customerGstin: v, ...(code ? { placeOfSupply: stateNameOf(code) } : {}) };
  });

  const intra = sameState(companyState, form.placeOfSupply);
  const derivedGst = intra ? 'IntraState' : 'InterState';

  const lineTotal  = it => {
    const gross = Number(it.unitPrice || 0) * Number(it.quantity || 0);
    const d = gross * Number(it.discountPercent || 0) / 100;
    return (gross - d) * (1 + Number(it.gstRate || 0) / 100);
  };
  const grandTotal = items.reduce((s, it) => s + lineTotal(it), 0) + Number(form.deliveryCharge || 0);
  const emailOk = EMAIL_RE.test(form.customerEmail.trim());

  const handleCreate = async () => {
    if (!form.customerName.trim()) { toast.error('Customer name required'); return; }
    if (form.type === 'B2B' && !form.customerGstin.trim()) { toast.error('Customer GSTIN is required for a B2B invoice'); return; }
    if (form.customerEmail.trim() && !emailOk) { toast.error('Customer email looks invalid'); return; }
    if (Number(form.deliveryCharge) < 0) { toast.error('Delivery charge cannot be negative'); return; }
    if (form.invoiceDate && form.invoiceDate > todayIso()) { toast.error('Invoice date cannot be in the future'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }

    // Validate every row
    for (const [i, it] of items.entries()) {
      const row = `Row ${i + 1}`;
      if (!String(it.productName || '').trim()) { toast.error(`${row}: product name is required`); return; }
      if (!(Number(it.quantity) > 0) || !Number.isInteger(Number(it.quantity))) { toast.error(`${row} (${it.productName}): quantity must be a whole number above 0`); return; }
      if (it.unitPrice === '' || Number.isNaN(Number(it.unitPrice)) || Number(it.unitPrice) < 0) { toast.error(`${row} (${it.productName}): rate must be 0 or more`); return; }
      if (Number(it.discountPercent) < 0 || Number(it.discountPercent) > 100) { toast.error(`${row} (${it.productName}): discount must be 0–100%`); return; }
    }

    // Stock validation (rows that use the same inventory item are added up)
    const needed = {};
    for (const it of items) if (it.inventoryItemId) needed[it.inventoryItemId] = (needed[it.inventoryItemId] || 0) + Number(it.quantity);
    for (const [invId, qty] of Object.entries(needed)) {
      const inv = inventoryItems.find(x => x.id === Number(invId));
      if (inv && qty > Number(inv.currentStock)) {
        toast.error(`Insufficient stock for "${inv.productName}". Available: ${inv.currentStock}, Required: ${qty}`);
        return;
      }
    }

    setLoading(true);
    const invoiceItems = items.map(({ _stock, _pick, inventoryItemId, productId, variantId, ...rest }) => ({
      ...rest,
      productName:     rest.productName.trim(),
      quantity:        Number(rest.quantity),
      unitPrice:       Number(rest.unitPrice),
      mrpPrice:        Number(rest.mrpPrice) || 0,
      discountPercent: Number(rest.discountPercent) || 0,
      gstRate:         Number(rest.gstRate),
      ...(productId ? { productId } : {}),
      ...(variantId ? { variantId } : {}),
      ...(inventoryItemId ? { inventoryItemId: Number(inventoryItemId) } : {}),
    }));

    const { overrideGst, gstType, sendEmail, billingAddress, placeOfSupply, ...rest } = form;
    const body = {
      ...rest,
      customerName:  rest.customerName.trim(),
      customerEmail: rest.customerEmail.trim(),
      deliveryCharge: Number(form.deliveryCharge) || 0,
      ...(placeOfSupply ? { placeOfSupply } : {}),
      ...(overrideGst ? { gstType } : {}),         // otherwise the server derives it from place of supply
      ...(billingAddress.trim() ? { billingAddress: billingAddress.trim(), shippingAddress: billingAddress.trim() } : {}),
      sendEmail: !!(sendEmail && emailOk),
      items: invoiceItems,
    };
    const res = await dispatch(createManualInvoice(body));

    if (createManualInvoice.fulfilled.match(res)) {
      const parts = ['Invoice created'];
      if (Object.keys(needed).length) parts.push('stock deducted');
      if (body.sendEmail) parts.push(`emailed to ${body.customerEmail}`);
      toast.success(`${parts.join(' — ')}.`);
      setCreated(res.payload);
      onCreated(res.payload);
    } else {
      toast.error(res.payload || 'Failed to create invoice');
    }
    setLoading(false);
  };

  // ── Success step: offer the PDF right away ──
  if (created) {
    return (
      <Modal
        title="Invoice created"
        onClose={onClose}
        footer={<>
          <Button variant="secondary" onClick={() => { setCreated(null); setItems([newItem(lk)]); setForm(p => ({ ...p, customerName: '', customerEmail: '', customerPhone: '', customerGstin: '', billingAddress: '', notes: '', sendEmail: false })); }}>
            <Plus className="size-3.5" /> Create another
          </Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>}
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 className="size-10 text-[color:var(--success)]" />
          <div>
            <p className="font-mono text-[15px] font-bold text-[color:var(--primary)]">{created.invoiceNumber}</p>
            <p className={`text-[13px] ${muted}`}>{created.customerName} · {money(created.totalAmount)}</p>
            {Number(created.sentCount) > 0 && <p className="mt-1 text-[12px] text-[color:var(--success)]">{sentSummary(created)}</p>}
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button onClick={() => downloadInvoicePdf(created)}><Download className="size-3.5" /> Download PDF</Button>
            <Button variant="secondary" onClick={() => onView(created)}><Eye className="size-3.5" /> View</Button>
            <Button variant="secondary" onClick={() => onEmail(created)}><Mail className="size-3.5" /> Email</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Create invoice (offline / walk-in / phone order)"
      onClose={onClose}
      width="max-w-5xl"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} disabled={loading}>{loading ? 'Creating…' : 'Create invoice'}</Button>
      </>}
    >
      <div className="space-y-4">
        {/* Customer */}
        <div>
          <p className={sectionLabel}>Customer details</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Customer name" required>
              <input className={inp} value={form.customerName} onChange={e => setF('customerName', e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" className={inp} value={form.customerEmail} onChange={e => setForm(p => ({ ...p, customerEmail: e.target.value, sendEmail: EMAIL_RE.test(e.target.value.trim()) ? p.sendEmail : false }))} />
            </Field>
            <Field label="Phone">
              <input className={inp} value={form.customerPhone} onChange={e => setF('customerPhone', e.target.value)} />
            </Field>
            <Field label="Invoice type">
              <select className={inp} value={form.type} onChange={e => setF('type', e.target.value)}>
                {lookupOptions(invoiceTypes, form.type).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label={form.type === 'B2B' ? 'GSTIN' : 'GSTIN (B2B only)'} required={form.type === 'B2B'}>
              <input className={`${inp} uppercase`} value={form.customerGstin} onChange={e => setGstin(e.target.value.toUpperCase())} maxLength={15} />
            </Field>
            <Field
              label="Customer state (place of supply)"
              hint={form.overrideGst ? 'GST type set manually' : `${intra ? 'Same state → CGST + SGST' : 'Other state → IGST'}${companyState ? ` (you: ${companyState})` : ''}`}
            >
              <select className={inp} value={form.placeOfSupply} onChange={e => setF('placeOfSupply', e.target.value)}>
                <option value="">Not specified (same state)</option>
                {INDIAN_STATES.map(([code, name]) => <option key={code} value={name}>{code} · {name}</option>)}
              </select>
            </Field>
            <Field label="Billing address" className="col-span-2">
              <input className={inp} value={form.billingAddress} onChange={e => setF('billingAddress', e.target.value)} placeholder="Optional — printed on the invoice" />
            </Field>
            <div>
              <Toggle checked={form.overrideGst} onChange={v => setForm(p => ({ ...p, overrideGst: v, gstType: v ? derivedGst : p.gstType }))} label="Override GST type" />
              {form.overrideGst && (
                <select className={`${inp} mt-1.5`} value={form.gstType} onChange={e => setF('gstType', e.target.value)} aria-label="GST type">
                  {lookupOptions(supplyTypes, form.gstType).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Invoice & payment */}
        <div>
          <p className={sectionLabel}>Invoice & payment</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Invoice date">
              <input type="date" className={inp} value={form.invoiceDate} max={todayIso()} onChange={e => setF('invoiceDate', e.target.value)} />
            </Field>
            <Field label="Payment status">
              <select className={inp} value={form.status} onChange={e => setF('status', e.target.value)}>
                {['Paid', 'Unpaid'].map(s => <option key={s} value={s}>{lk.label('InvoiceStatus', s)}</option>)}
              </select>
            </Field>
            <Field label={form.status === 'Paid' ? 'Paid via' : 'Payment method'}>
              <select className={inp} value={form.paymentMethod} onChange={e => setF('paymentMethod', e.target.value)}>
                {lookupOptions(paymentModes, form.paymentMethod).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className={`${sectionLabel} !mb-0`}>Items <span className={`font-normal ${muted}`}>· rates exclude GST (catalog prices are converted automatically)</span></p>
            <Button size="sm" variant="tertiary" onClick={addItem}><Plus className="size-3.5" /> Add row</Button>
          </div>
          <div className="grid-box overflow-x-auto">
            <datalist id="bill-hsn-codes">{lk.hsnCodes.map(h => <option key={h.code} value={h.code}>{`${h.gstRate}% — ${h.description}`}</option>)}</datalist>
            <table>
              <thead>
                <tr>
                  <th className="text-left">Product / inventory *</th>
                  <th className="text-left">HSN</th>
                  <th className="text-left">Qty</th>
                  <th className="text-left">Unit</th>
                  <th className="text-left">Rate ex-GST (₹) *</th>
                  <th className="text-left">MRP (₹)</th>
                  <th className="text-left">Disc %</th>
                  <th className="text-left">GST %</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const usedQty   = it.inventoryItemId ? items.filter(x => x.inventoryItemId === it.inventoryItemId).reduce((s, x) => s + Number(x.quantity || 0), 0) : 0;
                  const stockOk   = !it.inventoryItemId || it._stock == null || usedQty <= Number(it._stock);
                  const stockText = it._stock != null ? `Stock: ${it._stock}` : null;
                  const bad = !stockOk ? 'border-[color:var(--danger)]' : 'border-[color:var(--border)]';
                  return (
                    <tr key={i}>
                      <td className="min-w-[220px] !px-1.5 !py-1">
                        {/* Catalog product → pack size */}
                        <select
                          value={it._pick || ''}
                          onChange={e => pickProduct(i, e.target.value)}
                          className={`${cellInp} mb-1 w-full border-[color:var(--border)]`}
                          aria-label="Product from catalog"
                        >
                          <option value="">— from catalog (optional) —</option>
                          {products.map(p => (
                            <optgroup key={p.id} label={p.name}>
                              {(p.variants?.length ? p.variants : [{ id: 0, weight: p.weight, price: p.price }]).map(v => (
                                <option key={`${p.id}:${v.id}`} value={`${p.id}:${v.id}`}>{p.name} {v.weight} — ₹{v.price}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {/* Inventory picker (stock deduction) */}
                        <select
                          value={it.inventoryItemId || ''}
                          onChange={e => pickInventoryItem(i, e.target.value)}
                          className={`${cellInp} mb-1 w-full border-[color:var(--border)]`}
                          aria-label="Inventory item"
                        >
                          <option value="">— deduct from inventory (optional) —</option>
                          {inventoryItems.map(inv => (
                            <option key={inv.id} value={inv.id} disabled={Number(inv.currentStock) <= 0}>{inv.productName} · {inv.sku} ({inv.currentStock} {inv.unit}{inv.location ? ` @ ${inv.location}` : ''})</option>
                          ))}
                        </select>
                        {/* Manual name */}
                        <input
                          value={it.productName}
                          onChange={e => setItem(i,'productName',e.target.value)}
                          placeholder="Product name *"
                          className={`${cellInp} w-full ${bad}`}
                        />
                        {stockText && (
                          <span className={`text-[11px] font-bold ${stockOk ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}`}>
                            {stockText}{!stockOk && ' · insufficient'}
                          </span>
                        )}
                      </td>
                      <td className="!px-1.5 !py-1"><input value={it.hsnCode} onChange={e => setItem(i,'hsnCode',e.target.value)} list="bill-hsn-codes" className={`${cellInp} w-16 border-[color:var(--border)]`} /></td>
                      <td className="!px-1.5 !py-1"><input type="number" min="1" step="1" value={it.quantity} onChange={e => setItem(i,'quantity',e.target.value === '' ? '' : +e.target.value)} className={`${cellInp} w-14 ${bad}`} /></td>
                      <td className="!px-1.5 !py-1">
                        <select value={it.unit} onChange={e => setItem(i,'unit',e.target.value)} className={`${cellInp} w-16 border-[color:var(--border)]`}>
                          {lookupOptions(lk.list('Unit'), it.unit).map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                        </select>
                      </td>
                      <td className="!px-1.5 !py-1"><input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => setItem(i,'unitPrice',e.target.value === '' ? '' : +e.target.value)} className={`${cellInp} w-20 border-[color:var(--border)]`} /></td>
                      <td className="!px-1.5 !py-1"><input type="number" min="0" step="0.01" value={it.mrpPrice} onChange={e => setItem(i,'mrpPrice',e.target.value === '' ? '' : +e.target.value)} className={`${cellInp} w-16 border-[color:var(--border)]`} /></td>
                      <td className="!px-1.5 !py-1"><input type="number" min="0" max="100" value={it.discountPercent} onChange={e => setItem(i,'discountPercent',+e.target.value)} className={`${cellInp} w-14 border-[color:var(--border)]`} /></td>
                      <td className="!px-1.5 !py-1">
                        <select value={it.gstRate} onChange={e => setItem(i,'gstRate',+e.target.value)} disabled={!!lk.resolveHsn(it.hsnCode)}
                          title={lk.resolveHsn(it.hsnCode) ? `GST from HSN master ${lk.resolveHsn(it.hsnCode).code}` : 'GST rate'} className={`${cellInp} w-16 border-[color:var(--border)]`}>
                          {lookupOptions(lk.list('GstSlab'), String(it.gstRate)).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="text-right font-bold text-[color:var(--primary)]">₹{lineTotal(it).toFixed(2)}</td>
                      <td className="!px-1 text-center">
                        {items.length > 1 && (
                          <IconButton label="Remove row" tone="danger" onClick={() => removeItem(i)}><X className="size-3.5" /></IconButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {items.some(it => it.inventoryItemId && it._stock != null && items.filter(x => x.inventoryItemId === it.inventoryItemId).reduce((s, x) => s + Number(x.quantity || 0), 0) > Number(it._stock)) && (
            <p className="mt-1 flex items-center gap-1 text-[12px] font-bold text-[color:var(--danger)]">
              <AlertCircle className="size-3.5" /> One or more items exceed available stock. Please reduce quantity.
            </p>
          )}
        </div>

        {/* Totals row */}
        <div className="flex items-center justify-between rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2">
          <label className="flex items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
            Delivery (₹)
            <input type="number" min="0" value={form.deliveryCharge} onChange={e => setF('deliveryCharge', e.target.value === '' ? '' : +e.target.value)} className="input-field w-24" />
          </label>
          <div className="text-right">
            <div className="text-[15px] font-bold text-[color:var(--primary)]">Grand total: ₹{grandTotal.toFixed(2)}</div>
            <div className={`text-[11px] ${muted}`}>Estimate · the server rounds off and splits {form.overrideGst ? lk.label('GstSupplyType', form.gstType) : (intra ? 'CGST + SGST' : 'IGST')}</div>
          </div>
        </div>
        <Field label="Notes">
          <input className={inp} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Optional note on invoice" />
        </Field>
        <label className={`flex items-center gap-2 ${emailOk ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
          <input type="checkbox" className="size-4" disabled={!emailOk} checked={form.sendEmail && emailOk} onChange={e => setF('sendEmail', e.target.checked)} />
          <span className="text-[13px] text-[color:var(--text-secondary)]">
            Email invoice PDF to customer after saving{!emailOk && <span className={muted}> (enter a customer email first)</span>}
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ── Generate from Order Modal ─────────────────────────────────────────────────

function GenerateModal({ onClose, onGenerated }) {
  const dispatch = useDispatch();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!orderId || Number(orderId) <= 0) { toast.error('Enter an Order ID'); return; }
    setLoading(true);
    const res = await dispatch(generateInvoiceFromOrder(Number(orderId)));
    setLoading(false);
    if (generateInvoiceFromOrder.fulfilled.match(res)) { toast.success('Invoice generated!'); onGenerated(res.payload); }
    else toast.error(res.payload || 'Failed to generate invoice');
  };

  return (
    <Modal
      title="Generate invoice from order"
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleGenerate} disabled={loading}>{loading ? 'Generating…' : 'Generate'}</Button>
      </>}
    >
      <p className={`mb-4 text-[13px] ${muted}`}>Creates a GST invoice (CGST/SGST breakdown, prices treated as GST-inclusive) from a website order. If the order already has an invoice, that invoice is opened instead.</p>
      <Field label="Order ID (numeric id from the Orders page)" required>
        <input type="number" value={orderId} onChange={e => setOrderId(e.target.value)} autoFocus
          placeholder="e.g. 42" className={inp} onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
      </Field>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminBilling() {
  const dispatch        = useDispatch();
  const lk              = useLookups();
  const { items: invoices, settings, total } = useSelector(s => s.admin.invoices);
  const inventoryItems  = useSelector(s => s.admin.inventory.items);
  const loading         = useSelector(s => s.admin.loading);

  const [tab, setTab]           = useState('all');
  const [search, setSearch]     = useState('');
  const [query, setQuery]       = useState('');          // applied search (Search button / Enter)
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [summary, setSummary]   = useState(null);
  const [viewInvoice, setViewInvoice]   = useState(null);
  const [emailFor, setEmailFor]         = useState(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  useEffect(() => {
    dispatch(fetchInvoiceSettings());
    dispatch(fetchAdminInventory({ limit: 500 }));
  }, [dispatch]);

  // Server-side status filter + paging: Paid / Unpaid tabs and the status <select> all go to the API
  const statusParam = tab === 'paid' ? 'Paid' : tab === 'unpaid' ? UNPAID_STATUSES.join(',') : (statusFilter || undefined);
  const load = useCallback(async () => {
    if (tab === 'settings') return;
    const res = await dispatch(fetchAdminInvoices({ page, limit: pageSize, search: query || undefined, status: statusParam }));
    if (!fetchAdminInvoices.fulfilled.match(res)) toast.error(res.payload || 'Failed to load invoices');
  }, [dispatch, tab, page, pageSize, query, statusParam]);
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get('/admin/invoices/summary', { params: { search: query || undefined } });
      setSummary(res.data?.data || null);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to load invoice totals'); }
  }, [query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { setPage(1); }, [tab, query, statusFilter, pageSize]);
  const reload = () => { load(); loadSummary(); };

  const handleSearch = () => { setQuery(search.trim()); if (query === search.trim()) reload(); };
  const handleReset = () => { setSearch(''); setStatusFilter(''); setQuery(''); };

  const handleView = async id => {
    const res = await dispatch(fetchInvoiceById(id));
    if (fetchInvoiceById.fulfilled.match(res)) setViewInvoice(res.payload);
    else toast.error(res.payload || 'Failed to load invoice');
  };

  const handleStatusChange = async (id, status) => {
    if (status === 'Cancelled' && !window.confirm('Cancel this invoice? Stock deducted for it is returned, and a cancelled invoice cannot be re-opened.')) return;
    const res = await dispatch(updateInvoiceStatus({ id, status }));
    if (updateInvoiceStatus.fulfilled.match(res)) { toast.success(`Marked as ${lk.label('InvoiceStatus', status)}`); reload(); }
    else toast.error(res.payload || 'Failed to update');
  };

  const handleSaveSettings = async form => {
    const res = await dispatch(updateInvoiceSettings(form));
    if (updateInvoiceSettings.fulfilled.match(res)) toast.success('Settings saved!');
    else toast.error(res.payload || 'Failed to save settings');
  };

  // after an email: refresh the open invoice's "sent" info and the grid
  const handleSent = (info) => {
    setViewInvoice(v => (v && v.id === info.id ? { ...v, ...info } : v));
    load();
  };

  // KPIs come from the server summary (all invoices, not just the loaded page)
  const totalRevenue = Number(summary?.totalBilled || 0);
  const totalGST     = Number(summary?.totalGst || 0);
  const paidCount    = summary?.paidCount ?? 0;
  const pendingCount = summary?.unpaidCount ?? 0;
  const fmtK = n => (n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

  if (loading && invoices.length === 0) return <div className="space-y-6"><SkPageHeader /><SkTable rows={7} cols={6} /></div>;

  return (
    <div className="space-y-4">

      <PageHeader
        title="Billing & invoices"
        description={`${summary?.total ?? total ?? 0} invoices · stored in database`}
        actions={<>
          <Button variant="secondary" onClick={() => setShowGenerate(true)}><RefreshCw className="size-3.5" /> From order</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="size-4" /> New invoice</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total billed" value={fmtK(totalRevenue)} hint="Excludes cancelled invoices" icon={TrendingUp} tone="success" />
        <Stat label="GST on invoices" value={fmtK(totalGST)} icon={ReceiptText} tone="info" />
        <Stat label="Paid invoices" value={paidCount} icon={CheckCircle} tone="primary" />
        <Stat label="Pending payment" value={pendingCount} icon={AlertCircle} tone="warning" />
      </div>

      <Tabs items={TABS.map(t => ({ value: t.key, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} />

      {/* ── Settings Tab ──────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <SettingsPanel settings={settings} onSave={handleSaveSettings} />
      )}

      {/* ── Invoice List Tabs ─────────────────────────────────────────────── */}
      {tab !== 'settings' && (
        <InvoiceList
          tab={tab}
          loading={loading}
          invoices={invoices}
          total={total}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          hasAny={(summary?.total ?? 0) > 0}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onSearch={handleSearch}
          onReset={handleReset}
          onStatusChange={handleStatusChange}
          onView={handleView}
          onDownload={downloadInvoicePdf}
          onEmail={setEmailFor}
          lk={lk}
        />
      )}

      {/* Modals (order matters: later ones stack on top) */}
      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => reload()}
          onView={inv => { setShowCreate(false); setViewInvoice(inv); }}
          onEmail={setEmailFor}
          inventoryItems={inventoryItems}
          settings={settings}
          lk={lk}
        />
      )}
      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerated={inv => { setShowGenerate(false); setViewInvoice(inv); reload(); }} />}
      {viewInvoice && (
        <ViewInvoiceDialog
          key={viewInvoice.id}
          invoice={viewInvoice}
          settings={settings}
          lk={lk}
          onClose={() => setViewInvoice(null)}
          onEmail={setEmailFor}
          onUpdated={inv => { setViewInvoice(inv); load(); }}
        />
      )}
      {emailFor && <EmailDialog invoice={emailFor} onClose={() => setEmailFor(null)} onSent={handleSent} />}
    </div>
  );
}

// ── Invoice list (grid + pagination) ──────────────────────────────────────────

function InvoiceList({ tab, loading, invoices, total, page, setPage, pageSize, setPageSize, hasAny, search, setSearch, statusFilter, setStatusFilter, onSearch, onReset, onStatusChange, onView, onDownload, onEmail, lk }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const statuses = lk.enumList('InvoiceStatus');

  return (
    <Card>
      <div className="space-y-3 p-3">
        <Toolbar>
          <div className="contents" onKeyDown={e => e.key === 'Enter' && onSearch()}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search invoice# or customer…" className="max-w-sm" />
          </div>
          {tab === 'all' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-40" aria-label="Status">
              <option value="">All statuses</option>
              {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          <Button onClick={onSearch}>Search</Button>
          <Button variant="secondary" onClick={onReset}>Reset</Button>
        </Toolbar>

        {loading && invoices.length === 0 ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="block h-8 w-full" />)}</div>
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileText} title={hasAny ? 'No invoices match' : 'No invoices yet'}>
            {hasAny ? 'Try another tab, status or search.' : 'Generate one from an order or create it manually.'}
          </EmptyState>
        ) : (
          <>
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Invoice #</th>
                    <th className="text-left">Customer</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Date</th>
                    <th className="text-right">Items</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">GST</th>
                    <th className="text-left">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <div className="font-mono text-[12px] font-bold text-[color:var(--primary)]">{inv.invoiceNumber}</div>
                        {(inv.source || inv.hasIrn) && (
                          <div className="mt-0.5 flex gap-1">
                            {inv.source && <Badge tone={inv.source === 'Offline' ? 'warning' : 'info'} className={miniBadge}>{inv.source}</Badge>}
                            {inv.hasIrn && <Badge tone="success" className={miniBadge} title="e-Invoice IRN recorded">IRN</Badge>}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-bold">{inv.customerName}</div>
                        {inv.customerEmail && <div className={`text-[12px] ${muted}`}>{inv.customerEmail}</div>}
                      </td>
                      <td><Badge tone={inv.type === 'B2B' ? 'accent' : 'neutral'}>{lk.label('InvoiceType', inv.type)}</Badge></td>
                      <td className={`whitespace-nowrap ${muted}`}>{fmtDate(inv.invoiceDate || inv.createdAt)}</td>
                      <td className="text-right">{inv.itemCount ?? '—'}</td>
                      <td className="text-right font-bold">₹{(inv.totalAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="text-right text-[color:var(--text-secondary)]">₹{(inv.gstAmount || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <select
                          value={inv.status}
                          disabled={inv.status === 'Cancelled'}
                          onChange={e => onStatusChange(inv.id, e.target.value)}
                          aria-label="Invoice status"
                          className={`h-6 cursor-pointer rounded-full !border-0 px-2 text-[12px] font-bold ${STATUS_STYLES[inv.status] || STATUS_STYLES.Cancelled}`}
                        >
                          {lookupOptions(statuses, inv.status).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap text-center">
                        <IconButton label="View invoice" tone="primary" onClick={() => onView(inv.id)}><Eye className="size-3.5" /></IconButton>
                        <IconButton label="Download PDF" tone="primary" onClick={() => onDownload(inv)}><Download className="size-3.5" /></IconButton>
                        <IconButton label={`Email invoice · ${sentSummary(inv)}`} tone="primary" onClick={() => onEmail(inv)} className="relative">
                          <Mail className="size-3.5" />
                          {Number(inv.sentCount) > 0 && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-[color:var(--success)]" aria-hidden />}
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} total={total} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} noun="invoices" />
          </>
        )}
      </div>
    </Card>
  );
}
