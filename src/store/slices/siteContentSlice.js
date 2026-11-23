import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

/** GET /api/site-content → { settings, blocks, testimonials }. Loaded once by SiteContentGate. */
export const fetchSiteContent = createAsyncThunk('siteContent/fetch', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/site-content');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to load site content');
  }
});

const siteContentSlice = createSlice({
  name: 'siteContent',
  initialState: { settings: null, blocks: null, testimonials: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchSiteContent.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchSiteContent.fulfilled, (s, a) => {
        s.status = 'ready';
        s.settings = a.payload?.settings || null;
        s.blocks = a.payload?.blocks || null;
        s.testimonials = Array.isArray(a.payload?.testimonials) ? a.payload.testimonials : [];
      })
      .addCase(fetchSiteContent.rejected, (s, a) => { s.status = 'error'; s.error = a.payload; });
  },
});

export default siteContentSlice.reducer;
