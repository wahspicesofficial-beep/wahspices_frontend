import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionEnded } from './slices/authSlice';
import productReducer from './slices/productSlice';
import cartReducer from './slices/cartSlice';
import wishlistReducer from './slices/wishlistSlice';
import orderReducer from './slices/orderSlice';
import adminReducer, { adminSessionEnded } from './slices/adminSlice';
import siteContentReducer from './slices/siteContentSlice';
import notificationsReducer from './slices/notificationsSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    orders: orderReducer,
    admin: adminReducer,
    siteContent: siteContentReducer,
    notifications: notificationsReducer,
  },
});

// services/api.js fires this when a refresh session ends (expired, revoked, or signed out elsewhere)
if (typeof window !== 'undefined') {
  window.addEventListener('wah:session-ended', (e) => {
    store.dispatch(e.detail?.kind === 'admin' ? adminSessionEnded() : sessionEnded());
  });
}

export default store;
