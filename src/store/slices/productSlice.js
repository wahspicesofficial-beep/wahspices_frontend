import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
import { normalizeProduct, normalizeList } from '@/utils/product';

export const fetchProducts = createAsyncThunk('products/fetchAll', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/products', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch products');
  }
});

export const fetchFeaturedProducts = createAsyncThunk('products/fetchFeatured', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/products/featured');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch featured products');
  }
});

export const fetchCategories = createAsyncThunk('products/fetchCategories', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/categories');
    return res.data.data; // [{id, name, slug, icon, description, displayOrder, isActive}]
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch categories');
  }
});

export const fetchProductBySlug = createAsyncThunk('products/fetchBySlug', async (slug, { rejectWithValue }) => {
  try {
    const res = await api.get(`/products/${slug}`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Product not found');
  }
});

export const fetchRelatedProducts = createAsyncThunk('products/fetchRelated', async (arg, { rejectWithValue }) => {
  try {
    const { id, category } = typeof arg === 'object' ? arg : { id: arg, category: undefined };
    const res = await api.get(`/products/${id}/related`, { params: { category } });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch related products');
  }
});

export const fetchProductReviews = createAsyncThunk('products/fetchReviews', async (arg, { rejectWithValue }) => {
  try {
    // arg: productId, or { productId, page, limit, rating, sort } — only approved reviews are returned
    const { productId, ...params } = typeof arg === 'object' ? arg : { productId: arg };
    const res = await api.get(`/products/${productId}/reviews`, { params: { limit: 10, ...params } });
    return { ...res.data.data, append: (params.page || 1) > 1 };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch reviews');
  }
});

/** The signed-in customer's own review (any status) — null when they haven't reviewed / aren't signed in. */
export const fetchMyReview = createAsyncThunk('products/fetchMyReview', async (productId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/products/${productId}/reviews/mine`);
    return res.data.data || null;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to load your review');
  }
});

export const submitReview = createAsyncThunk('products/submitReview', async ({ productId, ...data }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/products/${productId}/reviews`, data);
    return { review: res.data.data, message: res.data.message };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to submit review');
  }
});

export const searchProducts = createAsyncThunk('products/search', async (query, { rejectWithValue }) => {
  try {
    const res = await api.get('/products/search', { params: { q: query } });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Search failed');
  }
});

const productSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    featured: [],
    categories: [],
    currentProduct: null,
    relatedProducts: [],
    reviews: [],
    reviewsTotal: 0,
    reviewsPage: 1,
    reviewsLoading: false,
    myReview: null,
    loading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 12,
    selectedCategory: 'All',
    searchQuery: '',
  },
  reducers: {
    setSelectedCategory: (state, action) => { state.selectedCategory = action.payload; },
    setSearchQuery: (state, action) => { state.searchQuery = action.payload; },
    setPage: (state, action) => { state.page = action.payload; },
    clearCurrentProduct: (state) => { state.currentProduct = null; state.relatedProducts = []; state.reviews = []; state.reviewsTotal = 0; state.myReview = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = normalizeList(action.payload);
        state.total = action.payload?.total || state.items.length;
        state.page = action.payload?.page || 1;
      })
      .addCase(fetchProducts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchFeaturedProducts.fulfilled, (state, action) => {
        state.featured = normalizeList(action.payload);
      })

      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload || [];
      })

      .addCase(fetchProductBySlug.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchProductBySlug.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProduct = normalizeProduct(action.payload);
      })
      .addCase(fetchProductBySlug.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchRelatedProducts.fulfilled, (state, action) => {
        state.relatedProducts = normalizeList(action.payload);
      })

      .addCase(fetchProductReviews.pending, (state) => { state.reviewsLoading = true; })
      .addCase(fetchProductReviews.fulfilled, (state, action) => {
        const items = action.payload?.items || [];
        state.reviewsLoading = false;
        state.reviews = action.payload?.append ? [...state.reviews, ...items] : items;
        state.reviewsTotal = action.payload?.total ?? items.length;
        state.reviewsPage = action.payload?.page || 1;
      })
      .addCase(fetchProductReviews.rejected, (state) => { state.reviewsLoading = false; })

      .addCase(fetchMyReview.pending, (state) => { state.myReview = null; })
      .addCase(fetchMyReview.fulfilled, (state, action) => { state.myReview = action.payload; })

      .addCase(submitReview.fulfilled, (state, action) => {
        const review = action.payload?.review;
        if (!review) return;
        state.myReview = review;
        // Pending reviews stay private until an admin approves them
        if (review.status === 'Approved') { state.reviews.unshift(review); state.reviewsTotal += 1; }
      })

      .addCase(searchProducts.pending, (state) => { state.loading = true; })
      .addCase(searchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = normalizeList(action.payload);
        state.total = action.payload?.total || state.items.length;
      })
      .addCase(searchProducts.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { setSelectedCategory, setSearchQuery, setPage, clearCurrentProduct } = productSlice.actions;
export default productSlice.reducer;
