import { useRef } from 'react';
import { Printer, Download, MessageCircle, Mail, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';

// ── Printable invoice component ───────────────────────────────────────────────
// Usage: <InvoiceTemplate invoice={invoiceDto} onClose={() => ...} />
// invoice.settings has the company template config

export default function InvoiceTemplate({ invoice, onClose }) {
  const printRef = useRef(null);

  if (!invoice) return null;

  const { settings: s } = invoice;
  const gstTotal = (invoice.cgstAmount || 0) + (invoice.sgstAmount || 0) + (invoice.igstAmount || 0);

  // ── Print ───────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #111; font-size: 13px; }
        .invoice-wrap { max-width: 800px; margin: 0 auto; padding: 32px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .company-name { font-size: 22px; font-weight: bold; color: ${s.primaryColor}; }
        .company-info { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.5; }
        .invoice-title { text-align: right; }
        .invoice-title h2 { font-size: 28px; color: ${s.primaryColor}; font-weight: bold; }
        .invoice-title p { font-size: 12px; color: #666; }
        .divider { border: none; border-top: 2px solid ${s.primaryColor}; margin: 16px 0; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .party h4 { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: .5px; margin-bottom: 6px; }
        .party p { font-size: 13px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        thead th { background: ${s.primaryColor}; color: white; padding: 9px 8px; text-align: left; font-size: 12px; }
        tbody td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
        tbody tr:nth-child(even) td { background: #fafafa; }
        .totals { width: 280px; margin-left: auto; margin-top: 12px; }
        .totals tr td { padding: 5px 8px; font-size: 13px; }
        .totals tr td:last-child { text-align: right; font-weight: 600; }
        .grand-total td { background: ${s.primaryColor}; color: white; font-size: 15px; padding: 10px 8px; border-radius: 4px; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
        .bank-details { background: #f8f8f8; border-left: 3px solid ${s.primaryColor}; padding: 10px 14px; margin-top: 16px; font-size: 12px; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    </head><body><div class="invoice-wrap">${content}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ── Download PDF via print dialog ───────────────────────────────────────
  const handleDownload = () => {
    toast('Use "Save as PDF" in the print dialog', { icon: '📄' });
    handlePrint();
  };

  // ── Send via email ───────────────────────────────────────────────────────
  const handleEmail = async () => {
    const email = invoice.customerEmail || prompt('Enter customer email:');
    if (!email) return;
    try {
      await api.post(`/admin/invoices/${invoice.id}/send`, {
        via: 'email',
        email,
        baseUrl: window.location.origin,
      });
      toast.success(`Invoice sent to ${email}`, { icon: '📧' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send email');
    }
  };

  // ── Share via WhatsApp ───────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    const phone = invoice.customerPhone || prompt('Enter customer phone (10 digits):');
    if (!phone) return;
    try {
      const res = await api.post(`/admin/invoices/${invoice.id}/send`, {
        via: 'whatsapp',
        phone,
        baseUrl: window.location.origin,
      });
      const url = res.data?.data?.whatsAppUrl;
      if (url) window.open(url, '_blank');
      toast.success('WhatsApp opened!', { icon: '💬' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to generate WhatsApp link');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const billingAddr = invoice.billingAddress ? (() => {
    try { return JSON.parse(invoice.billingAddress); } catch { return null; }
  })() : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-heading font-bold text-lg text-gray-800">Invoice {invoice.invoiceNumber}</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleEmail} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors">
              <Mail className="w-4 h-4" /> Email
            </button>
            <button onClick={handleWhatsApp} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors">
              <Download className="w-4 h-4" /> PDF
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
              <Printer className="w-4 h-4" /> Print
            </button>
            {onClose && (
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Invoice body (printable area) */}
        <div className="p-8" ref={printRef}>
          {/* Header */}
          <div className="header flex justify-between items-start mb-6">
            <div>
              {s.companyLogo && (
                <img src={s.companyLogo} alt="Logo" className="h-12 mb-2 object-contain" />
              )}
              <div className="company-name text-xl font-bold" style={{ color: s.primaryColor }}>{s.companyName}</div>
              <div className="company-info text-xs text-gray-500 mt-1 leading-5">
                {s.address}, {s.city}, {s.state} - {s.pincode}<br />
                {s.phone} | {s.email}
                {s.gstin && <><br />GSTIN: {s.gstin}</>}
                {s.fssai && <><br />FSSAI: {s.fssai}</>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold" style={{ color: s.primaryColor }}>INVOICE</h2>
              <p className="text-lg font-semibold text-gray-700 mt-1">{invoice.invoiceNumber}</p>
              <p className="text-sm text-gray-500">Date: {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              {invoice.orderNumber && <p className="text-sm text-gray-500">Order: {invoice.orderNumber}</p>}
              <span className={`mt-1 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                invoice.status === 'Paid' ? 'bg-green-100 text-green-700' :
                invoice.status === 'Unpaid' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-600'}`}>{invoice.status}</span>
            </div>
          </div>

          <hr className="divider" style={{ borderColor: s.primaryColor, borderTopWidth: '2px' }} />

          {/* Parties */}
          <div className="parties grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h4>
              <p className="font-semibold text-gray-800">{invoice.customerName}</p>
              {billingAddr && (
                <p className="text-sm text-gray-600 mt-1 leading-5">
                  {billingAddr.addressLine}<br />
                  {billingAddr.city}, {billingAddr.state} - {billingAddr.pincode}
                </p>
              )}
              {invoice.customerEmail && <p className="text-sm text-gray-600">{invoice.customerEmail}</p>}
              {invoice.customerPhone && <p className="text-sm text-gray-600">{invoice.customerPhone}</p>}
              {invoice.customerGstin && <p className="text-sm text-gray-600">GSTIN: {invoice.customerGstin}</p>}
            </div>
            <div className="text-right">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice Info</h4>
              <p className="text-sm text-gray-600">Type: {invoice.type}</p>
              {invoice.orderNumber && <p className="text-sm text-gray-600">Order: {invoice.orderNumber}</p>}
              <p className="text-sm text-gray-600">GST Type: {invoice.gstType}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: s.primaryColor }}>
                  <th className="text-left text-white text-xs py-2.5 px-3">#</th>
                  <th className="text-left text-white text-xs py-2.5 px-3">Product / Description</th>
                  {s.showHsnColumn && <th className="text-left text-white text-xs py-2.5 px-3">HSN</th>}
                  <th className="text-center text-white text-xs py-2.5 px-3">Qty</th>
                  <th className="text-right text-white text-xs py-2.5 px-3">Rate (₹)</th>
                  {s.showDiscountColumn && <th className="text-right text-white text-xs py-2.5 px-3">Disc%</th>}
                  <th className="text-right text-white text-xs py-2.5 px-3">Taxable (₹)</th>
                  <th className="text-center text-white text-xs py-2.5 px-3">GST%</th>
                  <th className="text-right text-white text-xs py-2.5 px-3">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems?.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-2 px-3 text-sm text-gray-500">{i + 1}</td>
                    <td className="py-2 px-3 text-sm font-medium text-gray-800">{item.productName}</td>
                    {s.showHsnColumn && <td className="py-2 px-3 text-sm text-gray-500">{item.hsnCode || '-'}</td>}
                    <td className="py-2 px-3 text-sm text-center">{item.quantity} {item.unit}</td>
                    <td className="py-2 px-3 text-sm text-right">₹{item.unitPrice?.toFixed(2)}</td>
                    {s.showDiscountColumn && <td className="py-2 px-3 text-sm text-right text-green-600">{item.discountPercent?.toFixed(1)}%</td>}
                    <td className="py-2 px-3 text-sm text-right">₹{item.taxableAmount?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-sm text-center">{item.gstRate}%</td>
                    <td className="py-2 px-3 text-sm text-right font-semibold">₹{item.lineTotal?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <table className="totals w-72">
              <tbody>
                <tr><td className="py-1.5 text-sm text-gray-600">Subtotal (ex-GST)</td><td className="py-1.5 text-sm text-right font-semibold">₹{invoice.subtotal?.toFixed(2)}</td></tr>
                {invoice.discountAmount > 0 && <tr><td className="py-1.5 text-sm text-green-600">Discount</td><td className="py-1.5 text-sm text-right text-green-600 font-semibold">-₹{invoice.discountAmount?.toFixed(2)}</td></tr>}
                {invoice.cgstAmount > 0 && <tr><td className="py-1.5 text-sm text-gray-600">CGST</td><td className="py-1.5 text-sm text-right font-semibold">₹{invoice.cgstAmount?.toFixed(2)}</td></tr>}
                {invoice.sgstAmount > 0 && <tr><td className="py-1.5 text-sm text-gray-600">SGST</td><td className="py-1.5 text-sm text-right font-semibold">₹{invoice.sgstAmount?.toFixed(2)}</td></tr>}
                {invoice.igstAmount > 0 && <tr><td className="py-1.5 text-sm text-gray-600">IGST</td><td className="py-1.5 text-sm text-right font-semibold">₹{invoice.igstAmount?.toFixed(2)}</td></tr>}
                {invoice.deliveryCharge > 0 && <tr><td className="py-1.5 text-sm text-gray-600">Delivery</td><td className="py-1.5 text-sm text-right font-semibold">₹{invoice.deliveryCharge?.toFixed(2)}</td></tr>}
                <tr>
                  <td colSpan={2}><hr className="my-1 border-gray-200" /></td>
                </tr>
                <tr className="grand-total" style={{ backgroundColor: s.primaryColor }}>
                  <td className="py-2.5 px-2 text-white font-bold text-base rounded-l-lg">Grand Total</td>
                  <td className="py-2.5 px-2 text-white font-bold text-base text-right rounded-r-lg">₹{invoice.totalAmount?.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* GST Summary */}
          {gstTotal > 0 && (
            <div className="mt-4 bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
              <span className="font-semibold">Tax Summary: </span>
              {invoice.cgstAmount > 0 && <span>CGST ₹{invoice.cgstAmount?.toFixed(2)} + SGST ₹{invoice.sgstAmount?.toFixed(2)} </span>}
              {invoice.igstAmount > 0 && <span>IGST ₹{invoice.igstAmount?.toFixed(2)} </span>}
              = Total Tax ₹{gstTotal.toFixed(2)}
            </div>
          )}

          {/* Bank Details */}
          {s.bankAccount && (
            <div className="bank-details mt-4 rounded-xl p-3 text-sm" style={{ borderLeft: `3px solid ${s.primaryColor}`, background: '#f8f9fa' }}>
              <div className="font-semibold text-gray-700 mb-1">Bank Details for Payment</div>
              <div className="text-gray-600">
                Bank: {s.bankName} &nbsp;|&nbsp; A/C: {s.bankAccount} &nbsp;|&nbsp; IFSC: {s.bankIfsc}
                {s.bankBranch && ` | Branch: ${s.bankBranch}`}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-xl text-sm text-gray-600">
              <span className="font-semibold">Note: </span>{invoice.notes}
            </div>
          )}

          {/* Signature area */}
          {s.showSignature && (
            <div className="mt-8 flex justify-between">
              <div className="text-center w-36">
                <div className="border-t border-gray-400 pt-2 text-xs text-gray-500">Customer Signature</div>
              </div>
              <div className="text-center w-36">
                <div className="border-t border-gray-400 pt-2 text-xs text-gray-500">Authorised Signatory</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
            {s.termsAndConditions && (
              <p className="mb-2 whitespace-pre-line">{s.termsAndConditions}</p>
            )}
            <p>{s.footerText || `Thank you for shopping with ${s.companyName}!`}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
