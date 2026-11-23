import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
import { sessionEnded, logoutUser } from './authSlice';

// Customer broadcast notifications (bell + banners).
// The bell lists UNREAD notifications only — once read an item disappears (the store owner's rule).
// Banners: unread, not-yet-closed broadcasts that should pop up (see components/notifications).

export const fetchNotificationSummary = createAsyncThunk('notifications/summary', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/notifications/summary', { params: { take: 20 } });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.status || 0);
  }
});

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id) => {
  await api.post(`/notifications/${id}/read`);
  return id;
});

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async () => {
  await api.post('/notifications/read-all');
  return true;
});

export const dismissBanner = createAsyncThunk('notifications/dismissBanner', async (id) => {
  await api.post(`/notifications/${id}/banner-dismissed`);
  return id;
});

const initialState = {
  items: [],          // unread notifications, newest first
  unreadCount: 0,
  banners: [],        // queue of banners to show, oldest first
  loaded: false,
  live: false,        // real-time socket connected
};

const sortNewest = (list) => [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /** Pushed over SignalR: a new broadcast for this user. */
    notificationReceived: (state, { payload: n }) => {
      if (!n || state.items.some((i) => i.id === n.id)) return;
      state.items = sortNewest([n, ...state.items]).slice(0, 50);
      state.unreadCount += 1;
      if (n.bannerPending && !state.banners.some((b) => b.id === n.id)) state.banners.push(n);
    },
    /** Admin ended the broadcast early: no more banner (it stays in the bell until read). */
    broadcastEnded: (state, { payload: id }) => {
      state.banners = state.banners.filter((b) => b.id !== id);
      state.items = state.items.map((i) => (i.id === id ? { ...i, bannerPending: false } : i));
    },
    /** Admin deleted the broadcast: drop it everywhere. */
    broadcastRemoved: (state, { payload: id }) => {
      const had = state.items.some((i) => i.id === id);
      state.items = state.items.filter((i) => i.id !== id);
      state.banners = state.banners.filter((b) => b.id !== id);
      if (had) state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    /** Another tab / device read or closed something. */
    notificationStateSynced: (state, { payload }) => {
      if (payload?.all && payload.readAt) {
        state.items = []; state.unreadCount = 0; state.banners = [];
        return;
      }
      const id = payload?.id;
      if (!id) return;
      if (payload.readAt) {
        const had = state.items.some((i) => i.id === id);
        state.items = state.items.filter((i) => i.id !== id);
        if (had) state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.banners = state.banners.filter((b) => b.id !== id);
      }
      if (payload.bannerSeenAt) state.banners = state.banners.filter((b) => b.id !== id);
    },
    setLive: (state, { payload }) => { state.live = !!payload; },
    resetNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationSummary.fulfilled, (state, { payload }) => {
        state.items = payload?.items || [];
        state.unreadCount = payload?.unreadCount || 0;
        // keep the order of banners already queued; add new ones
        const incoming = payload?.banners || [];
        const kept = state.banners.filter((b) => incoming.some((x) => x.id === b.id));
        incoming.forEach((b) => { if (!kept.some((k) => k.id === b.id)) kept.push(b); });
        state.banners = kept;
        state.loaded = true;
      })
      // optimistic: the item leaves the list immediately
      .addCase(markNotificationRead.pending, (state, { meta }) => {
        const id = meta.arg;
        const had = state.items.some((i) => i.id === id);
        state.items = state.items.filter((i) => i.id !== id);
        state.banners = state.banners.filter((b) => b.id !== id);
        if (had) state.unreadCount = Math.max(0, state.unreadCount - 1);
      })
      .addCase(markAllNotificationsRead.pending, (state) => {
        state.items = []; state.unreadCount = 0; state.banners = [];
      })
      .addCase(dismissBanner.pending, (state, { meta }) => {
        const id = meta.arg;
        state.banners = state.banners.filter((b) => b.id !== id);
        state.items = state.items.map((i) => (i.id === id ? { ...i, bannerPending: false } : i));
      })
      .addCase(sessionEnded, () => initialState)
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(logoutUser.rejected, () => initialState);
  },
});

export const {
  notificationReceived, broadcastEnded, broadcastRemoved, notificationStateSynced, setLive, resetNotifications,
} = notificationsSlice.actions;
export default notificationsSlice.reducer;
