import { createSlice } from '@reduxjs/toolkit';

const loadLocalWishlist = () => {
  try { return JSON.parse(localStorage.getItem('wah_wishlist')) || []; } catch { return []; }
};

const saveLocalWishlist = (items) => {
  localStorage.setItem('wah_wishlist', JSON.stringify(items));
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: {
    items: loadLocalWishlist(),
  },
  reducers: {
    toggleWishlistItem: (state, action) => {
      const product = action.payload;
      const exists = state.items.find((i) => i.id === product.id);
      if (exists) {
        state.items = state.items.filter((i) => i.id !== product.id);
      } else {
        state.items.push(product);
      }
      saveLocalWishlist(state.items);
    },
    removeFromWishlist: (state, action) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
      saveLocalWishlist(state.items);
    },
    clearWishlist: (state) => {
      state.items = [];
      saveLocalWishlist([]);
    },
  },
});

export const { toggleWishlistItem, removeFromWishlist, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
