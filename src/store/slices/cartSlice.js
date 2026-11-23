import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '@/services/api';
import { useSiteContent } from '@/content/useSiteContent';

// Each cart line is identified by cartKey = "<productId>-<variantId>" so different
// pack sizes of the same product are separate lines. Older carts only had `id`.
export const lineKey = (item) => item?.cartKey ?? String(item?.id);

const loadLocalCart = () => {
  try {
    const items = JSON.parse(localStorage.getItem('wah_cart')) || [];
    return items.map((i) => ({ ...i, cartKey: lineKey(i) }));
  } catch { return []; }
};

const saveLocalCart = (items) => {
  localStorage.setItem('wah_cart', JSON.stringify(items));
};

export const fetchCart = createAsyncThunk('cart/fetch', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/cart');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch cart');
  }
});

export const addToCartApi = createAsyncThunk('cart/addItem', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/cart/add', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to add to cart');
  }
});

export const updateCartItemApi = createAsyncThunk('cart/updateItem', async (data, { rejectWithValue }) => {
  try {
    const res = await api.put('/cart/update', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update cart');
  }
});

export const removeFromCartApi = createAsyncThunk('cart/removeItem', async (productId, { rejectWithValue }) => {
  try {
    await api.delete(`/cart/remove/${productId}`);
    return productId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to remove from cart');
  }
});

export const clearCartApi = createAsyncThunk('cart/clearApi', async (_, { rejectWithValue }) => {
  try {
    await api.delete('/cart/clear');
    return true;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to clear cart');
  }
});

// Lines sent to the server for pricing — the same shape POST /api/orders takes.
export const quoteLines = (items) => items.map((i) => ({
  productId: i.productId ?? i.id,
  variantId: i.variantId ?? null,
  quantity: i.quantity || 1,
}));

/**
 * POST /api/orders/quote — prices the cart exactly as order placement will (SiteSettings delivery charge,
 * free-delivery threshold, coupon, stock). Public, so guest carts get the same numbers.
 */
export const fetchQuote = createAsyncThunk('cart/quote', async ({ items, couponCode }, { rejectWithValue }) => {
  try {
    const res = await api.post('/orders/quote', { items: quoteLines(items), couponCode: couponCode || null });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Could not price your cart');
  }
});

// Validates a coupon against the current cart via the quote endpoint (works for guests too).
export const applyCoupon = createAsyncThunk('cart/applyCoupon', async (code, { getState, rejectWithValue }) => {
  try {
    const couponCode = String(code || '').trim().toUpperCase();
    const res = await api.post('/orders/quote', { items: quoteLines(getState().cart.items), couponCode });
    const q = res.data.data;
    if (q.couponError) return rejectWithValue(q.couponError);
    return { code: q.couponCode, discountAmount: q.couponDiscount, quote: q };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invalid coupon');
  }
});

export const removeCoupon = createAsyncThunk('cart/removeCoupon', async () => true);

/** Delivery / COD / maintenance settings from GET /api/site-content (shipped defaults until it loads). */
export function useStoreSettings() {
  return useSiteContent().settings;
}

/**
 * Live server quote for the current cart (debounced). Returns { quote, loading, error }.
 * Totals shown to the customer must come from here — it is exactly what the order will charge.
 */
export function useCartQuote() {
  const dispatch = useDispatch();
  const items = useSelector((s) => s.cart.items);
  const couponCode = useSelector((s) => s.cart.couponResult?.code || null);
  const { quote, quoteLoading, quoteError } = useSelector((s) => s.cart);
  const key = JSON.stringify([quoteLines(items), couponCode]);
  useEffect(() => {
    if (!items.length) return undefined;
    const t = setTimeout(() => { dispatch(fetchQuote({ items, couponCode })); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dispatch]);
  return { quote: items.length ? quote : null, loading: quoteLoading, error: quoteError };
}

export const syncCartWithBackend = createAsyncThunk('cart/sync', async (items, { rejectWithValue }) => {
  try {
    const res = await api.post('/cart/sync', { items });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Cart sync failed');
  }
});

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: loadLocalCart(),
    couponResult: null,
    quote: null,
    quoteLoading: false,
    quoteError: null,
    drawerOpen: false,
    loading: false,
    error: null,
  },
  reducers: {
    // payload: a cart line (see utils/product toCartItem), optional `quantity` to add
    addItem: (state, action) => {
      const { quantity: addQty, ...line } = action.payload;
      const key = lineKey(line);
      const qty = Math.max(1, addQty || 1);
      const existing = state.items.find((i) => lineKey(i) === key);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + qty;
      } else {
        state.items.push({ ...line, cartKey: key, quantity: qty });
      }
      saveLocalCart(state.items);
    },
    // payload: cartKey (or legacy product id)
    removeItem: (state, action) => {
      const key = String(action.payload);
      state.items = state.items.filter((i) => lineKey(i) !== key);
      saveLocalCart(state.items);
    },
    // payload: { key, quantity } — `id` accepted for backwards compatibility
    updateQuantity: (state, action) => {
      const { key: k, id, quantity } = action.payload;
      const key = String(k ?? id);
      const item = state.items.find((i) => lineKey(i) === key);
      if (item) {
        if (quantity <= 0) {
          state.items = state.items.filter((i) => lineKey(i) !== key);
        } else {
          item.quantity = quantity;
        }
      }
      saveLocalCart(state.items);
    },
    clearCart: (state) => {
      state.items = [];
      state.couponResult = null;
      state.quote = null;
      saveLocalCart([]);
    },
    openDrawer: (state) => { state.drawerOpen = true; },
    closeDrawer: (state) => { state.drawerOpen = false; },
    toggleDrawer: (state) => { state.drawerOpen = !state.drawerOpen; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => { state.loading = true; })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.items) {
          state.items = action.payload.items;
          saveLocalCart(state.items);
        }
      })
      .addCase(fetchCart.rejected, (state) => { state.loading = false; })

      .addCase(addToCartApi.fulfilled, (state, action) => {
        if (action.payload?.items) {
          state.items = action.payload.items;
          saveLocalCart(state.items);
        }
      })

      .addCase(updateCartItemApi.fulfilled, (state, action) => {
        if (action.payload?.items) {
          state.items = action.payload.items;
          saveLocalCart(state.items);
        }
      })

      .addCase(removeFromCartApi.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i.id !== action.payload && i.productId !== action.payload);
        saveLocalCart(state.items);
      })

      .addCase(clearCartApi.fulfilled, (state) => {
        state.items = [];
        state.couponResult = null;
        saveLocalCart([]);
      })

      .addCase(applyCoupon.fulfilled, (state, action) => {
        const { quote, ...coupon } = action.payload;
        state.couponResult = coupon;
        state.quote = quote;
      })
      .addCase(applyCoupon.rejected, (state, action) => { state.error = action.payload; })
      .addCase(removeCoupon.fulfilled, (state) => { state.couponResult = null; })

      .addCase(fetchQuote.pending, (state) => { state.quoteLoading = true; })
      .addCase(fetchQuote.fulfilled, (state, action) => {
        state.quoteLoading = false;
        state.quoteError = null;
        state.quote = action.payload;
        // a coupon that stopped applying (cart changed below its minimum, expired…) is dropped
        if (state.couponResult && action.payload?.couponError) state.couponResult = null;
      })
      .addCase(fetchQuote.rejected, (state, action) => { state.quoteLoading = false; state.quoteError = action.payload; })

      .addCase(syncCartWithBackend.fulfilled, (state, action) => {
        if (action.payload?.items) {
          state.items = action.payload.items;
          saveLocalCart(state.items);
        }
      });
  },
});

export const { addItem, removeItem, updateQuantity, clearCart, openDrawer, closeDrawer, toggleDrawer } = cartSlice.actions;
export default cartSlice.reducer;
