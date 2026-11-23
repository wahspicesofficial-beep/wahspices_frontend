import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { setAuthToken, clearAuthSession, hasSession } from '@/services/api';

// Only the admin profile is cached; the 15-minute access token lives in memory (services/api.js) and the
// refresh token in an httpOnly cookie.
const savedAdmin = (() => {
  if (!hasSession('admin')) { try { localStorage.removeItem('wah_admin_user'); } catch { /* private mode */ } return null; }
  try { return JSON.parse(localStorage.getItem('wah_admin_user')); } catch { return null; }
})();

export const adminLogin = createAsyncThunk('admin/login', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin/auth/login', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invalid credentials');
  }
});

export const adminVerify2FALogin = createAsyncThunk('admin/verify2FALogin', async ({ tempToken, code }, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin/auth/2fa/verify-login', { tempToken, code });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invalid 2FA code');
  }
});

// Live profile + effective permissions (role + per-user overrides). The sidebar filter reads
// state.admin.permissions, so re-fetching this applies permission changes without a re-login.
// Forced 2FA setup during login (Settings → Security → "Require 2FA for all admins").
export const adminSetup2FALogin = createAsyncThunk('admin/setup2FALogin', async (setupToken, { rejectWithValue }) => {
  try { const res = await api.post('/admin/auth/2fa/setup-login', { setupToken }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Could not start 2FA setup'); }
});
export const adminEnable2FALogin = createAsyncThunk('admin/enable2FALogin', async ({ setupToken, code }, { rejectWithValue }) => {
  try { const res = await api.post('/admin/auth/2fa/enable-login', { setupToken, code }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Invalid code'); }
});

// Admin security policy (Settings → Security card)
export const fetchSecuritySettings = createAsyncThunk('admin/fetchSecuritySettings', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/security-settings'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to load security settings'); }
});
export const saveSecuritySettings = createAsyncThunk('admin/saveSecuritySettings', async (data, { rejectWithValue }) => {
  try { const res = await api.put('/admin/security-settings', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to save security settings'); }
});

export const fetchAdminMe = createAsyncThunk('admin/fetchMe', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/auth/me'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Could not load your profile'); }
});

export const adminLogout = createAsyncThunk('admin/logout', async () => {
  try { await api.post('/admin/auth/logout'); } catch { /* ignore */ }
  clearAuthSession('admin');
});

export const fetchDashboardStats = createAsyncThunk('admin/dashboardStats', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/dashboard/stats');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch stats');
  }
});

export const fetchDashboardRevenue = createAsyncThunk('admin/dashboardRevenue', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/dashboard/revenue');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch revenue');
  }
});

export const fetchRecentOrders = createAsyncThunk('admin/recentOrders', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/dashboard/recent-orders');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch recent orders');
  }
});

export const fetchTopProducts = createAsyncThunk('admin/topProducts', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/dashboard/top-products');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch top products');
  }
});

export const fetchAdminOrders = createAsyncThunk('admin/fetchOrders', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/orders', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch orders');
  }
});

export const fetchAdminOrderById = createAsyncThunk('admin/fetchOrderById', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/admin/orders/${id}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch order');
  }
});

export const updateOrderStatus = createAsyncThunk('admin/updateOrderStatus', async ({ id, status, note, courier, awbNumber }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/admin/orders/${id}/status`, { status, note, courier, awbNumber });
    return { id, status, ...res.data.data };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update status');
  }
});

export const fetchAdminProducts = createAsyncThunk('admin/fetchProducts', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/products', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch products');
  }
});

export const createProduct = createAsyncThunk('admin/createProduct', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin/products', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to create product');
  }
});

export const updateProduct = createAsyncThunk('admin/updateProduct', async ({ id, ...data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/admin/products/${id}`, data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update product');
  }
});

export const deleteProduct = createAsyncThunk('admin/deleteProduct', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/admin/products/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete product');
  }
});
export const fetchPackTypes = createAsyncThunk('admin/fetchPackTypes', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/products/pack-types'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch pack types'); }
});
export const createPackType = createAsyncThunk('admin/createPackType', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/products/pack-types', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create pack type'); }
});
export const updatePackType = createAsyncThunk('admin/updatePackType', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/products/pack-types/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update pack type'); }
});
export const deletePackType = createAsyncThunk('admin/deletePackType', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/products/pack-types/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete pack type'); }
});

// ── Categories ────────────────────────────────────────────────────────────────
export const fetchAdminCategories = createAsyncThunk('admin/fetchCategories', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/categories');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch categories');
  }
});

export const createCategory = createAsyncThunk('admin/createCategory', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin/categories', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to create category');
  }
});

export const updateCategory = createAsyncThunk('admin/updateCategory', async ({ id, ...data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/admin/categories/${id}`, data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update category');
  }
});

export const deleteCategory = createAsyncThunk('admin/deleteCategory', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/admin/categories/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete category');
  }
});

export const reorderCategories = createAsyncThunk('admin/reorderCategories', async (items, { rejectWithValue }) => {
  try {
    await api.post('/admin/categories/reorder', items);
    return items;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to reorder categories');
  }
});

export const fetchAdminCustomers = createAsyncThunk('admin/fetchCustomers', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/customers', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch customers');
  }
});

export const fetchAdminInventory = createAsyncThunk('admin/fetchInventory', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/inventory', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch inventory');
  }
});

export const adjustInventory = createAsyncThunk('admin/adjustInventory', async ({ id, quantity, type, reason, batchNumber, expiryDate }, { rejectWithValue }) => {
  try {
    const typeMap = { add: 'Addition', remove: 'Reduction', addition: 'Addition', reduction: 'Reduction' };
    const res = await api.post(`/admin/inventory/${id}/adjust`, {
      quantity: Math.abs(Number(quantity)),
      type: typeMap[type?.toLowerCase()] ?? type,
      reason: reason || 'Manual adjustment',
      batchNumber: batchNumber || null,
      expiryDate: expiryDate || null,
    });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to adjust inventory');
  }
});

export const createInventoryItem = createAsyncThunk('admin/createInventoryItem', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin/inventory', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to create inventory item');
  }
});

export const deleteInventoryItem = createAsyncThunk('admin/deleteInventoryItem', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/admin/inventory/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete inventory item');
  }
});

export const fetchInventoryLedger = createAsyncThunk('admin/fetchInventoryLedger', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/inventory/ledger', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch ledger');
  }
});
export const fetchSkus = createAsyncThunk('admin/fetchSkus', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/inventory/skus', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch SKUs'); }
});
export const generateSku = createAsyncThunk('admin/generateSku', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/inventory/sku/generate', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to generate SKU'); }
});
export const fetchInventoryBatches = createAsyncThunk('admin/fetchInventoryBatches', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/inventory/batches', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch batches'); }
});
export const fetchInventoryAlerts = createAsyncThunk('admin/fetchInventoryAlerts', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/inventory/alerts', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch alerts'); }
});
export const fetchInventoryLocations = createAsyncThunk('admin/fetchInventoryLocations', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/inventory/locations'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch locations'); }
});
export const transferInventoryStock = createAsyncThunk('admin/transferInventoryStock', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/inventory/${id}/transfer`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to transfer stock'); }
});

// ── Invoices ─────────────────────────────────────────────────────────────────
export const fetchAdminInvoices = createAsyncThunk('admin/fetchInvoices', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/invoices', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch invoices');
  }
});

export const fetchInvoiceById = createAsyncThunk('admin/fetchInvoiceById', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/admin/invoices/${id}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invoice not found');
  }
});

export const generateInvoiceFromOrder = createAsyncThunk('admin/generateInvoice', async (orderId, { rejectWithValue }) => {
  try {
    const res = await api.post(`/admin/invoices/generate/${orderId}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to generate invoice');
  }
});

export const createManualInvoice = createAsyncThunk('admin/createInvoice', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin/invoices', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to create invoice');
  }
});

export const fetchInvoiceSettings = createAsyncThunk('admin/fetchInvoiceSettings', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/invoices/settings');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch settings');
  }
});

export const updateInvoiceSettings = createAsyncThunk('admin/updateInvoiceSettings', async (data, { rejectWithValue }) => {
  try {
    const res = await api.put('/admin/invoices/settings', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update settings');
  }
});
export const updateInvoiceStatus = createAsyncThunk('admin/updateInvoiceStatus', async ({ id, status }, { rejectWithValue }) => {
  try {
    const res = await api.patch(`/admin/invoices/${id}/status`, { status });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update status');
  }
});

// ── Staff / HR ────────────────────────────────────────────────────────────────
// File downloads: blob responses carry their error JSON as a Blob
const blobErrorMessage = async (err, fallback) => {
  const d = err.response?.data;
  if (d instanceof Blob) { try { return JSON.parse(await d.text())?.error?.message || fallback; } catch { return fallback; } }
  return d?.error?.message || fallback;
};
const saveBlobResponse = (res, fallbackName) => {
  const cd = res.headers?.['content-disposition'] || '';
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1] || m[2]) : fallbackName;
  const url = URL.createObjectURL(res.data instanceof Blob ? res.data : new Blob([res.data]));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const fetchAdminStaff = createAsyncThunk('admin/fetchStaff', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/staff', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch staff'); }
});
export const createEmployee = createAsyncThunk('admin/createEmployee', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/staff', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create employee'); }
});
export const updateEmployee = createAsyncThunk('admin/updateEmployee', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/staff/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update employee'); }
});
export const deleteEmployee = createAsyncThunk('admin/deleteEmployee', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/staff/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete employee'); }
});

// Department master
export const fetchDepartments = createAsyncThunk('admin/fetchDepartments', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/departments'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch departments'); }
});
export const createDepartment = createAsyncThunk('admin/createDepartment', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/departments', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const updateDepartment = createAsyncThunk('admin/updateDepartment', async ({ id, ...data }, { rejectWithValue }) => {
  try { await api.put(`/admin/departments/${id}`, data); return { id, ...data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const deleteDepartment = createAsyncThunk('admin/deleteDepartment', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/departments/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// Designation master
export const fetchDesignations = createAsyncThunk('admin/fetchDesignations', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/designations', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch designations'); }
});
export const createDesignation = createAsyncThunk('admin/createDesignation', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/designations', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const deleteDesignation = createAsyncThunk('admin/deleteDesignation', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/designations/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// Employee documents
export const fetchEmployeeDocuments = createAsyncThunk('admin/fetchEmployeeDocs', async (empId, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/staff/${empId}/documents`); return { empId, docs: res.data.data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const addEmployeeDocument = createAsyncThunk('admin/addEmployeeDoc', async ({ empId, ...data }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/staff/${empId}/documents`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const uploadEmployeeDocument = createAsyncThunk('admin/uploadEmployeeDoc', async ({ empId, file, ...fields }, { rejectWithValue }) => {
  try {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields).forEach(([k, v]) => { if (v != null && v !== '') fd.append(k, v); });
    const res = await api.post(`/admin/staff/${empId}/documents/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to upload document'); }
});
export const downloadEmployeeDocument = createAsyncThunk('admin/downloadEmployeeDoc', async ({ empId, docId, filename }, { rejectWithValue }) => {
  try {
    const res = await api.get(`/admin/staff/${empId}/documents/${docId}/file`, { responseType: 'blob', timeout: 60000 });
    saveBlobResponse(res, filename || 'document');
    return true;
  } catch (err) { return rejectWithValue(await blobErrorMessage(err, 'Failed to download document')); }
});
export const deleteEmployeeDocument = createAsyncThunk('admin/deleteEmployeeDoc', async ({ empId, docId }, { rejectWithValue }) => {
  try { await api.delete(`/admin/staff/${empId}/documents/${docId}`); return docId; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// Salary structure
export const fetchSalaryStructure = createAsyncThunk('admin/fetchSalaryStructure', async (empId, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/staff/${empId}/salary`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const updateSalaryStructure = createAsyncThunk('admin/updateSalaryStructure', async ({ empId, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/staff/${empId}/salary`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// Increment history
export const fetchIncrements = createAsyncThunk('admin/fetchIncrements', async (empId, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/staff/${empId}/salary/increments`); return { empId, list: res.data.data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const createIncrement = createAsyncThunk('admin/createIncrement', async ({ empId, ...data }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/staff/${empId}/salary/increments`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// Transfers
export const fetchTransfers = createAsyncThunk('admin/fetchTransfers', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/staff/transfers', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const transferEmployee = createAsyncThunk('admin/transferEmployee', async ({ empId, ...data }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/staff/${empId}/transfer`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// Hierarchy
export const fetchHierarchy = createAsyncThunk('admin/fetchHierarchy', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/staff/hierarchy'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// ── Attendance ────────────────────────────────────────────────────────────────
export const fetchAttendance = createAsyncThunk('admin/fetchAttendance', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/attendance', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch attendance'); }
});
export const bulkMarkAttendance = createAsyncThunk('admin/bulkMarkAttendance', async (records, { rejectWithValue }) => {
  try { const res = await api.post('/admin/attendance/bulk', records); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to mark attendance'); }
});
export const markAttendance = createAsyncThunk('admin/markAttendance', async (entries, { rejectWithValue }) => {
  try { const res = await api.post('/admin/attendance/mark', entries); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchShifts = createAsyncThunk('admin/fetchShifts', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/attendance/shifts'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const createShift = createAsyncThunk('admin/createShift', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/attendance/shifts', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const updateShift = createAsyncThunk('admin/updateShift', async ({ id, ...data }, { rejectWithValue }) => {
  try { await api.put(`/admin/attendance/shifts/${id}`, data); return { id, ...data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const deleteShift = createAsyncThunk('admin/deleteShift', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/attendance/shifts/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchShiftAssignments = createAsyncThunk('admin/fetchShiftAssignments', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/attendance/shifts/assignments'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const assignShift = createAsyncThunk('admin/assignShift', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/attendance/shifts/assign', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchRegularizations = createAsyncThunk('admin/fetchRegularizations', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/attendance/regularizations', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const submitRegularization = createAsyncThunk('admin/submitRegularization', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/attendance/regularizations', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const approveRegularization = createAsyncThunk('admin/approveRegularization', async ({ id, remarks }, { rejectWithValue }) => {
  try { await api.put(`/admin/attendance/regularizations/${id}/approve`, { remarks }); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const rejectRegularization = createAsyncThunk('admin/rejectRegularization', async ({ id, remarks }, { rejectWithValue }) => {
  try { await api.put(`/admin/attendance/regularizations/${id}/reject`, { remarks }); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// ── Leave ─────────────────────────────────────────────────────────────────────
export const fetchLeaveApplications = createAsyncThunk('admin/fetchLeaveApplications', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/leave/applications', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch leave applications'); }
});
export const approveLeave = createAsyncThunk('admin/approveLeave', async ({ id, remarks }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/leave/applications/${id}/approve`, { remarks }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to approve leave'); }
});
export const rejectLeave = createAsyncThunk('admin/rejectLeave', async ({ id, remarks }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/leave/applications/${id}/reject`, { remarks }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to reject leave'); }
});
export const fetchHolidays = createAsyncThunk('admin/fetchHolidays', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/leave/holidays'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch holidays'); }
});
export const addHoliday = createAsyncThunk('admin/addHoliday', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/leave/holidays', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add holiday'); }
});
export const deleteHoliday = createAsyncThunk('admin/deleteHoliday', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/leave/holidays/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete holiday'); }
});
export const fetchLeaveBalances = createAsyncThunk('admin/fetchLeaveBalances', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/leave/balances', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch leave balances'); }
});
export const submitLeaveApplication = createAsyncThunk('admin/submitLeaveApplication', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/leave/applications', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to submit leave application'); }
});

// ── Payroll ───────────────────────────────────────────────────────────────────
export const fetchPayroll = createAsyncThunk('admin/fetchPayroll', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/payroll', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch payroll'); }
});
export const runPayroll = createAsyncThunk('admin/runPayroll', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/payroll/run', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to run payroll'); }
});
export const approvePayroll = createAsyncThunk('admin/approvePayroll', async (id, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/payroll/disburse/${id}`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to disburse salary'); }
});
export const disburseAllPayroll = createAsyncThunk('admin/disbursePayroll', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/payroll/disburse-all', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to disburse payroll'); }
});
export const approveAllPayroll = createAsyncThunk('admin/approveAllPayroll', async (data, { rejectWithValue }) => {
  try { const res = await api.put('/admin/payroll/approve', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to approve payroll'); }
});
export const disbursePayrollEntry = createAsyncThunk('admin/disbursePayrollEntry', async (entryId, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/payroll/disburse/${entryId}`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to disburse salary'); }
});
export const downloadNeftFile = createAsyncThunk('admin/downloadNeftFile', async ({ month, year, format = 'xlsx' }, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/payroll/neft-file', { params: { month, year, format }, responseType: 'blob', timeout: 60000 });
    saveBlobResponse(res, `NEFT_Salary_${year}_${String(month).padStart(2, '0')}.${format}`);
    return true;
  } catch (err) { return rejectWithValue(await blobErrorMessage(err, 'Failed to generate NEFT file')); }
});
export const fetchSalarySlipHtml = createAsyncThunk('admin/fetchSalarySlipHtml', async (entryId, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/payroll/slip/${entryId}`, { responseType: 'text' }); return res.data; }
  catch (err) {
    const d = err.response?.data;
    try { return rejectWithValue((typeof d === 'string' ? JSON.parse(d) : d)?.error?.message || 'Failed to load salary slip'); }
    catch { return rejectWithValue('Failed to load salary slip'); }
  }
});
export const sendSalarySlip = createAsyncThunk('admin/sendSalarySlip', async (entryId, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/payroll/slip/${entryId}/send`); return { ...res.data.data, message: res.data.message }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to send salary slip'); }
});
export const fetchSalaryStructures = createAsyncThunk('admin/fetchSalaryStructures', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/payroll/salary-structures'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch salary structures'); }
});
export const fetchPayrollHistory = createAsyncThunk('admin/fetchPayrollHistory', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/payroll/history', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch payroll history'); }
});

// ── GST ───────────────────────────────────────────────────────────────────────
export const fetchHsn = createAsyncThunk('admin/fetchHsn', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/gst/hsn'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch HSN'); }
});
export const addHsn = createAsyncThunk('admin/addHsn', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/gst/hsn', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add HSN'); }
});
export const updateHsn = createAsyncThunk('admin/updateHsn', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/gst/hsn/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update HSN'); }
});
export const deleteHsn = createAsyncThunk('admin/deleteHsn', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/gst/hsn/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete HSN'); }
});
export const fetchItc = createAsyncThunk('admin/fetchItc', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/gst/itc'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch ITC'); }
});
export const addItc = createAsyncThunk('admin/addItc', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/gst/itc', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add ITC'); }
});
export const fetchGstSummary = createAsyncThunk('admin/fetchGstSummary', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/gst/summary', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch GST summary'); }
});
export const fetchGstr1 = createAsyncThunk('admin/fetchGstr1', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/gst/gstr1', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch GSTR-1'); }
});
export const deleteItc = createAsyncThunk('admin/deleteItc', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/gst/itc/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete ITC entry'); }
});
export const fetchReconciliation = createAsyncThunk('admin/fetchReconciliation', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/gst/reconciliation', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch reconciliation'); }
});

// ── CRM ───────────────────────────────────────────────────────────────────────
export const fetchCrmCustomers = createAsyncThunk('admin/fetchCrm', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/crm', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch CRM'); }
});
export const fetchCrmStats = createAsyncThunk('admin/fetchCrmStats', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/crm/stats'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch CRM stats'); }
});
export const fetchCrmAging = createAsyncThunk('admin/fetchCrmAging', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/crm/aging'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch aging report'); }
});
export const createCrmCustomer = createAsyncThunk('admin/createCrm', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/crm', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create CRM customer'); }
});
export const updateCrmCustomer = createAsyncThunk('admin/updateCrm', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/crm/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update CRM customer'); }
});
export const deleteCrmCustomer = createAsyncThunk('admin/deleteCrm', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/crm/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete CRM customer'); }
});
export const updateCrmDues = createAsyncThunk('admin/updateCrmDues', async ({ id, amount }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/crm/${id}/dues`, { amount }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update dues'); }
});
export const updateCrmLoyalty = createAsyncThunk('admin/updateCrmLoyalty', async ({ id, points }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/crm/${id}/loyalty`, { points }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update loyalty'); }
});
export const fetchCrmCustomer = createAsyncThunk('admin/fetchCrmCustomer', async (id, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/crm/${id}`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch customer'); }
});
export const blockCrmCustomer = createAsyncThunk('admin/blockCrm', async ({ id, block, reason }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/crm/${id}/block`, { block, reason }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to block customer'); }
});
export const fetchCrmPayments = createAsyncThunk('admin/fetchCrmPayments', async (id, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/crm/${id}/payments`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch payments'); }
});
export const addCrmPayment = createAsyncThunk('admin/addCrmPayment', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/crm/${id}/payments`, data); return { customerId: id, ...res.data.data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add payment'); }
});
export const fetchCrmPrices = createAsyncThunk('admin/fetchCrmPrices', async (id, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/crm/${id}/prices`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch prices'); }
});
export const addCrmPriceRule = createAsyncThunk('admin/addCrmPrice', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/crm/${id}/prices`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add price rule'); }
});
export const deleteCrmPriceRule = createAsyncThunk('admin/deleteCrmPrice', async (priceId, { rejectWithValue }) => {
  try { await api.delete(`/admin/crm/prices/${priceId}`); return priceId; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete price rule'); }
});
export const updateCrmCreditLimit = createAsyncThunk('admin/updateCrmCreditLimit', async ({ id, creditLimit }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/crm/${id}/credit-limit`, { creditLimit }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update credit limit'); }
});
// Emails a payment-due reminder → { sent, skipped, reason, email, message, whatsAppUrl } (+ res.data.message)
export const sendCrmReminder = createAsyncThunk('admin/sendCrmReminder', async ({ id, via, message }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/crm/${id}/remind`, { via, message }); return { ...res.data.data, notice: res.data.message }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to send reminder'); }
});
// Bulk email reminders → { matched, sent, skipped, failed, skippedCustomers, failedCustomers }
export const sendCrmBulkReminders = createAsyncThunk('admin/sendCrmBulkReminders', async ({ minOutstanding, bucket, category, message }, { rejectWithValue }) => {
  try { const res = await api.post('/admin/crm/reminders', { minOutstanding, bucket, category, message }); return { ...res.data.data, notice: res.data.message }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to send reminders'); }
});
export const sendCrmPromo = createAsyncThunk('admin/sendCrmPromo', async ({ id, type, customMessage }, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/crm/${id}/promo`, { type, customMessage }); return { ...res.data.data, notice: res.data.message }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to send promo'); }
});

// ── Purchase ──────────────────────────────────────────────────────────────────
export const fetchVendors = createAsyncThunk('admin/fetchVendors', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/purchase/vendors'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch vendors'); }
});
export const createVendor = createAsyncThunk('admin/createVendor', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/purchase/vendors', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create vendor'); }
});
export const fetchPurchaseOrders = createAsyncThunk('admin/fetchPurchaseOrders', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/purchase/orders', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch purchase orders'); }
});
export const createPurchaseOrder = createAsyncThunk('admin/createPurchaseOrder', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/purchase/orders', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create purchase order'); }
});
export const updatePoStatus = createAsyncThunk('admin/updatePoStatus', async ({ id, status }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/purchase/orders/${id}/status`, { status }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update PO status'); }
});
export const deletePurchaseOrder = createAsyncThunk('admin/deletePurchaseOrder', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/purchase/orders/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete PO'); }
});
export const fetchGrn = createAsyncThunk('admin/fetchGrn', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/purchase/grn', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch GRN'); }
});
export const createGrn = createAsyncThunk('admin/createGrn', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/purchase/grn', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create GRN'); }
});
export const fetchVendorPayments = createAsyncThunk('admin/fetchVendorPayments', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/purchase/payments', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch payments'); }
});
export const createVendorPayment = createAsyncThunk('admin/createVendorPayment', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/purchase/payments', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to record payment'); }
});
export const fetchPriceHistory = createAsyncThunk('admin/fetchPriceHistory', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/purchase/price-history', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch price history'); }
});
export const addPriceHistory = createAsyncThunk('admin/addPriceHistory', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/purchase/price-history', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add price'); }
});
export const fetchPurchaseReturns = createAsyncThunk('admin/fetchPurchaseReturns', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/purchase/returns', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch returns'); }
});
export const createPurchaseReturn = createAsyncThunk('admin/createPurchaseReturn', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/purchase/returns', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create return'); }
});
export const updateReturnStatus = createAsyncThunk('admin/updateReturnStatus', async ({ id, status }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/purchase/returns/${id}/status`, { status }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update return'); }
});

// ── Expenses ──────────────────────────────────────────────────────────────────
export const fetchExpenses = createAsyncThunk('admin/fetchExpenses', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/expenses', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch expenses'); }
});
export const createExpense = createAsyncThunk('admin/createExpense', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/expenses', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create expense'); }
});
export const updateExpense = createAsyncThunk('admin/updateExpense', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/expenses/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update expense'); }
});
export const deleteExpense = createAsyncThunk('admin/deleteExpense', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/expenses/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete expense'); }
});
export const approveExpense = createAsyncThunk('admin/approveExpense', async (id, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/expenses/${id}/approve`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to approve expense'); }
});
export const exportExpenses = createAsyncThunk('admin/exportExpenses', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/admin/expenses/export', { params, responseType: 'blob', timeout: 60000 });
    saveBlobResponse(res, `Expenses_${params.year}_${String(params.month).padStart(2, '0')}.${params.format || 'xlsx'}`);
    return true;
  } catch (err) { return rejectWithValue(await blobErrorMessage(err, 'Export failed')); }
});
export const fetchExpenseBudgets = createAsyncThunk('admin/fetchExpenseBudgets', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/expenses/budgets'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch budgets'); }
});
export const saveExpenseBudget = createAsyncThunk('admin/saveExpenseBudget', async ({ category, monthlyLimit }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/expenses/budgets/${category}`, { monthlyLimit }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to save budget'); }
});
export const fetchExpenseCategories = createAsyncThunk('admin/fetchExpenseCategories', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/expenses/categories'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch categories'); }
});
export const createExpenseCategory = createAsyncThunk('admin/createExpenseCategory', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/expenses/categories', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create category'); }
});
export const updateExpenseCategory = createAsyncThunk('admin/updateExpenseCategory', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/expenses/categories/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update category'); }
});
export const deleteExpenseCategory = createAsyncThunk('admin/deleteExpenseCategory', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/expenses/categories/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete category'); }
});

// ── Blog ──────────────────────────────────────────────────────────────────────
export const fetchBlogPosts = createAsyncThunk('admin/fetchBlog', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/blog', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch blog posts'); }
});
export const createBlogPost = createAsyncThunk('admin/createBlog', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/blog', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create blog post'); }
});
export const updateBlogPost = createAsyncThunk('admin/updateBlog', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/blog/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update blog post'); }
});
export const deleteBlogPost = createAsyncThunk('admin/deleteBlog', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/blog/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete blog post'); }
});
export const togglePublish = createAsyncThunk('admin/togglePublish', async (id, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/blog/${id}/publish`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to toggle publish'); }
});

// ── Recipes ───────────────────────────────────────────────────────────────────
export const fetchRecipes = createAsyncThunk('admin/fetchRecipes', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/recipes', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch recipes'); }
});
export const createRecipe = createAsyncThunk('admin/createRecipe', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/recipes', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create recipe'); }
});
export const updateRecipe = createAsyncThunk('admin/updateRecipe', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/recipes/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update recipe'); }
});
export const deleteRecipe = createAsyncThunk('admin/deleteRecipe', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/recipes/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete recipe'); }
});
export const toggleRecipePublish = createAsyncThunk('admin/toggleRecipePublish', async (id, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/recipes/${id}/publish`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to toggle recipe publish'); }
});

// ── Production ────────────────────────────────────────────────────────────────
export const fetchProductionProducts = createAsyncThunk('admin/fetchProductionProducts', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/products'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch production products'); }
});
export const fetchProductionInventory = createAsyncThunk('admin/fetchProductionInventory', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/inventory-summary'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch production inventory'); }
});
export const deductStock = createAsyncThunk('admin/deductStock', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/stock-deduct', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to deduct stock'); }
});
export const addProductionStock = createAsyncThunk('admin/addProductionStock', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/stock-add', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to add stock'); }
});

export const fetchBom = createAsyncThunk('admin/fetchBom', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/bom', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch BOM'); }
});
export const createBom = createAsyncThunk('admin/createBom', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/bom', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create BOM'); }
});
export const updateBom = createAsyncThunk('admin/updateBom', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/production/bom/${id}`, data); return { id, ...res.data.data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update BOM'); }
});
export const deleteBom = createAsyncThunk('admin/deleteBom', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/production/bom/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete BOM'); }
});

export const fetchProductionOrders = createAsyncThunk('admin/fetchProductionOrders', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/orders', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch production orders'); }
});
export const createProductionOrder = createAsyncThunk('admin/createProductionOrder', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/orders', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create production order'); }
});
export const updateProductionOrderStatus = createAsyncThunk('admin/updateProductionOrderStatus', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/production/orders/${id}/status`, data); return { id, ...res.data.data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update order status'); }
});
export const deleteProductionOrder = createAsyncThunk('admin/deleteProductionOrder', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/production/orders/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete production order'); }
});

export const fetchBatches = createAsyncThunk('admin/fetchBatches', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/batches', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch batches'); }
});
export const createBatch = createAsyncThunk('admin/createBatch', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/batches', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create batch'); }
});

export const fetchQualityChecks = createAsyncThunk('admin/fetchQualityChecks', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/quality', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch quality checks'); }
});
export const createQualityCheck = createAsyncThunk('admin/createQualityCheck', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/quality', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create quality check'); }
});

export const fetchWastage = createAsyncThunk('admin/fetchWastage', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/production/wastage', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch wastage'); }
});
export const createWastage = createAsyncThunk('admin/createWastage', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/production/wastage', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to record wastage'); }
});

export const fetchProductionReports = createAsyncThunk('admin/fetchProductionReports', async ({ type = 'yield', ...params } = {}, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/production/reports/${type}`, { params }); return { type, data: res.data.data }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch production reports'); }
});

// ── Reports ───────────────────────────────────────────────────────────────────
export const fetchSalesReport = createAsyncThunk('admin/fetchSalesReport', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/reports/sales', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch sales report'); }
});
export const fetchPLReport = createAsyncThunk('admin/fetchPLReport', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/reports/pl', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch P&L report'); }
});
export const fetchGstReport = createAsyncThunk('admin/fetchGstReport', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/reports/gst', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch GST report'); }
});
export const fetchStockReport = createAsyncThunk('admin/fetchStockReport', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/reports/stock', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch stock report'); }
});
export const fetchMarginReport = createAsyncThunk('admin/fetchMarginReport', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/reports/margin', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch margin report'); }
});
export const fetchYoYReport = createAsyncThunk('admin/fetchYoYReport', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/reports/yoy', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch YoY report'); }
});
export const downloadReport = createAsyncThunk('admin/downloadReport', async ({ type, params, filename }, { rejectWithValue }) => {
  try {
    const res = await api.get(`/admin/reports/export/${type}`, { params, responseType: 'blob' });
    // prefer the server's filename (Content-Disposition) — it encodes the real period
    const cd = res.headers?.['content-disposition'] || '';
    const serverName = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i) || [])[1] || '');
    const url = URL.createObjectURL(new Blob([res.data], { type: res.headers?.['content-type'] }));
    const a = document.createElement('a'); a.href = url; a.download = serverName || filename || `${type}-report.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    // blob responses hide the JSON error body — read it back
    let msg = err.response?.data?.error?.message;
    if (!msg && err.response?.data instanceof Blob) {
      try { msg = JSON.parse(await err.response.data.text())?.error?.message; } catch { /* not JSON */ }
    }
    return rejectWithValue(msg || 'Export failed');
  }
});

// ── Access Control ────────────────────────────────────────────────────────────
export const fetchAdminUsers = createAsyncThunk('admin/fetchAdminUsers', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/users'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch admin users'); }
});
export const createAdminUser = createAsyncThunk('admin/createAdminUser', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/users', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create admin user'); }
});
export const updateAdminUser = createAsyncThunk('admin/updateAdminUser', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.patch(`/admin/users/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update user'); }
});
export const deleteAdminUser = createAsyncThunk('admin/deleteAdminUser', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/users/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete user'); }
});
export const resetAdminPassword = createAsyncThunk('admin/resetAdminPassword', async (id, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/users/${id}/reset-password`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to reset password'); }
});
export const saveUserPermissions = createAsyncThunk('admin/saveUserPermissions', async ({ id, permissions }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/users/${id}/permissions`, { permissions }); return res.data.data || { id, permissions }; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to save permissions'); }
});
export const unlockAdminUser = createAsyncThunk('admin/unlockAdminUser', async (id, { rejectWithValue }) => {
  try { const res = await api.post(`/admin/users/${id}/unlock`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to unlock user'); }
});
export const fetchAuditLog = createAsyncThunk('admin/fetchAuditLog', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/audit-log', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch audit log'); }
});
export const fetchSessions = createAsyncThunk('admin/fetchSessions', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/sessions'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch sessions'); }
});
export const revokeSession = createAsyncThunk('admin/revokeSession', async (sessionId, { rejectWithValue }) => {
  try { await api.delete(`/admin/sessions/${sessionId}`); return sessionId; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to revoke session'); }
});
export const revokeOtherSessions = createAsyncThunk('admin/revokeOtherSessions', async (_, { rejectWithValue }) => {
  try { const res = await api.delete('/admin/sessions'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to revoke sessions'); }
});
export const setup2FA = createAsyncThunk('admin/setup2FA', async (_, { rejectWithValue }) => {
  try { const res = await api.post('/admin/auth/2fa/setup'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to setup 2FA'); }
});
export const enable2FA = createAsyncThunk('admin/enable2FA', async (code, { rejectWithValue }) => {
  try { const res = await api.post('/admin/auth/2fa/enable', { code }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Invalid code'); }
});
export const disable2FA = createAsyncThunk('admin/disable2FA', async ({ currentPassword }, { rejectWithValue }) => {
  try { const res = await api.post('/admin/auth/2fa/disable', { currentPassword, newPassword: currentPassword }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to disable 2FA'); }
});

// ── Settings ──────────────────────────────────────────────────────────────────
export const fetchSettings = createAsyncThunk('admin/fetchSettings', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/settings'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch settings'); }
});
export const updateSettings = createAsyncThunk('admin/updateSettings', async (data, { rejectWithValue }) => {
  try { const res = await api.put('/admin/settings', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update settings'); }
});

// ── Barcodes ──────────────────────────────────────────────────────────────────
export const fetchBarcodeProducts = createAsyncThunk('admin/fetchBarcodeProducts', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/barcodes/products', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch products'); }
});
export const scanBarcode = createAsyncThunk('admin/scanBarcode', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/barcodes/scan', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Product not found'); }
});
export const generateBarcodeLog = createAsyncThunk('admin/generateBarcodeLog', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/barcodes/generate', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to log generation'); }
});
export const logBarcodePrint = createAsyncThunk('admin/logBarcodePrint', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/barcodes/print', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to log print'); }
});
export const fetchBarcodeHistory = createAsyncThunk('admin/fetchBarcodeHistory', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/barcodes/history', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch history'); }
});
export const deleteBarcodeLog = createAsyncThunk('admin/deleteBarcodeLog', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/barcodes/history/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete log'); }
});

// ── Field Sales ───────────────────────────────────────────────────────────────
export const fetchSalesClients = createAsyncThunk('admin/fetchSalesClients', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/sales/clients', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const createSalesClient = createAsyncThunk('admin/createSalesClient', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/sales/clients', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const updateSalesClient = createAsyncThunk('admin/updateSalesClient', async ({ id, data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/sales/clients/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const deleteSalesClient = createAsyncThunk('admin/deleteSalesClient', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/sales/clients/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchSalesOrders = createAsyncThunk('admin/fetchSalesOrders', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/sales/orders', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchSalesOrderById = createAsyncThunk('admin/fetchSalesOrderById', async (id, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/sales/orders/${id}`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const createSalesOrder = createAsyncThunk('admin/createSalesOrder', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/sales/orders', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const updateSalesOrderStatus = createAsyncThunk('admin/updateSalesOrderStatus', async ({ id, data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/sales/orders/${id}/status`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const cancelSalesOrder = createAsyncThunk('admin/cancelSalesOrder', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/sales/orders/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchSalesBills = createAsyncThunk('admin/fetchSalesBills', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/sales/bills', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const fetchSalesBillById = createAsyncThunk('admin/fetchSalesBillById', async (id, { rejectWithValue }) => {
  try { const res = await api.get(`/admin/sales/bills/${id}`); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const generateSalesBill = createAsyncThunk('admin/generateSalesBill', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/sales/bills/generate', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});
export const recordBillPayment = createAsyncThunk('admin/recordBillPayment', async ({ id, data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/sales/bills/${id}/payment`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed'); }
});

// ── Roles ─────────────────────────────────────────────────────────────────────
export const fetchRoles = createAsyncThunk('admin/fetchRoles', async (_, { rejectWithValue }) => {
  try { const res = await api.get('/admin/roles'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch roles'); }
});
export const createRole = createAsyncThunk('admin/createRole', async (data, { rejectWithValue }) => {
  try { const res = await api.post('/admin/roles', data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to create role'); }
});
export const updateRole = createAsyncThunk('admin/updateRole', async ({ id, ...data }, { rejectWithValue }) => {
  try { const res = await api.put(`/admin/roles/${id}`, data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to update role'); }
});
export const deleteRole = createAsyncThunk('admin/deleteRole', async (id, { rejectWithValue }) => {
  try { await api.delete(`/admin/roles/${id}`); return id; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete role'); }
});
export const seedRoles = createAsyncThunk('admin/seedRoles', async (_, { rejectWithValue }) => {
  try { const res = await api.post('/admin/roles/seed'); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to seed roles'); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
export const fetchAnalytics = createAsyncThunk('admin/fetchAnalytics', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/dashboard/stats', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch analytics'); }
});
export const fetchAnalyticsPerformance = createAsyncThunk('admin/fetchAnalyticsPerformance', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/performance', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch performance'); }
});
export const fetchAnalyticsRevenue = createAsyncThunk('admin/fetchAnalyticsRevenue', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/revenue', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch revenue'); }
});
export const fetchAnalyticsSalesByCategory = createAsyncThunk('admin/fetchAnalyticsSalesByCategory', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/sales-by-category', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch category sales'); }
});
export const fetchAnalyticsTopProducts = createAsyncThunk('admin/fetchAnalyticsTopProducts', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/top-products', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch top products'); }
});
export const fetchAnalyticsKpis = createAsyncThunk('admin/fetchAnalyticsKpis', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/kpis', { params: params || {} }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch KPIs'); }
});
export const fetchAnalyticsOrderStatus = createAsyncThunk('admin/fetchAnalyticsOrderStatus', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/order-status', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch order status'); }
});
export const fetchAnalyticsRecentOrders = createAsyncThunk('admin/fetchAnalyticsRecentOrders', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/recent-orders', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch recent orders'); }
});
export const fetchAnalyticsRevenueSources = createAsyncThunk('admin/fetchAnalyticsRevenueSources', async (params = {}, { rejectWithValue }) => {
  try { const res = await api.get('/admin/analytics/revenue-sources', { params }); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch revenue sources'); }
});

// CRM: merge an updated customer summary into the list row and the open detail record
const applyCrmSummary = (state, c) => {
  if (!c?.id) return;
  const i = state.crm.items.findIndex(x => x.id === c.id); if (i !== -1) state.crm.items[i] = c;
  if (state.crm.current?.id === c.id) state.crm.current = { ...state.crm.current, ...c };
};

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    admin: savedAdmin,
    token: null,   // in memory only (services/api.js)
    isLoggedIn: hasSession('admin'),
    requires2FA: false,
    tempToken: null,
    requires2FASetup: false,
    setupToken: null,
    loading: false,
    error: null,
    dashboard: {
      stats: null,
      revenue: [],
      recentOrders: [],
      topProducts: [],
    },
    orders: { items: [], currentOrder: null, total: 0 },
    products: { items: [], packTypes: [], total: 0 },
    categories: { items: [] },
    inventory: { items: [], total: 0, summary: null, ledger: [], ledgerTotal: 0, skus: [], batches: null, alerts: null, locations: null },
    customers: { items: [], total: 0 },
    invoices: { items: [], current: null, settings: null, total: 0 },
    staff: { items: [], total: 0, departments: [], designations: [], documents: [], documentsEmpId: null, salaryStructure: null, increments: [], transfers: [], hierarchy: [] },
    attendance: { records: [], total: 0, shifts: [], shiftAssignments: [], regularizations: [], regTotal: 0 },
    leave: { applications: [], holidays: [], balances: [], total: 0, balancesYear: null },
    payroll: { entries: [], salaryStructures: [], history: [], total: 0, summaryTotals: null, statutory: null },
    gst: { hsn: [], itc: [], summary: null, gstr1: [], reconciliation: null },
    crm: { items: [], total: 0, stats: null, aging: { buckets: [], rows: [], totalOutstanding: 0, totalCustomers: 0 }, current: null, payments: [], prices: [] },
    barcode: { products: [], history: [] },
    salesOrders: { clients: [], orders: [], currentOrder: null, bills: [], currentBill: null, total: 0 },
    purchase: { vendors: [], orders: [], grn: [], payments: [], priceHistory: [], returns: [], total: 0 },
    expenses: { items: [], summary: [], budgets: [], categories: [], total: 0 },
    blog: { items: [], total: 0 },
    recipes: { items: [], total: 0 },
    analytics: {
      performance: null,
      revenue: null,
      revenueSources: null,
      salesByCategory: [],
      topProducts: [],
      kpis: null,
      orderStatus: null,
      recentOrders: [],
    },
    production: { products: [], inventory: null, orders: [], bom: [], batches: [], quality: [], wastage: [], reports: null },
    reports: { sales: null, pl: null, gst: null, stock: null, margin: null, yoy: null, topProducts: [] },
    accessControl: { users: [], roles: [], auditLog: [], total: 0, sessions: [], twoFA: null },
    settings: null,
  },
  reducers: {
    clearAdminError: (state) => { state.error = null; },
    adminSessionEnded: (state) => { state.admin = null; state.token = null; state.isLoggedIn = false; },
    cancelAdmin2FA: (state) => { state.requires2FA = false; state.tempToken = null; state.requires2FASetup = false; state.setupToken = null; state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(adminLogin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(adminLogin.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.token) {
          state.token = action.payload.token;
          state.admin = action.payload.admin || action.payload.user;
          state.isLoggedIn = true;
          setAuthToken('admin', action.payload.token);
          localStorage.setItem('wah_admin_user', JSON.stringify(state.admin));
        }
        // 2FA required — store temp token
        if (action.payload?.requires2FA) {
          state.requires2FA = true;
          state.tempToken   = action.payload.tempToken;
        }
        // 2FA enforced by policy but not set up yet
        if (action.payload?.requires2FASetup) {
          state.requires2FASetup = true;
          state.setupToken       = action.payload.setupToken;
        }
      })
      .addCase(adminLogin.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(adminVerify2FALogin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(adminVerify2FALogin.fulfilled, (state, action) => {
        state.loading = false;
        state.requires2FA = false;
        state.tempToken   = null;
        if (action.payload?.token) {
          state.token = action.payload.token;
          state.admin = action.payload.admin;
          state.isLoggedIn = true;
          setAuthToken('admin', action.payload.token);
          localStorage.setItem('wah_admin_user', JSON.stringify(state.admin));
        }
      })
      .addCase(adminVerify2FALogin.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(adminEnable2FALogin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(adminEnable2FALogin.fulfilled, (state, action) => {
        state.loading = false;
        state.requires2FASetup = false;
        state.setupToken = null;
        if (action.payload?.token) {
          state.admin = action.payload.admin;
          state.isLoggedIn = true;
          setAuthToken('admin', action.payload.token);
          localStorage.setItem('wah_admin_user', JSON.stringify(state.admin));
        }
      })
      .addCase(adminEnable2FALogin.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchAdminMe.fulfilled, (state, action) => {
        if (!action.payload || !state.isLoggedIn) return;
        state.admin = { ...(state.admin || {}), ...action.payload };
        try { localStorage.setItem('wah_admin_user', JSON.stringify(state.admin)); } catch { /* private mode */ }
      })
      .addCase(adminLogout.fulfilled, (state) => {
        state.admin = null;
        state.token = null;
        state.isLoggedIn = false;
      })

      .addCase(fetchDashboardStats.fulfilled, (state, action) => { state.dashboard.stats = action.payload; })
      .addCase(fetchDashboardRevenue.fulfilled, (state, action) => { state.dashboard.revenue = action.payload || []; })
      .addCase(fetchRecentOrders.fulfilled, (state, action) => { state.dashboard.recentOrders = action.payload || []; })
      .addCase(fetchTopProducts.fulfilled, (state, action) => { state.dashboard.topProducts = action.payload || []; })

      .addCase(fetchAdminOrders.pending, (state) => { state.loading = true; })
      .addCase(fetchAdminOrders.fulfilled, (state, action) => {
        state.loading = false;
        // API returns camelCase: { orders: [...], summary: {}, pagination: { total, page, limit } }
        const p = action.payload;
        state.orders.items = p?.orders || p?.items || (Array.isArray(p) ? p : []);
        state.orders.total = p?.pagination?.total ?? p?.total ?? state.orders.items.length;
      })
      .addCase(fetchAdminOrders.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchAdminOrderById.fulfilled, (state, action) => { state.orders.currentOrder = action.payload; })

      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const order = state.orders.items.find((o) => o.id === action.payload.id);
        if (order) order.status = action.payload.status;
        if (state.orders.currentOrder?.id === action.payload.id) state.orders.currentOrder.status = action.payload.status;
        const recent = state.dashboard.recentOrders.find((o) => o.id === action.payload.id);
        if (recent) recent.status = action.payload.status;
      })

      .addCase(fetchAdminProducts.pending, (state) => { state.loading = true; })
      .addCase(fetchAdminProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products.items = action.payload?.items || action.payload || [];
        state.products.total = action.payload?.total || state.products.items.length;
      })
      .addCase(fetchAdminProducts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(createProduct.fulfilled, (state, action) => {
        if (action.payload) state.products.items.unshift(action.payload);
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        if (action.payload) {
          const idx = state.products.items.findIndex((p) => p.id === action.payload.id);
          if (idx !== -1) state.products.items[idx] = action.payload;
        }
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.products.items = state.products.items.filter((p) => p.id !== action.payload);
      })

      // ── Pack Types ────────────────────────────────────────────────────────
      .addCase(fetchPackTypes.fulfilled, (state, action) => { state.products.packTypes = action.payload?.packTypes || []; })
      .addCase(createPackType.fulfilled, (state, action) => { if (action.payload) state.products.packTypes.push(action.payload); })
      .addCase(updatePackType.fulfilled, (state, action) => {
        if (action.payload) { const i = state.products.packTypes.findIndex(p => p.id === action.payload.id); if (i !== -1) state.products.packTypes[i] = action.payload; }
      })
      .addCase(deletePackType.fulfilled, (state, action) => { state.products.packTypes = state.products.packTypes.filter(p => p.id !== action.payload); })

      // ── Categories ────────────────────────────────────────────────────────
      .addCase(fetchAdminCategories.fulfilled, (state, action) => {
        state.categories.items = action.payload || [];
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        if (action.payload) state.categories.items.push(action.payload);
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        if (action.payload) {
          const idx = state.categories.items.findIndex((c) => c.id === action.payload.id);
          if (idx !== -1) state.categories.items[idx] = action.payload;
        }
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.categories.items = state.categories.items.filter((c) => c.id !== action.payload);
      })
      .addCase(reorderCategories.fulfilled, (state, action) => {
        // Update displayOrder in local state
        action.payload.forEach(({ id, displayOrder }) => {
          const cat = state.categories.items.find((c) => c.id === id);
          if (cat) cat.displayOrder = displayOrder;
        });
        state.categories.items.sort((a, b) => a.displayOrder - b.displayOrder);
      })

      .addCase(fetchAdminCustomers.fulfilled, (state, action) => {
        state.customers.items = action.payload?.items || action.payload || [];
        state.customers.total = action.payload?.total || state.customers.items.length;
      })

      .addCase(fetchAdminInventory.fulfilled, (state, action) => {
        const p = action.payload;
        state.inventory.items = p?.items || (Array.isArray(p) ? p : []);
        state.inventory.total = p?.pagination?.total ?? p?.total ?? state.inventory.items.length;
        if (p?.summary) state.inventory.summary = p.summary;
      })
      .addCase(adjustInventory.fulfilled, (state, action) => {
        if (action.payload?.id) {
          const idx = state.inventory.items.findIndex((i) => i.id === action.payload.id);
          if (idx !== -1) state.inventory.items[idx] = { ...state.inventory.items[idx], ...action.payload };
        }
      })
      .addCase(createInventoryItem.fulfilled, (state, action) => {
        if (action.payload) {
          state.inventory.items.unshift(action.payload);
          state.inventory.total += 1;
        }
      })
      .addCase(deleteInventoryItem.fulfilled, (state, action) => {
        state.inventory.items = state.inventory.items.filter((i) => i.id !== action.payload);
        state.inventory.total = Math.max(0, state.inventory.total - 1);
      })
      .addCase(fetchInventoryLedger.fulfilled, (state, action) => {
        const p = action.payload;
        state.inventory.ledger = p?.ledger || (Array.isArray(p) ? p : []);
        state.inventory.ledgerTotal = p?.pagination?.total ?? state.inventory.ledger.length;
      })
      .addCase(fetchSkus.fulfilled, (state, action) => {
        state.inventory.skus = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchInventoryBatches.fulfilled, (state, action) => { state.inventory.batches = action.payload; })
      .addCase(fetchInventoryAlerts.fulfilled, (state, action) => { state.inventory.alerts = action.payload; })
      .addCase(fetchInventoryLocations.fulfilled, (state, action) => { state.inventory.locations = action.payload; })
      .addCase(transferInventoryStock.fulfilled, (state) => { /* items refreshed separately */ })

      .addCase(fetchAdminInvoices.fulfilled, (state, action) => {
        state.invoices.items = action.payload?.items || action.payload || [];
        state.invoices.total = action.payload?.total || state.invoices.items.length;
      })
      .addCase(fetchInvoiceById.fulfilled, (state, action) => {
        state.invoices.current = action.payload;
      })
      .addCase(generateInvoiceFromOrder.fulfilled, (state, action) => {
        if (action.payload) {
          state.invoices.current = action.payload;
          state.invoices.items.unshift({ id: action.payload.id, invoiceNumber: action.payload.invoiceNumber, customerName: action.payload.customerName, status: action.payload.status, totalAmount: action.payload.totalAmount, createdAt: action.payload.createdAt });
        }
      })
      .addCase(createManualInvoice.fulfilled, (state, action) => {
        if (action.payload) state.invoices.items.unshift(action.payload);
      })
      .addCase(fetchInvoiceSettings.fulfilled, (state, action) => {
        state.invoices.settings = action.payload;
      })
      .addCase(updateInvoiceSettings.fulfilled, (state, action) => {
        state.invoices.settings = action.payload;
      })
      .addCase(updateInvoiceStatus.fulfilled, (state, action) => {
        if (action.payload) {
          const idx = state.invoices.items.findIndex(i => i.id === action.payload.id);
          if (idx !== -1) state.invoices.items[idx] = { ...state.invoices.items[idx], status: action.payload.status };
          if (state.invoices.current?.id === action.payload.id) state.invoices.current = action.payload;
        }
      })

      // ── Staff ─────────────────────────────────────────────────────────────
      .addCase(fetchAdminStaff.pending, (state) => { state.loading = true; })
      .addCase(fetchAdminStaff.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.staff.items = p?.employees || p?.items || (Array.isArray(p) ? p : []);
        state.staff.total = p?.pagination?.total ?? p?.total ?? state.staff.items.length;
      })
      .addCase(fetchAdminStaff.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createEmployee.fulfilled, (state, action) => { if (action.payload?.name) state.staff.items.unshift(action.payload); })
      .addCase(updateEmployee.fulfilled, (state, action) => {
        if (action.payload) { const i = state.staff.items.findIndex(x => x.id === action.payload.id); if (i !== -1) state.staff.items[i] = action.payload; }
      })
      .addCase(deleteEmployee.fulfilled, (state, action) => { state.staff.items = state.staff.items.filter(x => x.id !== action.payload); })
      .addCase(fetchDepartments.fulfilled, (state, action) => { state.staff.departments = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(createDepartment.fulfilled, (state, action) => { if (action.payload) state.staff.departments.unshift(action.payload); })
      .addCase(deleteDepartment.fulfilled, (state, action) => { state.staff.departments = state.staff.departments.filter(d => d.id !== action.payload); })
      .addCase(fetchDesignations.fulfilled, (state, action) => { state.staff.designations = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(createDesignation.fulfilled, (state, action) => { if (action.payload) state.staff.designations.unshift(action.payload); })
      .addCase(deleteDesignation.fulfilled, (state, action) => { state.staff.designations = state.staff.designations.filter(d => d.id !== action.payload); })
      .addCase(fetchEmployeeDocuments.pending, (state, action) => { state.staff.documents = []; state.staff.documentsEmpId = action.meta.arg; })
      .addCase(fetchEmployeeDocuments.fulfilled, (state, action) => {
        if (String(action.meta.arg) === String(state.staff.documentsEmpId)) state.staff.documents = action.payload?.docs || [];
      })
      .addCase(deleteEmployeeDocument.fulfilled, (state, action) => { state.staff.documents = state.staff.documents.filter(d => d.id !== action.payload); })
      .addCase(fetchSalaryStructure.pending, (state, action) => { state.staff.salaryStructure = null; state.staff.salaryEmpId = action.meta.arg; })
      .addCase(fetchSalaryStructure.fulfilled, (state, action) => {
        if (String(action.meta.arg) === String(state.staff.salaryEmpId)) state.staff.salaryStructure = action.payload;
      })
      .addCase(fetchIncrements.pending, (state) => { state.staff.increments = []; })
      .addCase(fetchIncrements.fulfilled, (state, action) => {
        if (String(action.meta.arg) === String(state.staff.salaryEmpId ?? action.meta.arg)) state.staff.increments = action.payload?.list || [];
      })
      .addCase(fetchTransfers.fulfilled, (state, action) => { state.staff.transfers = action.payload?.transfers || []; })
      .addCase(fetchHierarchy.fulfilled, (state, action) => { state.staff.hierarchy = Array.isArray(action.payload) ? action.payload : []; })

      // ── Attendance ────────────────────────────────────────────────────────
      .addCase(fetchAttendance.fulfilled, (state, action) => {
        const p = action.payload;
        state.attendance.records = p?.items || (Array.isArray(p) ? p : []);
        state.attendance.total = p?.total ?? state.attendance.records.length;
      })
      .addCase(fetchShifts.fulfilled, (state, action) => { state.attendance.shifts = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(createShift.fulfilled, (state, action) => { if (action.payload) state.attendance.shifts.push(action.payload); })
      .addCase(deleteShift.fulfilled, (state, action) => { state.attendance.shifts = state.attendance.shifts.filter(s => s.id !== action.payload); })
      .addCase(fetchShiftAssignments.fulfilled, (state, action) => { state.attendance.shiftAssignments = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(fetchRegularizations.fulfilled, (state, action) => {
        const p = action.payload;
        state.attendance.regularizations = p?.items || (Array.isArray(p) ? p : []);
        state.attendance.regTotal = p?.total ?? 0;
      })
      .addCase(approveRegularization.fulfilled, (state, action) => {
        const r = state.attendance.regularizations.find(x => x.id === action.payload);
        if (r) r.regStatus = 'Approved';
      })
      .addCase(rejectRegularization.fulfilled, (state, action) => {
        const r = state.attendance.regularizations.find(x => x.id === action.payload);
        if (r) r.regStatus = 'Rejected';
      })

      // ── Leave ─────────────────────────────────────────────────────────────
      .addCase(fetchLeaveApplications.fulfilled, (state, action) => {
        const p = action.payload;
        state.leave.applications = p?.applications || p?.items || (Array.isArray(p) ? p : []);
        state.leave.total = p?.pagination?.total ?? p?.total ?? state.leave.applications.length;
      })
      .addCase(approveLeave.fulfilled, (state, action) => {
        const id = action.meta.arg.id;
        const app = state.leave.applications.find(x => x.id === id);
        if (app) app.status = 'Approved';
      })
      .addCase(rejectLeave.fulfilled, (state, action) => {
        const id = action.meta.arg.id;
        const app = state.leave.applications.find(x => x.id === id);
        if (app) app.status = 'Rejected';
      })
      .addCase(fetchHolidays.fulfilled, (state, action) => { state.leave.holidays = action.payload || []; })
      .addCase(addHoliday.fulfilled, (state, action) => { if (action.payload) state.leave.holidays.push(action.payload); })
      .addCase(deleteHoliday.fulfilled, (state, action) => { state.leave.holidays = state.leave.holidays.filter(x => x.id !== action.payload); })
      .addCase(fetchLeaveBalances.fulfilled, (state, action) => {
        const p = action.payload;
        state.leave.balances = p?.balances || (Array.isArray(p) ? p : []);
        state.leave.balancesYear = p?.year ?? null;
      })
      .addCase(submitLeaveApplication.fulfilled, (state, action) => {
        if (action.payload) state.leave.applications.unshift(action.payload);
      })

      // ── Payroll ───────────────────────────────────────────────────────────
      .addCase(fetchPayroll.pending, (state) => { state.loading = true; })
      .addCase(fetchPayroll.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.payroll.entries = p?.entries || p?.items || (Array.isArray(p) ? p : []);
        state.payroll.total   = p?.employees ?? p?.total ?? state.payroll.entries.length;
        state.payroll.summaryTotals = (p?.totalGross != null) ? {
          totalGross: p.totalGross,
          totalEpf:   p.totalEPF   ?? p.totalEpf   ?? 0,
          totalEsic:  p.totalESIC  ?? p.totalEsic  ?? 0,
          totalPt:    p.totalPt    ?? 0,
          totalTds:   p.totalTds   ?? 0,
          totalDeductions: p.totalDeductions ?? 0,
          totalNet:   p.totalNet   ?? 0,
          disbursed:  p.disbursed  ?? 0,
          approved:   p.approved   ?? 0,
        } : null;
        state.payroll.statutory = p?.statutory || null;
      })
      .addCase(fetchPayroll.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(approveAllPayroll.fulfilled, (state) => {
        state.payroll.entries.forEach(e => { if (e.status === 'Calculated') e.status = 'Approved'; });
      })
      .addCase(fetchSalaryStructures.fulfilled, (state, action) => {
        const p = action.payload;
        state.payroll.salaryStructures = p?.structures || (Array.isArray(p) ? p : []);
      })
      .addCase(fetchPayrollHistory.fulfilled, (state, action) => {
        state.payroll.history = action.payload?.history || (Array.isArray(action.payload) ? action.payload : []);
      })

      // ── GST ───────────────────────────────────────────────────────────────
      .addCase(fetchHsn.fulfilled, (state, action) => { state.gst.hsn = action.payload || []; })
      .addCase(addHsn.fulfilled, (state, action) => { if (action.payload?.id) state.gst.hsn.push(action.payload); })
      .addCase(updateHsn.fulfilled, (state, action) => {
        if (action.payload) { const i = state.gst.hsn.findIndex(x => x.id === action.payload.id); if (i !== -1) state.gst.hsn[i] = action.payload; }
      })
      .addCase(deleteHsn.fulfilled, (state, action) => { state.gst.hsn = state.gst.hsn.filter(x => x.id !== action.payload); })
      .addCase(fetchItc.fulfilled, (state, action) => { state.gst.itc = Array.isArray(action.payload) ? action.payload : (action.payload?.entries ?? []); })
      .addCase(addItc.fulfilled, (state, action) => { if (action.payload?.id) state.gst.itc.unshift(action.payload); })
      .addCase(deleteItc.fulfilled, (state, action) => { state.gst.itc = state.gst.itc.filter((e) => e.id !== action.payload); })
      .addCase(fetchGstSummary.fulfilled, (state, action) => { state.gst.summary = action.payload; })
      .addCase(fetchGstr1.fulfilled, (state, action) => { state.gst.gstr1 = action.payload || []; })
      .addCase(fetchReconciliation.fulfilled, (state, action) => { state.gst.reconciliation = action.payload; })

      // ── CRM ───────────────────────────────────────────────────────────────
      .addCase(fetchCrmCustomers.pending, (state) => { state.loading = true; })
      .addCase(fetchCrmCustomers.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.crm.items = p?.customers || [];
        state.crm.total = p?.pagination?.total ?? state.crm.items.length;
      })
      .addCase(fetchCrmCustomers.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchCrmStats.fulfilled, (state, action) => { if (action.payload) state.crm.stats = action.payload; })
      // Aging contract: { buckets: [{bucket,label,minDays,maxDays,amount,customers}], rows: [{id,name,phone,email,city,category,outstandingDues,creditLimit,days,bucket}], totalOutstanding, totalCustomers }
      .addCase(fetchCrmAging.fulfilled, (state, action) => {
        const p = action.payload || {};
        state.crm.aging = {
          buckets: Array.isArray(p.buckets) ? p.buckets : [],
          rows: Array.isArray(p.rows) ? p.rows : [],
          totalOutstanding: Number(p.totalOutstanding) || 0,
          totalCustomers: Number(p.totalCustomers) || 0,
        };
      })
      .addCase(createCrmCustomer.fulfilled, (state, action) => { if (action.payload?.id) { state.crm.items.unshift(action.payload); state.crm.total += 1; } })
      .addCase(updateCrmCustomer.fulfilled, (state, action) => {
        applyCrmSummary(state, action.payload);
      })
      .addCase(deleteCrmCustomer.fulfilled, (state, action) => { state.crm.items = state.crm.items.filter(x => x.id !== action.payload); state.crm.total = Math.max(0, state.crm.total - 1); })
      .addCase(updateCrmDues.fulfilled, (state, action) => { applyCrmSummary(state, action.payload); })
      .addCase(updateCrmLoyalty.fulfilled, (state, action) => { applyCrmSummary(state, action.payload); })
      .addCase(updateCrmCreditLimit.fulfilled, (state, action) => { applyCrmSummary(state, action.payload); })
      .addCase(fetchCrmCustomer.fulfilled, (state, action) => { state.crm.current = action.payload; })
      .addCase(blockCrmCustomer.fulfilled, (state, action) => { applyCrmSummary(state, action.payload); })
      .addCase(fetchCrmPayments.fulfilled, (state, action) => { state.crm.payments = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(addCrmPayment.fulfilled, (state, action) => {
        if (action.payload?.payment) { state.crm.payments.unshift(action.payload.payment); }
        if (action.payload?.newDues !== undefined && state.crm.current) state.crm.current.outstandingDues = action.payload.newDues;
      })
      .addCase(fetchCrmPrices.fulfilled, (state, action) => { state.crm.prices = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(addCrmPriceRule.fulfilled, (state, action) => { if (action.payload?.id) state.crm.prices.push(action.payload); })
      .addCase(deleteCrmPriceRule.fulfilled, (state, action) => { state.crm.prices = state.crm.prices.filter(p => p.id !== action.payload); })

      // ── Purchase ──────────────────────────────────────────────────────────
      .addCase(fetchVendors.fulfilled, (state, action) => { state.purchase.vendors = action.payload || []; })
      .addCase(createVendor.fulfilled, (state, action) => { if (action.payload) state.purchase.vendors.push(action.payload); })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action) => {
        const p = action.payload;
        state.purchase.orders = p?.orders || (Array.isArray(p) ? p : []);
        state.purchase.total = p?.pagination?.total ?? p?.total ?? state.purchase.orders.length;
      })
      .addCase(createPurchaseOrder.fulfilled, (state, action) => { if (action.payload) state.purchase.orders.unshift(action.payload); })
      .addCase(updatePoStatus.fulfilled, (state, action) => {
        const { id, status } = action.meta.arg;
        const idx = state.purchase.orders.findIndex((o) => o.id === id);
        if (idx !== -1) state.purchase.orders[idx] = { ...state.purchase.orders[idx], status };
      })
      .addCase(deletePurchaseOrder.fulfilled, (state, action) => {
        state.purchase.orders = state.purchase.orders.filter((o) => o.id !== action.payload);
      })
      .addCase(fetchGrn.fulfilled, (state, action) => {
        const p = action.payload;
        state.purchase.grn = p?.grn || (Array.isArray(p) ? p : []);
      })
      .addCase(createGrn.fulfilled, (state, action) => { if (action.payload) state.purchase.grn.unshift(action.payload); })
      .addCase(fetchVendorPayments.fulfilled, (state, action) => {
        const p = action.payload;
        state.purchase.payments = p?.payments || (Array.isArray(p) ? p : []);
      })
      .addCase(createVendorPayment.fulfilled, (state, action) => { if (action.payload) state.purchase.payments.unshift(action.payload); })
      .addCase(fetchPriceHistory.fulfilled, (state, action) => {
        const p = action.payload;
        state.purchase.priceHistory = p?.history || (Array.isArray(p) ? p : []);
      })
      .addCase(addPriceHistory.fulfilled, (state, action) => { if (action.payload) state.purchase.priceHistory.unshift(action.payload); })
      .addCase(fetchPurchaseReturns.fulfilled, (state, action) => {
        const p = action.payload;
        state.purchase.returns = p?.returns || (Array.isArray(p) ? p : []);
      })
      .addCase(createPurchaseReturn.fulfilled, (state, action) => { if (action.payload) state.purchase.returns.unshift(action.payload); })
      .addCase(updateReturnStatus.fulfilled, (state, action) => {
        const { id, status } = action.meta.arg;
        const idx = state.purchase.returns.findIndex((r) => r.id === id);
        if (idx !== -1) state.purchase.returns[idx] = { ...state.purchase.returns[idx], status };
      })

      // ── Expenses ──────────────────────────────────────────────────────────
      .addCase(fetchExpenses.pending, (state) => { state.loading = true; })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.expenses.items = p?.expenses || p?.items || (Array.isArray(p) ? p : []);
        state.expenses.summary = p?.summary || [];
        state.expenses.total = p?.pagination?.total ?? p?.total ?? state.expenses.items.length;
      })
      .addCase(fetchExpenses.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createExpense.fulfilled, (state, action) => { if (action.payload) state.expenses.items.unshift(action.payload); })
      .addCase(updateExpense.fulfilled, (state, action) => {
        if (action.payload) { const i = state.expenses.items.findIndex(x => x.id === action.payload.id); if (i !== -1) state.expenses.items[i] = action.payload; }
      })
      .addCase(deleteExpense.fulfilled, (state, action) => { state.expenses.items = state.expenses.items.filter(x => x.id !== action.payload); })
      .addCase(approveExpense.fulfilled, (state, action) => {
        const id = action.meta.arg;
        const i = state.expenses.items.findIndex(x => x.id === id);
        if (i !== -1) state.expenses.items[i] = { ...state.expenses.items[i], isApproved: true, approvedBy: action.payload?.approvedBy };
      })
      .addCase(fetchExpenseBudgets.fulfilled, (state, action) => {
        state.expenses.budgets = action.payload?.budgets || [];
      })
      .addCase(saveExpenseBudget.fulfilled, (state, action) => {
        if (action.payload) {
          const i = state.expenses.budgets.findIndex(b => b.category === action.payload.category);
          if (i !== -1) state.expenses.budgets[i] = action.payload; else state.expenses.budgets.push(action.payload);
        }
      })
      .addCase(fetchExpenseCategories.fulfilled, (state, action) => {
        state.expenses.categories = action.payload?.categories || [];
      })
      .addCase(createExpenseCategory.fulfilled, (state, action) => {
        if (action.payload) state.expenses.categories.push(action.payload);
      })
      .addCase(updateExpenseCategory.fulfilled, (state, action) => {
        if (action.payload) { const i = state.expenses.categories.findIndex(c => c.id === action.payload.id); if (i !== -1) state.expenses.categories[i] = action.payload; }
      })
      .addCase(deleteExpenseCategory.fulfilled, (state, action) => {
        state.expenses.categories = state.expenses.categories.filter(c => c.id !== action.payload);
      })

      // ── Blog ──────────────────────────────────────────────────────────────
      .addCase(fetchBlogPosts.pending, (state) => { state.loading = true; })
      .addCase(fetchBlogPosts.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.blog.items = p?.posts || (Array.isArray(p) ? p : []);
        state.blog.total = p?.pagination?.total ?? state.blog.items.length;
      })
      .addCase(fetchBlogPosts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createBlogPost.fulfilled, (state, action) => { if (action.payload) state.blog.items.unshift(action.payload); })
      .addCase(updateBlogPost.fulfilled, (state, action) => {
        if (action.payload) { const i = state.blog.items.findIndex(x => x.id === action.payload.id); if (i !== -1) Object.assign(state.blog.items[i], action.payload); }
      })
      .addCase(deleteBlogPost.fulfilled, (state, action) => { state.blog.items = state.blog.items.filter(x => x.id !== action.payload); })
      .addCase(togglePublish.fulfilled, (state, action) => {
        if (action.payload) { const i = state.blog.items.findIndex(x => x.id === action.payload.id); if (i !== -1) Object.assign(state.blog.items[i], action.payload); }
      })

      // ── Recipes ────────────────────────────────────────────────────────────
      .addCase(fetchRecipes.pending, (state) => { state.loading = true; })
      .addCase(fetchRecipes.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.recipes.items = p?.recipes || (Array.isArray(p) ? p : []);
        state.recipes.total = p?.pagination?.total ?? state.recipes.items.length;
      })
      .addCase(fetchRecipes.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createRecipe.fulfilled, (state, action) => { if (action.payload) state.recipes.items.unshift(action.payload); })
      .addCase(updateRecipe.fulfilled, (state, action) => {
        if (action.payload) { const i = state.recipes.items.findIndex(x => x.id === action.payload.id); if (i !== -1) Object.assign(state.recipes.items[i], action.payload); }
      })
      .addCase(deleteRecipe.fulfilled, (state, action) => { state.recipes.items = state.recipes.items.filter(x => x.id !== action.payload); })
      .addCase(toggleRecipePublish.fulfilled, (state, action) => {
        if (action.payload) { const i = state.recipes.items.findIndex(x => x.id === action.payload.id); if (i !== -1) Object.assign(state.recipes.items[i], action.payload); }
      })

      // ── Analytics ─────────────────────────────────────────────────────────
      .addCase(fetchAnalyticsPerformance.pending, (state) => { state.loading = true; })
      .addCase(fetchAnalyticsPerformance.fulfilled, (state, action) => { state.loading = false; state.analytics.performance = action.payload; })
      .addCase(fetchAnalyticsPerformance.rejected, (state) => { state.loading = false; })
      .addCase(fetchAnalyticsRevenue.fulfilled, (state, action) => { state.analytics.revenue = action.payload; })
      .addCase(fetchAnalyticsRevenueSources.fulfilled, (state, action) => { state.analytics.revenueSources = action.payload; })
      .addCase(fetchAnalyticsSalesByCategory.fulfilled, (state, action) => { state.analytics.salesByCategory = action.payload?.Categories || action.payload?.categories || []; })
      .addCase(fetchAnalyticsTopProducts.fulfilled, (state, action) => { state.analytics.topProducts = action.payload?.Products || action.payload?.products || []; })
      .addCase(fetchAnalyticsKpis.fulfilled, (state, action) => { state.analytics.kpis = action.payload; })
      .addCase(fetchAnalyticsOrderStatus.fulfilled, (state, action) => { state.analytics.orderStatus = action.payload; })
      .addCase(fetchAnalyticsRecentOrders.fulfilled, (state, action) => { state.analytics.recentOrders = Array.isArray(action.payload) ? action.payload : []; })

      // ── Production ────────────────────────────────────────────────────────
      .addCase(fetchProductionProducts.fulfilled, (state, action) => { state.production.products = action.payload || []; })
      .addCase(fetchProductionInventory.fulfilled, (state, action) => { state.production.inventory = action.payload; })
      .addCase(fetchBom.fulfilled, (state, action) => { state.production.bom = action.payload || []; })
      .addCase(createBom.fulfilled, (state) => { /* refreshed on next fetchBom */ })
      .addCase(updateBom.fulfilled, (state) => { /* refreshed on next fetchBom */ })
      .addCase(deleteBom.fulfilled, (state, action) => { state.production.bom = state.production.bom.filter(b => b.id !== action.payload); })
      .addCase(fetchProductionOrders.fulfilled, (state, action) => {
        state.production.orders = action.payload?.orders || action.payload || [];
      })
      .addCase(createProductionOrder.fulfilled, (state) => { /* refreshed on next fetchProductionOrders */ })
      .addCase(updateProductionOrderStatus.fulfilled, (state, action) => {
        if (action.payload) {
          const i = state.production.orders.findIndex(o => o.id === action.payload.id);
          if (i !== -1) state.production.orders[i] = { ...state.production.orders[i], ...action.payload };
        }
      })
      .addCase(deleteProductionOrder.fulfilled, (state, action) => {
        state.production.orders = state.production.orders.filter(o => o.id !== action.payload);
      })
      .addCase(fetchBatches.fulfilled, (state, action) => { state.production.batches = action.payload || []; })
      .addCase(createBatch.fulfilled, (state) => { /* refreshed on next fetchBatches */ })
      .addCase(fetchQualityChecks.fulfilled, (state, action) => { state.production.quality = action.payload || []; })
      .addCase(createQualityCheck.fulfilled, (state) => { /* refreshed on next fetchQualityChecks */ })
      .addCase(fetchWastage.fulfilled, (state, action) => { state.production.wastage = action.payload || []; })
      .addCase(createWastage.fulfilled, (state) => { /* refreshed on next fetchWastage */ })
      .addCase(fetchProductionReports.fulfilled, (state, action) => { state.production.reports = action.payload; })

      // ── Reports ───────────────────────────────────────────────────────────
      .addCase(fetchSalesReport.fulfilled, (state, action) => { state.reports.sales = action.payload; })
      .addCase(fetchPLReport.fulfilled, (state, action) => { state.reports.pl = action.payload; })
      .addCase(fetchGstReport.fulfilled, (state, action) => { state.reports.gst = action.payload; })
      .addCase(fetchStockReport.fulfilled, (state, action) => { state.reports.stock = action.payload; })
      .addCase(fetchMarginReport.fulfilled, (state, action) => { state.reports.margin = action.payload; })
      .addCase(fetchYoYReport.fulfilled, (state, action) => { state.reports.yoy = action.payload; })

      // ── Roles ─────────────────────────────────────────────────────────────
      .addCase(fetchRoles.fulfilled, (state, action) => { state.accessControl.roles = action.payload || []; })
      .addCase(createRole.fulfilled, (state, action) => { if (action.payload) state.accessControl.roles.push(action.payload); })
      .addCase(updateRole.fulfilled, (state, action) => {
        if (action.payload) { const i = state.accessControl.roles.findIndex(r => r.id === action.payload.id); if (i >= 0) state.accessControl.roles[i] = action.payload; }
      })
      .addCase(deleteRole.fulfilled, (state, action) => { state.accessControl.roles = state.accessControl.roles.filter(r => r.id !== action.payload); })

      // ── Access Control ────────────────────────────────────────────────────
      .addCase(fetchAdminUsers.fulfilled, (state, action) => { state.accessControl.users = action.payload || []; })
      .addCase(createAdminUser.fulfilled, (state, action) => { if (action.payload) state.accessControl.users.push(action.payload); })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        if (action.payload) { const i = state.accessControl.users.findIndex(u => u.id === action.payload.id); if (i >= 0) state.accessControl.users[i] = action.payload; }
      })
      .addCase(deleteAdminUser.fulfilled, (state, action) => { state.accessControl.users = state.accessControl.users.filter(u => u.id !== action.payload); })
      .addCase(saveUserPermissions.fulfilled, (state, action) => {
        const i = state.accessControl.users.findIndex(u => u.id === action.payload.id);
        // the API returns the saved user (sparse overrides + effective permissions)
        if (i >= 0) state.accessControl.users[i] = { ...state.accessControl.users[i], ...action.payload };
      })
      .addCase(fetchAuditLog.fulfilled, (state, action) => {
        const p = action.payload;
        state.accessControl.auditLog = p?.items || (Array.isArray(p) ? p : []);
        state.accessControl.total = p?.total ?? p?.Total ?? state.accessControl.auditLog.length;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => { state.accessControl.sessions = action.payload || []; })
      .addCase(revokeSession.fulfilled, (state, action) => { state.accessControl.sessions = state.accessControl.sessions.filter(s => s.id !== action.payload); })
      .addCase(revokeOtherSessions.fulfilled, (state) => { state.accessControl.sessions = state.accessControl.sessions.filter(s => s.isCurrentSession); })
      .addCase(setup2FA.fulfilled, (state, action) => { state.accessControl.twoFA = action.payload; })
      .addCase(enable2FA.fulfilled, (state) => { state.accessControl.twoFA = null; })
      .addCase(disable2FA.fulfilled, (state) => { state.accessControl.twoFA = null; })

      // ── Settings ──────────────────────────────────────────────────────────
      .addCase(fetchSettings.fulfilled, (state, action) => { state.settings = action.payload; })
      .addCase(updateSettings.fulfilled, (state, action) => { state.settings = action.payload; })

      // ── Field Sales ───────────────────────────────────────────────────────
      .addCase(fetchSalesClients.fulfilled, (state, action) => { state.salesOrders.clients = action.payload?.items || action.payload || []; })
      .addCase(createSalesClient.fulfilled, (state, action) => { if (action.payload) state.salesOrders.clients.push(action.payload); })
      .addCase(updateSalesClient.fulfilled, (state, action) => {
        if (action.payload) { const i = state.salesOrders.clients.findIndex(c => c.id === action.payload.id); if (i >= 0) state.salesOrders.clients[i] = action.payload; }
      })
      .addCase(deleteSalesClient.fulfilled, (state, action) => { state.salesOrders.clients = state.salesOrders.clients.filter(c => c.id !== action.payload); })
      .addCase(fetchSalesOrders.fulfilled, (state, action) => {
        state.salesOrders.orders = action.payload?.items || action.payload || [];
        state.salesOrders.total = action.payload?.total ?? 0;
      })
      .addCase(fetchSalesOrderById.fulfilled, (state, action) => { state.salesOrders.currentOrder = action.payload; })
      .addCase(createSalesOrder.fulfilled, (state, action) => { if (action.payload) state.salesOrders.orders.unshift(action.payload); })
      .addCase(cancelSalesOrder.fulfilled, (state, action) => {
        const o = state.salesOrders.orders.find(x => x.id === action.payload); if (o) o.status = 'Cancelled';
      })
      .addCase(updateSalesOrderStatus.fulfilled, (state, action) => {
        const o = state.salesOrders.orders.find(x => x.id === action.payload?.id); if (o && action.payload?.status) o.status = action.payload.status;
      })
      .addCase(fetchSalesBills.fulfilled, (state, action) => { state.salesOrders.bills = action.payload?.items || action.payload || []; })
      .addCase(fetchSalesBillById.fulfilled, (state, action) => { state.salesOrders.currentBill = action.payload; })
      .addCase(generateSalesBill.fulfilled, (state, action) => { if (action.payload) state.salesOrders.bills.unshift(action.payload); })

      // ── Barcodes ──────────────────────────────────────────────────────────
      .addCase(fetchBarcodeProducts.fulfilled, (state, action) => {
        state.barcode.products = action.payload?.items || action.payload || [];
      })
      .addCase(fetchBarcodeHistory.fulfilled, (state, action) => {
        state.barcode.history = action.payload?.items || action.payload || [];
      })
      .addCase(deleteBarcodeLog.fulfilled, (state, action) => {
        state.barcode.history = state.barcode.history.filter(h => h.id !== action.payload);
      });
  },
});

export const { clearAdminError, cancelAdmin2FA, adminSessionEnded } = adminSlice.actions;
export default adminSlice.reducer;
