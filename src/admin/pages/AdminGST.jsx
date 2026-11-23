import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SkPageHeader, SkTabs } from '@/components/ui/Skeleton';
import {
  PageHeader, Stat, Card, Badge, Tabs, Toolbar, IconButton, EmptyState,
  DialogPanel, Button, Field, usePagination, Pagination,
} from '@/admin/ui';
import {
  fetchHsn, addHsn, updateHsn, deleteHsn,
  fetchItc, addItc, deleteItc,
  fetchGstSummary, fetchGstr1,
  fetchReconciliation,
} from '@/store/slices/adminSlice';
import api from '@/services/api';
import { useLookups, lookupOptions, MONTH_SHORT, MONTH_NAMES } from '@/admin/lookups';
import toast from 'react-hot-toast';
import {
  FileText, BookOpen, ReceiptText, Tag, BarChart3,
  Plus, Trash2, RefreshCw, Download, CheckCircle2, AlertCircle, Edit2, FileJson,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { value: 'gstr1',    label: 'GSTR-1',         icon: FileText },
  { value: 'gstr3b',   label: 'GSTR-3B',         icon: ReceiptText },
  { value: 'itc',      label: 'ITC Register',    icon: BookOpen },
  { value: 'hsn',      label: 'HSN Master',      icon: Tag },
  { value: 'recon',    label: 'Reconciliation',  icon: BarChart3 },
];

// Reports the backend export endpoint (GET /admin/gst/export) can build
const EXPORT_REPORTS = [
  { value: 'gstr1',  label: 'GSTR-1 (invoices, B2B, B2CS, HSN, docs)', monthly: false },
  { value: 'gstr3b', label: 'GSTR-3B summary',                          monthly: true },
  { value: 'itc',    label: 'ITC register',                             monthly: false },
  { value: 'hsn',    label: 'HSN summary + HSN master',                 monthly: false },
  { value: 'recon',  label: 'Annual reconciliation',                    monthly: false, yearly: true },
];

const EMPTY_HSN = { code: '', description: '', gstRate: '', cessRate: '0', isExportLut: false, isActive: true };

const fmt = n => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtC = n => `₹${fmt(n)}`;
const periodOf = (month, year) => `${MONTH_SHORT[month - 1]} ${year}`;
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const apiErr = (err, fallback) => err?.response?.data?.error?.message || fallback;

/** GET a file (blob) and save it. Errors come back as a Blob too, so read the JSON message out of it. */
async function downloadFile(url, params, filename) {
  try {
    const res = await api.get(url, { params, responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return true;
  } catch (err) {
    let msg = 'Download failed';
    try { msg = JSON.parse(await err.response.data.text())?.error?.message || msg; } catch { /* not JSON */ }
    toast.error(msg);
    return false;
  }
}

// ── Shared primitives ─────────────────────────────────────────────────────────

// Backdrop without click-to-close (only × / Cancel close the form)
const Modal = ({ title, onClose, footer, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <DialogPanel title={title} onClose={onClose} width="max-w-lg" footer={footer}>{children}</DialogPanel>
  </div>
);

const inp = 'input-field';

const rateTone = (rate) => (rate === 0 ? 'neutral' : rate <= 5 ? 'success' : rate <= 12 ? 'info' : 'accent');

function MonthSelect({ value, onChange, allowAll = false, className = 'input-field !w-auto' }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} className={className} aria-label="Month">
      {allowAll && <option value="">Whole year</option>}
      {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
  );
}

function YearSelect({ years, value, onChange, className = 'input-field !w-auto' }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))} className={className} aria-label="Year">
      {lookupOptions(years.map(y => ({ value: y, label: String(y) })), value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminGST() {
  const dispatch = useDispatch();
  const lk       = useLookups();
  const hsnList  = useSelector(s => s.admin.gst.hsn);
  const itcList  = useSelector(s => s.admin.gst.itc);
  const summary  = useSelector(s => s.admin.gst.summary);
  const gstr1    = useSelector(s => s.admin.gst.gstr1);
  const recon    = useSelector(s => s.admin.gst.reconciliation);
  const loading  = useSelector(s => s.admin.loading);

  const [tab, setTab]         = useState('gstr1');
  const [modal, setModal]     = useState(null);
  const [hsnForm, setHsnForm] = useState(EMPTY_HSN);
  const [itcForm, setItcForm] = useState(null);
  const [editHsn, setEditHsn] = useState(null);
  const [editItc, setEditItc] = useState(null);
  const [saving, setSaving]   = useState(false);

  const [gstr1Year, setGstr1Year] = useState(lk.currentYear);
  const [g3bMonth,  setG3bMonth]  = useState(lk.currentMonth);
  const [g3bYear,   setG3bYear]   = useState(lk.currentYear);
  const [reconYear, setReconYear] = useState(lk.currentYear);

  const [filings, setFilings]       = useState([]);
  const [fileForm, setFileForm]     = useState(null);   // "Mark as filed" dialog
  const [arnEdit, setArnEdit]       = useState(null);   // edit ARN dialog
  const [exportForm, setExportForm] = useState(null);   // export dialog
  const [downloading, setDownloading] = useState(null);

  const g3bPeriod = periodOf(g3bMonth, g3bYear);

  const loadSummary = useCallback(async () => {
    const res = await dispatch(fetchGstSummary({ period: g3bPeriod }));
    if (fetchGstSummary.rejected.match(res)) toast.error(res.payload || 'Failed to load GST summary');
  }, [dispatch, g3bPeriod]);
  const loadFilings = useCallback(async () => {
    try {
      const res = await api.get('/admin/gst/filings', { params: { year: g3bYear } });
      setFilings(res.data?.data || []);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to load filing history'));
    }
  }, [g3bYear]);

  useEffect(() => {
    dispatch(fetchHsn());
    dispatch(fetchItc());
  }, [dispatch]);

  // Summary is always fetched for a concrete period (no "all time" request racing it)
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadFilings(); }, [loadFilings]);
  useEffect(() => { dispatch(fetchGstr1({ year: gstr1Year })); }, [gstr1Year, dispatch]);
  useEffect(() => {
    if (tab === 'recon') dispatch(fetchReconciliation({ year: reconYear }));
  }, [tab, reconYear, dispatch]);

  const itcPg = usePagination(itcList, 20);
  const hsnPg = usePagination(hsnList, 20);

  if (loading && !hsnList.length && !gstr1.length && !summary) return (
    <div className="space-y-4"><SkPageHeader /><SkTabs tabCount={3} contentRows={7} /></div>
  );

  // Only trust the summary when it's for the selected period
  const s          = summary?.period === g3bPeriod ? summary : null;
  const totalTax   = s?.totalTax   ?? 0;
  const totalItc   = s?.totalItc   ?? 0;
  const netPayable = s?.netPayable ?? 0;
  const gstSlabs   = lk.list('GstSlab');
  const periodFiling = filings.find(f => f.returnType === 'GSTR3B' && f.month === g3bMonth && f.year === g3bYear && f.status === 'Filed');
  const itcTotalAll  = itcList.filter(r => r.isEligible).reduce((sum, r) => sum + Number(r.totalItc ?? 0), 0);

  // ── HSN handlers ──────────────────────────────────────────────────────────────
  const openAddHsn  = () => { setHsnForm({ ...EMPTY_HSN, gstRate: gstSlabs.find(x => x.value === '5')?.value ?? gstSlabs[0]?.value ?? '' }); setEditHsn(null); setModal('hsn'); };
  const openEditHsn = h => {
    setHsnForm({ code: h.code, description: h.description, gstRate: String(Number(h.gstRate)), cessRate: String(h.cessRate ?? 0), isExportLut: h.isExportLut ?? false, isActive: h.isActive ?? true });
    setEditHsn(h);
    setModal('hsn');
  };

  const handleSaveHsn = async () => {
    if (!hsnForm.code.trim() || !hsnForm.description.trim()) { toast.error('Code and description required'); return; }
    if (!/^\d{4,8}$/.test(hsnForm.code.trim())) { toast.error('HSN code must be 4–8 digits'); return; }
    if (hsnForm.gstRate === '') { toast.error('Choose a GST rate'); return; }
    setSaving(true);
    const payload = { code: hsnForm.code.trim(), description: hsnForm.description.trim(), gstRate: Number(hsnForm.gstRate), cessRate: Number(hsnForm.cessRate) || 0, isExportLut: hsnForm.isExportLut, isActive: hsnForm.isActive };
    const res = editHsn
      ? await dispatch(updateHsn({ id: editHsn.id, ...payload }))
      : await dispatch(addHsn(payload));
    setSaving(false);
    if ((editHsn ? updateHsn : addHsn).fulfilled.match(res)) {
      toast.success(editHsn ? 'HSN updated!' : 'HSN code added!');
      setModal(null);
    } else toast.error(res.payload || 'Failed to save HSN');
  };

  const handleDeleteHsn = async id => {
    if (!confirm('Delete this HSN code?')) return;
    const res = await dispatch(deleteHsn(id));
    if (deleteHsn.fulfilled.match(res)) toast.success('HSN deleted');
    else toast.error(res.payload || 'Delete failed');
  };

  // ── ITC handlers ──────────────────────────────────────────────────────────────
  const blankItc = () => ({ month: g3bMonth, year: g3bYear, supplierName: '', supplierGstin: '', invoiceNumber: '', taxableAmount: '', igstAmount: '', cgstAmount: '', sgstAmount: '', isEligible: true });
  const parseItcPeriod = (p) => {
    const [m, y] = String(p || '').split(' ');
    const mi = MONTH_SHORT.indexOf(m);
    return mi >= 0 && Number(y) ? { month: mi + 1, year: Number(y) } : { month: g3bMonth, year: g3bYear };
  };
  const openAddItc  = () => { setItcForm(blankItc()); setEditItc(null); setModal('itc'); };
  const openEditItc = r => {
    setItcForm({
      ...parseItcPeriod(r.period), supplierName: r.supplierName || '', supplierGstin: r.supplierGstin || '', invoiceNumber: r.invoiceNumber || '',
      taxableAmount: r.taxableAmount ?? '', igstAmount: r.igstAmount ?? '', cgstAmount: r.cgstAmount ?? '', sgstAmount: r.sgstAmount ?? '', isEligible: !!r.isEligible,
    });
    setEditItc(r); setModal('itc');
  };

  const handleSaveItc = async () => {
    if (!itcForm.supplierName.trim() || !itcForm.invoiceNumber.trim()) { toast.error('Supplier and invoice number required'); return; }
    if (itcForm.supplierGstin.trim() && itcForm.supplierGstin.trim().length !== 15) { toast.error('Supplier GSTIN must be 15 characters'); return; }
    const nums = ['taxableAmount', 'igstAmount', 'cgstAmount', 'sgstAmount'].map(k => Number(itcForm[k]) || 0);
    if (nums.some(n => n < 0)) { toast.error('Amounts cannot be negative'); return; }
    const payload = {
      period: periodOf(itcForm.month, itcForm.year),
      supplierName: itcForm.supplierName.trim(), supplierGstin: itcForm.supplierGstin.trim(), invoiceNumber: itcForm.invoiceNumber.trim(),
      taxableAmount: nums[0], igstAmount: nums[1], cgstAmount: nums[2], sgstAmount: nums[3], isEligible: itcForm.isEligible,
    };
    setSaving(true);
    let ok = false;
    if (editItc) {
      try {
        await api.put(`/admin/gst/itc/${editItc.id}`, payload);
        ok = true;
        dispatch(fetchItc());
      } catch (err) { toast.error(apiErr(err, 'Failed to update ITC entry')); }
    } else {
      const res = await dispatch(addItc(payload));
      ok = addItc.fulfilled.match(res);
      if (!ok) toast.error(res.payload || 'Failed to add ITC entry');
    }
    setSaving(false);
    if (ok) {
      toast.success(editItc ? 'ITC entry updated!' : 'ITC entry added!');
      setModal(null); setItcForm(null); setEditItc(null);
      loadSummary();
    }
  };

  const handleDeleteItc = async id => {
    if (!confirm('Delete this ITC entry?')) return;
    const res = await dispatch(deleteItc(id));
    if (deleteItc.fulfilled.match(res)) {
      toast.success('ITC entry deleted');
      loadSummary();
    } else toast.error(res.payload || 'Failed to delete');
  };

  // ── GSTR-3B filing log ────────────────────────────────────────────────────────
  const openMarkFiled = () => setFileForm({ arn: '', notes: '', filedOn: new Date().toISOString().slice(0, 10) });

  const submitFiling = async (force = false) => {
    setSaving(true);
    try {
      await api.post('/admin/gst/filings', {
        returnType: 'GSTR3B', month: g3bMonth, year: g3bYear,
        arn: fileForm.arn.trim() || null, notes: fileForm.notes.trim() || null,
        filedOn: fileForm.filedOn ? new Date(`${fileForm.filedOn}T12:00:00`).toISOString() : null, force,
      });
      toast.success(`GSTR-3B for ${g3bPeriod} recorded as filed`);
      setFileForm(null);
      loadFilings(); loadSummary();
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'ALREADY_FILED' && !force) {
        if (window.confirm(`${apiErr(err, 'Already filed.')}\n\nRecord a revised filing? The earlier record will be marked "Superseded".`)) {
          setSaving(false);
          return submitFiling(true);
        }
      } else toast.error(apiErr(err, 'Failed to record filing'));
    }
    setSaving(false);
  };

  const saveArn = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/gst/filings/${arnEdit.id}`, { arn: arnEdit.arn, notes: arnEdit.notes });
      toast.success('Filing updated');
      setArnEdit(null); loadFilings();
    } catch (err) { toast.error(apiErr(err, 'Failed to update filing')); }
    setSaving(false);
  };

  const removeFiling = async f => {
    if (!confirm(`Remove the "filed" record for ${f.period}? (This only affects this app, not the GST portal.)`)) return;
    try {
      await api.delete(`/admin/gst/filings/${f.id}`);
      toast.success('Filing record removed');
      loadFilings(); loadSummary();
    } catch (err) { toast.error(apiErr(err, 'Failed to remove filing')); }
  };

  const download3b = async format => {
    setDownloading(format);
    const ok = await downloadFile('/admin/gst/gstr3b/download', { year: g3bYear, month: g3bMonth, format }, `GSTR3B_${g3bYear}_${String(g3bMonth).padStart(2, '0')}.${format}`);
    setDownloading(null);
    if (ok) toast.success('GSTR-3B summary downloaded');
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  const openExport = () => {
    const report = tab === 'gstr3b' ? 'gstr3b' : tab === 'itc' ? 'itc' : tab === 'hsn' ? 'hsn' : tab === 'recon' ? 'recon' : 'gstr1';
    const year = tab === 'gstr1' ? gstr1Year : tab === 'recon' ? reconYear : g3bYear;
    setExportForm({ report, year, month: report === 'gstr3b' ? g3bMonth : null, format: 'xlsx' });
  };
  const runExport = async () => {
    const rep = EXPORT_REPORTS.find(r => r.value === exportForm.report);
    if (rep?.monthly && !exportForm.month) { toast.error('GSTR-3B is monthly — choose a month'); return; }
    const month = rep?.yearly ? null : exportForm.month;
    const params = { report: exportForm.report, year: exportForm.year, format: exportForm.format, ...(month ? { month } : {}) };
    const name = `${exportForm.report.toUpperCase()}_${exportForm.year}${month ? `_${String(month).padStart(2, '0')}` : ''}.${exportForm.format}`;
    setDownloading('export');
    const ok = await downloadFile('/admin/gst/export', params, name);
    setDownloading(null);
    if (ok) { toast.success(`Exported ${name}`); setExportForm(null); }
  };

  return (
    <div className="space-y-4">

      <PageHeader
        title="GST & Tax Management"
        description="GSTR-1 · GSTR-3B · ITC register · HSN master · Reconciliation"
        actions={
          <Button onClick={openExport}>
            <Download className="size-4" /> Export report
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Output GST · ${g3bPeriod}`} value={fmtC(totalTax)}   icon={ReceiptText}  tone="success" loading={!s} />
        <Stat label={`ITC · ${g3bPeriod}`}        value={fmtC(totalItc)}   icon={CheckCircle2} tone="info" loading={!s} />
        <Stat label={`Net payable · ${g3bPeriod}`} value={fmtC(netPayable)} icon={AlertCircle}  tone="danger" loading={!s}
          hint={periodFiling ? `Marked filed ${fmtDate(periodFiling.filedOn)}` : 'Not marked as filed'} />
        <Stat label="HSN Codes"     value={hsnList.length}   icon={Tag}          tone="accent" />
      </div>

      <Tabs
        items={TABS.map(t => ({
          ...t,
          count: t.value === 'itc' ? itcList.length : t.value === 'hsn' ? hsnList.length : undefined,
        }))}
        value={tab}
        onChange={setTab}
      />

      {/* ── GSTR-1 ──────────────────────────────────────────────────────────── */}
      {tab === 'gstr1' && (
        <Card
          title="GSTR-1 — Monthly Outward Supply Summary"
          actions={
            <>
              <YearSelect years={lk.years} value={gstr1Year} onChange={setGstr1Year} className="input-field !h-7 !w-auto !py-0 text-[12px]" />
              <Button size="sm" variant="secondary" className="!h-7" onClick={() => dispatch(fetchGstr1({ year: gstr1Year }))}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </>
          }
          bodyClassName="p-3"
        >
          <p className="mb-2 text-[12px] text-[color:var(--text-muted)]">B2B (with GSTIN) and B2C summary of every issued (non-cancelled) invoice in {gstr1Year}. Use Export for the GSTR-1 workbook.</p>
          {gstr1.length === 0 ? (
            <EmptyState icon={FileText} title={`No GSTR-1 data for ${gstr1Year}`}>
              Data appears once invoices are issued in Billing.
            </EmptyState>
          ) : (
            <div className="grid-box">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Period</th>
                    <th className="text-right">B2B Taxable</th>
                    <th className="text-right">B2B Tax</th>
                    <th className="text-right">B2C Taxable</th>
                    <th className="text-right">B2C Tax</th>
                    <th className="text-right">Total GST</th>
                    <th className="text-right">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {gstr1.map(row => (
                    <tr key={row.period}>
                      <td className="font-bold">{row.period}</td>
                      <td className="text-right">{fmtC(row.b2bTaxable)}</td>
                      <td className="text-right font-bold text-[color:var(--success)]">{fmtC(row.b2bTax)}</td>
                      <td className="text-right">{fmtC(row.b2cTaxable)}</td>
                      <td className="text-right font-bold text-[color:var(--success)]">{fmtC(row.b2cTax)}</td>
                      <td className="text-right font-bold">{fmtC(row.totalGst)}</td>
                      <td className="text-right text-[color:var(--text-muted)]">{row.invoiceCount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[color:var(--accent-soft)] font-bold">
                    <td>Total</td>
                    <td className="text-right">{fmtC(gstr1.reduce((sum,r) => sum + (r.b2bTaxable||0), 0))}</td>
                    <td className="text-right text-[color:var(--success)]">{fmtC(gstr1.reduce((sum,r) => sum + (r.b2bTax||0), 0))}</td>
                    <td className="text-right">{fmtC(gstr1.reduce((sum,r) => sum + (r.b2cTaxable||0), 0))}</td>
                    <td className="text-right text-[color:var(--success)]">{fmtC(gstr1.reduce((sum,r) => sum + (r.b2cTax||0), 0))}</td>
                    <td className="text-right text-[color:var(--accent-strong)]">{fmtC(gstr1.reduce((sum,r) => sum + (r.totalGst||0), 0))}</td>
                    <td className="text-right">{gstr1.reduce((sum,r) => sum + (r.invoiceCount||0), 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── GSTR-3B ─────────────────────────────────────────────────────────── */}
      {tab === 'gstr3b' && (
        <div className="space-y-4">
          <Toolbar>
            <MonthSelect value={g3bMonth} onChange={setG3bMonth} />
            <YearSelect years={lk.years} value={g3bYear} onChange={setG3bYear} />
            <Button variant="secondary" onClick={() => { loadSummary(); loadFilings(); }}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <span className="text-[13px] font-bold text-[color:var(--text-secondary)]">Period: {g3bPeriod}</span>
            {periodFiling
              ? <Badge tone="success">Filed {fmtDate(periodFiling.filedOn)}{periodFiling.arn ? ` · ARN ${periodFiling.arn}` : ''}</Badge>
              : <Badge tone="warning">Not marked as filed</Badge>}
          </Toolbar>

          <div className="flex items-center gap-2.5 rounded-[6px] border border-[rgba(26,92,46,0.2)] bg-[color:var(--primary-soft)] px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-[color:var(--primary)]" />
            <p className="text-[12px] text-[color:var(--text-secondary)]">
              <strong>Auto-calculated:</strong> Output tax comes from invoices issued in the period (cancelled invoices excluded). ITC comes from eligible ITC register entries for the period (GRN or manual). Net payable = Output tax − ITC.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                title: 'Tax Collected (Output)', tone: 'text-[color:var(--success)]', totalLabel: 'Total Output Tax', total: totalTax,
                rows: [
                  { l: 'Taxable value', v: s?.totalTaxable ?? 0 },
                  { l: 'CGST Collected', v: s?.totalCgst ?? 0 },
                  { l: 'SGST Collected', v: s?.totalSgst ?? 0 },
                  { l: 'IGST Collected', v: s?.totalIgst ?? 0 },
                ],
              },
              {
                title: 'ITC Claimed (Input)', tone: 'text-[color:var(--info)]', totalLabel: 'Total ITC', total: totalItc,
                rows: [
                  { l: 'CGST ITC', v: s?.itcCgst ?? 0 },
                  { l: 'SGST ITC', v: s?.itcSgst ?? 0 },
                  { l: 'IGST ITC', v: s?.itcIgst ?? 0 },
                ],
              },
            ].map(sec => (
              <Card key={sec.title} title={sec.title}>
                <div className="divide-y divide-[color:var(--border)] px-3 text-[13px]">
                  {sec.rows.map(r => (
                    <div key={r.l} className="flex justify-between py-2">
                      <span className="text-[color:var(--text-secondary)]">{r.l}</span>
                      <span className={`font-bold tabular-nums ${sec.tone}`}>{fmtC(r.v)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2.5">
                  <span className="text-[13px] font-bold">{sec.totalLabel}</span>
                  <span className={`text-[16px] font-bold tabular-nums ${sec.tone}`}>{fmtC(sec.total)}</span>
                </div>
              </Card>
            ))}
          </div>

          <Card bodyClassName="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[15px] font-bold">Net GST Payable</p>
              <p className="mt-0.5 text-[12px] text-[color:var(--text-muted)]">Output Tax − ITC Claimed · {g3bPeriod}</p>
            </div>
            <div className="text-right">
              <p className="text-[24px] font-bold tabular-nums text-[color:var(--danger)]">{fmtC(netPayable)}</p>
              {s?.invoiceCount != null && (
                <p className="mt-0.5 text-[12px] text-[color:var(--text-muted)]">{s.invoiceCount} invoices this period</p>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => download3b('json')} loading={downloading === 'json'}>
              <FileJson className="size-4" /> Download GSTR-3B JSON
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => download3b('xlsx')} loading={downloading === 'xlsx'}>
              <Download className="size-4" /> Download GSTR-3B XLSX
            </Button>
            <Button className="flex-1" onClick={openMarkFiled}>
              <CheckCircle2 className="size-4" /> {periodFiling ? 'Record revised filing' : 'Mark as filed'} · {g3bPeriod}
            </Button>
          </div>
          <p className="text-[12px] text-[color:var(--text-muted)]">
            Returns are filed on the GST portal (gst.gov.in) — this app can't submit them. Download the summary, file on the portal, then use “Mark as filed” to record the date and ARN here.
          </p>

          <Card title={`Filing history · ${g3bYear}`} bodyClassName="p-3">
            {filings.length === 0 ? (
              <EmptyState icon={ReceiptText} title={`No returns marked as filed in ${g3bYear}`}>Use “Mark as filed” after filing on the GST portal.</EmptyState>
            ) : (
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Period</th>
                      <th className="text-left">Return</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Filed on</th>
                      <th className="text-left">ARN</th>
                      <th className="text-right">Output tax</th>
                      <th className="text-right">ITC</th>
                      <th className="text-right">Net payable</th>
                      <th className="text-left">By</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filings.map(f => (
                      <tr key={f.id} className={f.status !== 'Filed' ? 'opacity-60' : ''}>
                        <td className="whitespace-nowrap font-bold">{f.period}</td>
                        <td>{f.returnType === 'GSTR3B' ? 'GSTR-3B' : f.returnType === 'GSTR1' ? 'GSTR-1' : f.returnType}</td>
                        <td><Badge tone={f.status === 'Filed' ? 'success' : 'neutral'}>{f.status}</Badge></td>
                        <td className="whitespace-nowrap">{fmtDate(f.filedOn)}</td>
                        <td className="font-mono text-[12px]">{f.arn || '—'}</td>
                        <td className="text-right">{fmtC(f.totalTax)}</td>
                        <td className="text-right">{fmtC(f.itcClaimed)}</td>
                        <td className="text-right font-bold">{fmtC(f.netPayable)}</td>
                        <td className="text-[color:var(--text-muted)]">{f.filedBy || '—'}</td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <IconButton label="Edit ARN / notes" tone="primary" onClick={() => setArnEdit({ id: f.id, period: f.period, arn: f.arn || '', notes: f.notes || '' })}><Edit2 className="size-3.5" /></IconButton>
                            <IconButton label="Remove filing record" tone="danger" onClick={() => removeFiling(f)}><Trash2 className="size-3.5" /></IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── ITC Register ────────────────────────────────────────────────────── */}
      {tab === 'itc' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--info-bg)] px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-[color:var(--info)]" />
            <p className="text-[12px] text-[color:var(--text-secondary)]">
              <strong>Auto-populated from GRN:</strong> ITC entries are created when you receive a GRN with GST. You can also add or correct entries manually.
            </p>
          </div>
          <Card
            title={<>ITC Register <span className="ml-2 font-normal text-[color:var(--text-muted)]">Eligible ITC (all periods): <b className="text-[color:var(--success)]">{fmtC(itcTotalAll)}</b> · {itcList.length} entries</span></>}
            actions={
              <Button size="sm" className="!h-7" onClick={openAddItc}>
                <Plus className="size-3.5" /> Add ITC Entry
              </Button>
            }
            bodyClassName="p-3"
          >
            {itcList.length === 0 ? (
              <EmptyState icon={BookOpen} title="No ITC entries yet">
                Create a GRN with GST in the Purchase module to auto-add ITC, or add manually above.
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">Period</th>
                        <th className="text-left">Supplier</th>
                        <th className="text-left">GSTIN</th>
                        <th className="text-left">Invoice</th>
                        <th className="text-right">Taxable</th>
                        <th className="text-right">IGST</th>
                        <th className="text-right">CGST</th>
                        <th className="text-right">SGST</th>
                        <th className="text-right">Total ITC</th>
                        <th className="text-left">Eligible</th>
                        <th className="text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itcPg.items.map(r => {
                        const total = Number(r.totalItc ?? (Number(r.igstAmount||0) + Number(r.cgstAmount||0) + Number(r.sgstAmount||0)));
                        return (
                          <tr key={r.id} className={!r.isEligible ? 'opacity-50' : ''}>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{r.period}</td>
                            <td className="whitespace-nowrap font-bold">{r.supplierName}</td>
                            <td className="font-mono text-[12px] text-[color:var(--text-muted)]">{r.supplierGstin || '—'}</td>
                            <td className="font-bold text-[color:var(--primary)]">{r.invoiceNumber}</td>
                            <td className="text-right">{fmtC(r.taxableAmount)}</td>
                            <td className="text-right">{r.igstAmount ? fmtC(r.igstAmount) : '—'}</td>
                            <td className="text-right">{r.cgstAmount ? fmtC(r.cgstAmount) : '—'}</td>
                            <td className="text-right">{r.sgstAmount ? fmtC(r.sgstAmount) : '—'}</td>
                            <td className="text-right font-bold text-[color:var(--success)]">{fmtC(total)}</td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {r.isEligible ? <Badge tone="success">Eligible</Badge> : <Badge tone="danger">Blocked</Badge>}
                                {r.sourceType === 'GRN' ? <Badge tone="info">Auto GRN</Badge> : <Badge>Manual</Badge>}
                              </div>
                            </td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <IconButton label="Edit ITC entry" tone="primary" onClick={() => openEditItc(r)}><Edit2 className="size-3.5" /></IconButton>
                                <IconButton label="Delete ITC entry" tone="danger" onClick={() => handleDeleteItc(r.id)}><Trash2 className="size-3.5" /></IconButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination {...itcPg} noun="entries" />
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── HSN Master ──────────────────────────────────────────────────────── */}
      {tab === 'hsn' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {gstSlabs.map(slab => {
              const count = hsnList.filter(h => Number(h.gstRate) === Number(slab.value)).length;
              return <Stat key={slab.value} label={`${slab.label} slab`} value={count} tone={count > 0 ? 'accent' : 'neutral'} />;
            })}
          </div>

          <Card
            title={<>HSN Master <span className="ml-2 font-normal text-[color:var(--text-muted)]">{hsnList.length} codes</span></>}
            actions={
              <Button size="sm" className="!h-7" onClick={openAddHsn}>
                <Plus className="size-3.5" /> Add HSN Code
              </Button>
            }
            bodyClassName="p-3"
          >
            {hsnList.length === 0 ? (
              <EmptyState icon={Tag} title="No HSN codes yet">
                Add your product HSN codes and their GST rates.
              </EmptyState>
            ) : (
              <>
                <div className="grid-box">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-left">HSN Code</th>
                        <th className="text-left">Description</th>
                        <th className="text-left">GST Rate</th>
                        <th className="text-right">CGST</th>
                        <th className="text-right">SGST</th>
                        <th className="text-right">IGST</th>
                        <th className="text-right">Cess</th>
                        <th className="text-left">LUT Export</th>
                        <th className="text-left">Status</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hsnPg.items.map(h => {
                        const rate = Number(h.gstRate ?? 0);
                        const half = rate / 2;
                        return (
                          <tr key={h.id}>
                            <td className="font-mono font-bold text-[color:var(--primary)]">{h.code}</td>
                            <td className="max-w-xs">{h.description}</td>
                            <td><Badge tone={rateTone(rate)}>{rate}%</Badge></td>
                            <td className="text-right text-[color:var(--text-muted)]">{half}%</td>
                            <td className="text-right text-[color:var(--text-muted)]">{half}%</td>
                            <td className="text-right text-[color:var(--text-muted)]">{rate}%</td>
                            <td className="text-right text-[color:var(--text-muted)]">{Number(h.cessRate) ? `${Number(h.cessRate)}%` : '—'}</td>
                            <td>{h.isExportLut ? <Badge tone="info">LUT 0%</Badge> : <span className="text-[color:var(--text-muted)]">—</span>}</td>
                            <td><Badge tone={h.isActive ? 'success' : 'neutral'}>{h.isActive ? 'Active' : 'Inactive'}</Badge></td>
                            <td>
                              <div className="flex items-center justify-center gap-1">
                                <IconButton label="Edit HSN" tone="primary" onClick={() => openEditHsn(h)}><Edit2 className="size-3.5" /></IconButton>
                                <IconButton label="Delete HSN" tone="danger" onClick={() => handleDeleteHsn(h.id)}><Trash2 className="size-3.5" /></IconButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination {...hsnPg} noun="HSN codes" />
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Annual Reconciliation ────────────────────────────────────────────── */}
      {tab === 'recon' && (
        <div className="space-y-3">
          <Toolbar>
            <YearSelect years={lk.years} value={reconYear} onChange={setReconYear} />
            <Button variant="secondary" onClick={() => dispatch(fetchReconciliation({ year: reconYear }))}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          </Toolbar>

          {recon && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Total Output" value={fmtC(recon.totalOutput)}  tone="success" icon={ReceiptText} />
              <Stat label="Total ITC"    value={fmtC(recon.totalInput)}   tone="info"    icon={CheckCircle2} />
              <Stat label="Net Payable"  value={fmtC(recon.totalPayable)} tone="danger"  icon={AlertCircle} />
            </div>
          )}

          <Card title={`Annual Reconciliation ${reconYear}`} bodyClassName="p-3">
            {!recon ? (
              <EmptyState icon={BarChart3} title="No reconciliation loaded">Select a year to view annual reconciliation.</EmptyState>
            ) : (
              <div className="grid-box">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Month</th>
                      <th className="text-right">Taxable Value</th>
                      <th className="text-right">Output CGST</th>
                      <th className="text-right">Output SGST</th>
                      <th className="text-right">Output IGST</th>
                      <th className="text-right">Total Output</th>
                      <th className="text-right">Input Tax (ITC)</th>
                      <th className="text-right">Net Payable</th>
                      <th className="text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.months.map(m => (
                      <tr key={m.month}>
                        <td className="whitespace-nowrap font-bold">{m.month} {recon.year ?? reconYear}</td>
                        <td className="text-right">{fmtC(m.taxableValue)}</td>
                        <td className="text-right">{fmtC(m.outputCgst)}</td>
                        <td className="text-right">{fmtC(m.outputSgst)}</td>
                        <td className="text-right">{fmtC(m.outputIgst)}</td>
                        <td className="text-right font-bold text-[color:var(--success)]">{fmtC(m.outputTax)}</td>
                        <td className="text-right font-bold text-[color:var(--info)]">{fmtC(m.inputTax)}</td>
                        <td className={`text-right font-bold ${m.netPayable > 0 ? 'text-[color:var(--danger)]' : 'text-[color:var(--success)]'}`}>
                          {m.netPayable > 0 ? fmtC(m.netPayable) : '₹0'}
                        </td>
                        <td className="text-right text-[color:var(--text-muted)]">{m.invoiceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[color:var(--accent-soft)] font-bold">
                      <td>Annual Total</td>
                      <td className="text-right">{fmtC(recon.months.reduce((sum,m) => sum + (m.taxableValue||0), 0))}</td>
                      <td className="text-right">{fmtC(recon.months.reduce((sum,m) => sum + (m.outputCgst||0), 0))}</td>
                      <td className="text-right">{fmtC(recon.months.reduce((sum,m) => sum + (m.outputSgst||0), 0))}</td>
                      <td className="text-right">{fmtC(recon.months.reduce((sum,m) => sum + (m.outputIgst||0), 0))}</td>
                      <td className="text-right text-[color:var(--success)]">{fmtC(recon.totalOutput)}</td>
                      <td className="text-right text-[color:var(--info)]">{fmtC(recon.totalInput)}</td>
                      <td className="text-right text-[color:var(--danger)]">{fmtC(recon.totalPayable)}</td>
                      <td className="text-right">{recon.months.reduce((sum,m) => sum + (m.invoiceCount||0), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── HSN Modal ─────────────────────────────────────────────────────────── */}
      {modal === 'hsn' && (
        <Modal
          title={editHsn ? 'Edit HSN Code' : 'Add HSN Code'}
          onClose={() => setModal(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={handleSaveHsn} loading={saving}>{saving ? 'Saving…' : editHsn ? 'Update' : 'Add HSN'}</Button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="HSN Code" required className="col-span-2" hint={editHsn ? 'The code itself can’t be changed — delete and re-add instead.' : '4–8 digits'}>
              <input className={inp} value={hsnForm.code} disabled={!!editHsn} inputMode="numeric"
                onChange={e => setHsnForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 09101" />
            </Field>
            <Field label="Description" required className="col-span-2">
              <input className={inp} value={hsnForm.description}
                onChange={e => setHsnForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Ginger — Dried, Fresh Whole" />
            </Field>
            <Field label="GST Rate" required>
              <select className={inp} value={hsnForm.gstRate} onChange={e => setHsnForm(f => ({ ...f, gstRate: e.target.value }))}>
                {hsnForm.gstRate === '' && <option value="">Choose…</option>}
                {lookupOptions(gstSlabs, hsnForm.gstRate).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Cess Rate (%)">
              <input type="number" min="0" max="100" step="0.01" className={inp}
                value={hsnForm.cessRate} onChange={e => setHsnForm(f => ({ ...f, cessRate: e.target.value }))} placeholder="0" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
              <input type="checkbox" checked={hsnForm.isExportLut}
                onChange={e => setHsnForm(f => ({ ...f, isExportLut: e.target.checked }))}
                className="size-4 accent-[#1a5c2e]" />
              LUT Bond — Export at 0% GST
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
              <input type="checkbox" checked={hsnForm.isActive}
                onChange={e => setHsnForm(f => ({ ...f, isActive: e.target.checked }))}
                className="size-4 accent-[#1a5c2e]" />
              Active
            </label>
          </div>
          {hsnForm.gstRate !== '' && Number(hsnForm.gstRate) > 0 && !hsnForm.isExportLut && (
            <div className="mt-3 rounded-[6px] bg-[color:var(--info-bg)] px-3 py-2 text-[12px] text-[color:var(--info)]">
              Intra-state: CGST {Number(hsnForm.gstRate)/2}% + SGST {Number(hsnForm.gstRate)/2}% · Inter-state: IGST {hsnForm.gstRate}%
              {Number(hsnForm.cessRate) > 0 && <span> · Cess {hsnForm.cessRate}%</span>}
            </div>
          )}
        </Modal>
      )}

      {/* ── ITC Modal ─────────────────────────────────────────────────────────── */}
      {modal === 'itc' && itcForm && (
        <Modal
          title={editItc ? 'Edit ITC Entry' : 'Add ITC Entry'}
          onClose={() => { setModal(null); setEditItc(null); }}
          footer={<>
            <Button variant="secondary" onClick={() => { setModal(null); setEditItc(null); }}>Cancel</Button>
            <Button onClick={handleSaveItc} loading={saving}>{saving ? 'Saving…' : editItc ? 'Update' : 'Add Entry'}</Button>
          </>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period" required>
                <div className="flex gap-2">
                  <MonthSelect value={itcForm.month} onChange={m => setItcForm(f => ({ ...f, month: m }))} className="input-field flex-1" />
                  <YearSelect years={lk.years} value={itcForm.year} onChange={y => setItcForm(f => ({ ...f, year: y }))} className="input-field !w-24" />
                </div>
              </Field>
              <Field label="Supplier Invoice Number" required>
                <input className={inp} value={itcForm.invoiceNumber}
                  onChange={e => setItcForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
              </Field>
            </div>
            <Field label="Supplier Name" required>
              <input className={inp} value={itcForm.supplierName}
                onChange={e => setItcForm(f => ({ ...f, supplierName: e.target.value }))} />
            </Field>
            <Field label="Supplier GSTIN">
              <input className={inp} value={itcForm.supplierGstin} maxLength={15}
                onChange={e => setItcForm(f => ({ ...f, supplierGstin: e.target.value.toUpperCase() }))} placeholder="15-character GSTIN" />
            </Field>
            <Field label="Taxable Amount (₹)">
              <input type="number" min="0" step="0.01" className={inp} value={itcForm.taxableAmount}
                onChange={e => setItcForm(f => ({ ...f, taxableAmount: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              {[['igstAmount','IGST'],['cgstAmount','CGST'],['sgstAmount','SGST']].map(([key, label]) => (
                <Field key={key} label={`${label} (₹)`}>
                  <input type="number" min="0" step="0.01" className={inp} value={itcForm[key]}
                    onChange={e => setItcForm(f => ({ ...f, [key]: e.target.value }))} placeholder="0.00" />
                </Field>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--text-secondary)]">
              <input type="checkbox" checked={itcForm.isEligible}
                onChange={e => setItcForm(f => ({ ...f, isEligible: e.target.checked }))}
                className="size-4 accent-[#1a5c2e]" />
              ITC Eligible (uncheck if blocked under Sec 17(5))
            </label>
          </div>
        </Modal>
      )}

      {/* ── Mark as filed ─────────────────────────────────────────────────────── */}
      {fileForm && (
        <Modal
          title={`Mark GSTR-3B as filed · ${g3bPeriod}`}
          onClose={() => setFileForm(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setFileForm(null)}>Cancel</Button>
            <Button onClick={() => submitFiling(false)} loading={saving}>Mark as filed</Button>
          </>}
        >
          <div className="space-y-3 text-[13px]">
            <p className="text-[color:var(--text-muted)]">
              Records that you filed this return on the GST portal. The figures below are saved with the record.
            </p>
            <div className="grid grid-cols-3 gap-2 rounded-[6px] bg-[color:var(--surface-secondary)] p-3">
              <div><div className="text-[11px] text-[color:var(--text-muted)]">Output tax</div><div className="font-bold">{fmtC(totalTax)}</div></div>
              <div><div className="text-[11px] text-[color:var(--text-muted)]">ITC</div><div className="font-bold">{fmtC(totalItc)}</div></div>
              <div><div className="text-[11px] text-[color:var(--text-muted)]">Net payable</div><div className="font-bold text-[color:var(--danger)]">{fmtC(netPayable)}</div></div>
            </div>
            {periodFiling && (
              <p className="rounded-[6px] bg-[color:var(--warning-bg)] px-3 py-2 text-[color:var(--warning)]">
                Already marked as filed on {fmtDate(periodFiling.filedOn)}{periodFiling.arn ? ` (ARN ${periodFiling.arn})` : ''}. Saving again records a revised filing.
              </p>
            )}
            <Field label="Filed on" required>
              <input type="date" className={inp} value={fileForm.filedOn} max={new Date().toISOString().slice(0, 10)}
                onChange={e => setFileForm(f => ({ ...f, filedOn: e.target.value }))} />
            </Field>
            <Field label="ARN (acknowledgement reference number)" hint="Optional — you can add it later from the filing history.">
              <input className={inp} value={fileForm.arn} maxLength={64} onChange={e => setFileForm(f => ({ ...f, arn: e.target.value.toUpperCase() }))} />
            </Field>
            <Field label="Notes">
              <input className={inp} value={fileForm.notes} onChange={e => setFileForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Edit ARN ──────────────────────────────────────────────────────────── */}
      {arnEdit && (
        <Modal
          title={`Filing · ${arnEdit.period}`}
          onClose={() => setArnEdit(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setArnEdit(null)}>Cancel</Button>
            <Button onClick={saveArn} loading={saving}>Save</Button>
          </>}
        >
          <div className="space-y-3">
            <Field label="ARN">
              <input className={inp} value={arnEdit.arn} maxLength={64} onChange={e => setArnEdit(a => ({ ...a, arn: e.target.value.toUpperCase() }))} />
            </Field>
            <Field label="Notes">
              <input className={inp} value={arnEdit.notes} onChange={e => setArnEdit(a => ({ ...a, notes: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Export ────────────────────────────────────────────────────────────── */}
      {exportForm && (() => {
        const rep = EXPORT_REPORTS.find(r => r.value === exportForm.report);
        return (
          <Modal
            title="Export GST report"
            onClose={() => setExportForm(null)}
            footer={<>
              <Button variant="secondary" onClick={() => setExportForm(null)}>Cancel</Button>
              <Button onClick={runExport} loading={downloading === 'export'}><Download className="size-4" /> Download</Button>
            </>}
          >
            <div className="space-y-3">
              <Field label="Report">
                <select className={`${inp} w-full`} value={exportForm.report}
                  onChange={e => setExportForm(f => ({ ...f, report: e.target.value, month: e.target.value === 'gstr3b' ? (f.month || g3bMonth) : f.month }))}>
                  {EXPORT_REPORTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year">
                  <YearSelect years={lk.years} value={exportForm.year} onChange={y => setExportForm(f => ({ ...f, year: y }))} className={`${inp} w-full`} />
                </Field>
                {!rep?.yearly && (
                  <Field label="Month">
                    <MonthSelect value={exportForm.month} allowAll={!rep?.monthly} onChange={m => setExportForm(f => ({ ...f, month: m }))} className={`${inp} w-full`} />
                  </Field>
                )}
              </div>
              <Field label="Format" hint={exportForm.format === 'csv' ? 'CSV contains the main sheet only (e.g. the invoice register for GSTR-1).' : undefined}>
                <select className={`${inp} w-full`} value={exportForm.format} onChange={e => setExportForm(f => ({ ...f, format: e.target.value }))}>
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV</option>
                </select>
              </Field>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
