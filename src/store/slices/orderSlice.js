import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const placeOrder = createAsyncThunk('orders/place', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/orders', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to place order');
  }
});

export const fetchOrders = createAsyncThunk('orders/fetchAll', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/orders', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch orders');
  }
});

export const fetchOrderDetail = createAsyncThunk('orders/fetchDetail', async (orderId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/orders/${orderId}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Order not found');
  }
});

// Public tracking needs the phone or email used on the order; logged-in customers can omit it for their own orders.
export const trackOrder = createAsyncThunk('orders/track', async (arg, { rejectWithValue }) => {
  const { orderNumber, contact } = typeof arg === 'string' ? { orderNumber: arg } : (arg || {});
  try {
    const res = await api.get(`/orders/track/${encodeURIComponent(String(orderNumber || '').trim())}`, {
      params: contact ? { contact: String(contact).trim() } : undefined,
    });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Order not found');
  }
});

export const cancelOrder = createAsyncThunk('orders/cancel', async ({ orderId, reason }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/orders/${orderId}/cancel`, { reason });
    return { orderId, message: res.data.message };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to cancel order');
  }
});

export const fetchMyReturns = createAsyncThunk('orders/fetchReturns', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/returns', { params: { page: 1, limit: 50, ...params } });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to load returns');
  }
});

export const previewReturn = createAsyncThunk('orders/previewReturn', async ({ orderId, items }, { rejectWithValue }) => {
  try {
    const res = await api.post('/returns/preview', { orderId, items });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Could not calculate the refund');
  }
});

// body: { orderId, type: 'Refund', reason, items: [{ orderItemId, quantity, reason, condition }], preferredRefundMethod }
export const requestReturn = createAsyncThunk('orders/requestReturn', async (body, { rejectWithValue }) => {
  try {
    const res = await api.post('/returns', body);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to submit return request');
  }
});

export const cancelReturn = createAsyncThunk('orders/cancelReturn', async (returnId, { rejectWithValue }) => {
  try {
    await api.post(`/returns/${returnId}/cancel`);
    return returnId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to cancel return');
  }
});

const orderSlice = createSlice({
  name: 'orders',
  initialState: {
    items: [],
    currentOrder: null,
    trackingData: null,
    loading: false,
    error: null,
    total: 0,
    placedOrder: null,
    returns: [],
  },
  reducers: {
    clearTrackingData: (state) => { state.trackingData = null; state.error = null; },
    clearPlacedOrder: (state) => { state.placedOrder = null; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(placeOrder.pending, pending)
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.placedOrder = action.payload;
      })
      .addCase(placeOrder.rejected, rejected)

      .addCase(fetchOrders.pending, pending)
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload?.items || action.payload || [];
        state.total = action.payload?.total || state.items.length;
      })
      .addCase(fetchOrders.rejected, rejected)

      .addCase(fetchOrderDetail.pending, pending)
      .addCase(fetchOrderDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload;
      })
      .addCase(fetchOrderDetail.rejected, rejected)

      .addCase(trackOrder.pending, pending)
      .addCase(trackOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.trackingData = action.payload;
      })
      .addCase(trackOrder.rejected, rejected)

      .addCase(fetchMyReturns.fulfilled, (state, action) => { state.returns = action.payload?.items || []; })

      .addCase(cancelOrder.fulfilled, (state, action) => {
        const order = state.items.find((o) => o.id === action.payload.orderId);
        if (order) { order.status = 'Cancelled'; order.canCancel = false; }
        if (state.currentOrder?.id === action.payload.orderId) { state.currentOrder.status = 'Cancelled'; state.currentOrder.canCancel = false; }
      });
  },
});

export const { clearTrackingData, clearPlacedOrder } = orderSlice.actions;
export default orderSlice.reducer;
