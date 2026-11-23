import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { setAuthToken, clearAuthSession, hasSession } from '@/services/api';

// Only the (non-secret) profile is cached; the access token lives in memory inside services/api.js.
const savedUser = (() => {
  if (!hasSession('customer')) { try { localStorage.removeItem('wah_user'); } catch { /* private mode */ } return null; }
  try { return JSON.parse(localStorage.getItem('wah_user')); } catch { return null; }
})();

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Registration failed');
  }
});

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue, dispatch }) => {
  try {
    const res = await api.post('/auth/login', data);
    return res.data.data;
  } catch (err) {
    // Correct password but e-mail not verified yet: a fresh code was sent → show the verify step.
    if (err.response?.data?.error?.code === 'EMAIL_NOT_VERIFIED' && data?.email) {
      const email = String(data.email).trim().toLowerCase();
      const at = email.indexOf('@');
      dispatch(setPendingEmail({ email, maskedEmail: at > 1 ? `${email[0]}${'*'.repeat(Math.min(at - 1, 4))}${email.slice(at)}` : email }));
    }
    return rejectWithValue(err.response?.data?.error?.message || 'Login failed');
  }
});

export const sendOtp = createAsyncThunk('auth/sendOtp', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/send-otp', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to send OTP');
  }
});

export const verifyOtp = createAsyncThunk('auth/verifyOtp', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/verify-otp', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invalid OTP');
  }
});

export const getProfile = createAsyncThunk('auth/getProfile', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to get profile');
  }
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (data, { rejectWithValue }) => {
  try {
    const res = await api.put('/auth/me', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Update failed');
  }
});

export const changePassword = createAsyncThunk('auth/changePassword', async (data, { rejectWithValue }) => {
  try {
    const res = await api.put('/auth/change-password', data);
    // Other devices are signed out; this one gets a fresh session.
    if (res.data?.data?.token) setAuthToken('customer', res.data.data.token);
    return res.data.message;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Password change failed');
  }
});

export const verifyEmailOtp = createAsyncThunk('auth/verifyEmailOtp', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/verify-email', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invalid OTP');
  }
});

export const resendEmailOtp = createAsyncThunk('auth/resendEmailOtp', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/resend-email-otp', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to resend OTP');
  }
});

export const googleLogin = createAsyncThunk('auth/googleLogin', async (googleToken, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/google', { googleToken });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Google login failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch { /* ignore */ }
  clearAuthSession('customer');
});

export const fetchAddresses = createAsyncThunk('auth/fetchAddresses', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me/addresses');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch addresses');
  }
});

export const addAddress = createAsyncThunk('auth/addAddress', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/me/addresses', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to add address');
  }
});

export const updateAddress = createAsyncThunk('auth/updateAddress', async ({ id, ...data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/auth/me/addresses/${id}`, data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to update address');
  }
});

export const deleteAddress = createAsyncThunk('auth/deleteAddress', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/auth/me/addresses/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to delete address');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: savedUser,
    token: null,   // kept in memory by services/api.js; never persisted
    isAuthenticated: hasSession('customer'),
    loading: false,
    error: null,
    otpSent: false,
    phoneForOtp: '',
    pendingEmail: null,      // set after register — waiting for email OTP
    maskedEmail: null,
    addresses: [],
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    // api.js signals that the refresh session ended (expired / revoked) — drop the signed-in state
    sessionEnded: (state) => { state.user = null; state.token = null; state.isAuthenticated = false; state.addresses = []; },
    setOtpPhone: (state, action) => { state.phoneForOtp = action.payload; },
    clearPendingEmail: (state) => { state.pendingEmail = null; state.maskedEmail = null; },
    setPendingEmail: (state, action) => { state.pendingEmail = action.payload.email; state.maskedEmail = action.payload.maskedEmail; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(registerUser.pending, pending)
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        // Backend now returns { email, maskedEmail } — OTP verification required
        if (action.payload?.email) {
          state.pendingEmail = action.payload.email;
          state.maskedEmail = action.payload.maskedEmail;
        }
      })
      .addCase(registerUser.rejected, rejected)

      .addCase(verifyEmailOtp.pending, pending)
      .addCase(verifyEmailOtp.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.token) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.pendingEmail = null;
          state.maskedEmail = null;
          setAuthToken('customer', action.payload.token);
          localStorage.setItem('wah_user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(verifyEmailOtp.rejected, rejected)

      .addCase(resendEmailOtp.pending, (state) => { state.loading = true; })
      .addCase(resendEmailOtp.fulfilled, (state) => { state.loading = false; })
      .addCase(resendEmailOtp.rejected, rejected)

      .addCase(loginUser.pending, pending)
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.token) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
          setAuthToken('customer', action.payload.token);
          localStorage.setItem('wah_user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(loginUser.rejected, rejected)

      .addCase(googleLogin.pending, pending)
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.token) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
          setAuthToken('customer', action.payload.token);
          localStorage.setItem('wah_user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(googleLogin.rejected, rejected)

      .addCase(sendOtp.pending, pending)
      .addCase(sendOtp.fulfilled, (state) => { state.loading = false; state.otpSent = true; })
      .addCase(sendOtp.rejected, rejected)

      .addCase(verifyOtp.pending, pending)
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.token) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.otpSent = false;
          setAuthToken('customer', action.payload.token);
          localStorage.setItem('wah_user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(verifyOtp.rejected, rejected)

      .addCase(getProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem('wah_user', JSON.stringify(action.payload));
      })

      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('wah_user', JSON.stringify(state.user));
      })

      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.addresses = [];
      })

      .addCase(fetchAddresses.fulfilled, (state, action) => { state.addresses = action.payload || []; })
      .addCase(addAddress.fulfilled, (state, action) => { if (action.payload) state.addresses.push(action.payload); })
      .addCase(updateAddress.fulfilled, (state, action) => {
        if (action.payload) {
          const idx = state.addresses.findIndex((a) => a.id === action.payload.id);
          if (idx !== -1) state.addresses[idx] = action.payload;
        }
      })
      .addCase(deleteAddress.fulfilled, (state, action) => {
        state.addresses = state.addresses.filter((a) => a.id !== action.payload);
      });
  },
});

export const { clearError, setOtpPhone, clearPendingEmail, setPendingEmail, sessionEnded } = authSlice.actions;
export default authSlice.reducer;
