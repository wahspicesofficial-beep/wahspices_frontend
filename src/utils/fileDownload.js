// Helpers for file responses (PDF invoices, JSON exports) fetched through the shared `api` axios instance.
import api from '@/services/api';

// PDF rendering can take a few seconds on the server — longer than the default 15s api timeout allows for slow links.
export const FILE_TIMEOUT = 60000;

/** Filename from a Content-Disposition header (RFC 5987 filename* first), or null. */
export function filenameFromHeaders(headers) {
  const cd = headers?.['content-disposition'] || '';
  const raw = (cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i) || [])[1];
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/**
 * Request a file. Returns { blob, filename }.
 *   fetchFile('/admin/invoices/5/pdf', { params: { inline: true } })
 *   fetchFile('/admin/invoices/settings/preview', { method: 'post', data: form })
 */
export async function fetchFile(url, { method = 'get', params, data } = {}) {
  const res = await api.request({ url, method, params, data, responseType: 'blob', timeout: FILE_TIMEOUT });
  const type = res.headers?.['content-type'] || res.data?.type || 'application/octet-stream';
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type });
  return { blob, filename: filenameFromHeaders(res.headers) };
}

/** Trigger a browser download for a Blob. */
export function saveBlob(blob, filename = 'download') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Readable message from an axios error — blob responses hide the JSON `{ error: { message } }` body, so read it back. */
export async function fileErrorMessage(err, fallback = 'Download failed') {
  const data = err?.response?.data;
  let msg = data?.error?.message || data?.message;
  if (!msg && data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      msg = json?.error?.message || json?.message || json?.title;
    } catch { /* not JSON */ }
  }
  if (!msg && err?.code === 'ECONNABORTED') msg = 'The server took too long to respond — please try again';
  return msg || fallback;
}

/** "WAH/26-27/001" → "Invoice-WAH-26-27-001.pdf" (used when the server sends no filename). */
export const invoiceFileName = (invoiceNumber, ext = 'pdf') =>
  `Invoice-${String(invoiceNumber || 'invoice').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')}.${ext}`;
