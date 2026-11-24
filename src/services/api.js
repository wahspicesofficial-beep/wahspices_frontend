import axios from 'axios';
import { getHumanProofHeaders } from './humanProof';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5056/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,   // lets the browser store/send the httpOnly refresh cookie (path-scoped to /auth/refresh)
});

// ── Sessions ────────────────────────────────────────────────────────────────
// Access tokens live ONLY in memory (15 min). The refresh token is an httpOnly, SameSite=Strict cookie that
// JavaScript can't read, so an XSS bug can't steal a long-lived credential. localStorage keeps just a
// "signed in" marker (no secret) so a page reload knows to ask /auth/refresh for a new access token.
// Admin (/admin/...) and customer calls keep separate sessions, so being logged into both never mixes them.
const tokens = { customer: null, admin: null };
const MARKER = { customer: 'wah_session', admin: 'wah_admin_session' };
const PROFILE = { customer: 'wah_user', admin: 'wah_admin_user' };

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

// One-time cleanup of the old long-lived tokens that used to sit in localStorage.
['wah_token', 'wah_admin_token'].forEach((k) => store.del(k));

const pathOf = (url = '') => url.replace(BASE_URL, '').split('?')[0].replace(/^\/+/, '');
const isAdminCall = (url = '') => /^admin(\/|$)/.test(pathOf(url));
const kindOf = (url) => (isAdminCall(url) ? 'admin' : 'customer');

// Calls that establish a session themselves — never send/refresh a bearer token for these.
const SESSION_FLOW = /^(auth\/(login|register|refresh|verify-email|resend-email-otp|send-otp|verify-otp|google|forgot-password|reset-password)|admin\/auth\/(login|refresh|first-password|2fa\/verify-login|2fa\/setup-login|2fa\/enable-login))\/?$/;
const isSessionFlow = (url) => SESSION_FLOW.test(pathOf(url));

export const hasSession = (kind) => !!tokens[kind] || store.get(MARKER[kind]) === '1';

/** Called by the auth/admin slices after a successful sign-in (or refresh). */
export function setAuthToken(kind, token) {
  tokens[kind] = token || null;
  if (token) store.set(MARKER[kind], '1');
}

/** Ends ONE session locally (customer or admin) — the other one is untouched. */
export function clearAuthSession(kind) {
  tokens[kind] = null;
  store.del(MARKER[kind]);
  store.del(PROFILE[kind]);
  try { window.dispatchEvent(new CustomEvent('wah:session-ended', { detail: { kind } })); } catch { /* SSR / old browser */ }
}

const expiresSoon = (token) => {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !exp || exp * 1000 - Date.now() < 30000;
  } catch { return true; }
};

const refreshing = { customer: null, admin: null };
function refreshSession(kind) {
  if (!refreshing[kind]) {
    const url = `${BASE_URL}/${kind === 'admin' ? 'admin/' : ''}auth/refresh`;
    refreshing[kind] = axios.post(url, {}, { withCredentials: true, timeout: 15000 })
      .then((res) => {
        const token = res.data?.data?.token;
        if (!token) throw new Error('No token');
        setAuthToken(kind, token);
        return token;
      })
      .catch((err) => {
        // Only a definite "no / bad session" answer signs out; network hiccups keep the marker.
        if (err.response && [401, 403].includes(err.response.status)) clearAuthSession(kind);
        throw err;
      })
      .finally(() => { refreshing[kind] = null; });
  }
  return refreshing[kind];
}

/**
 * A valid access token for `kind`, refreshing it first when it is missing or about to expire.
 * Used by the real-time notifications hub (SignalR accessTokenFactory) so reconnects pick up refreshed tokens.
 * Returns '' when there is no session.
 */
export async function getAccessToken(kind = 'customer') {
  let token = tokens[kind];
  if ((!token || expiresSoon(token)) && hasSession(kind)) {
    try { token = await refreshSession(kind); } catch { token = tokens[kind]; }
  }
  return token || '';
}

/** API origin (e.g. http://localhost:5056) — the SignalR hub lives at `${API_ORIGIN}/hubs/notifications`. */
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

// ── Human proof (proof-of-work) for abuse-prone endpoints — mirrors [RequireHumanProof] on the server ──
const PROOF_RULES = [
  ['post', /^auth\/(register|login|verify-email|resend-email-otp|send-otp|verify-otp|forgot-password|reset-password)\/?$/, 'auth'],
  ['post', /^admin\/auth\/(login|first-password|2fa\/verify-login|2fa\/enable-login)\/?$/, 'admin-auth'],
  ['post', /^contact\/?$/, 'contact'],
  ['post', /^feedback\/?$/, 'feedback'],
  ['post', /^products\/\d+\/reviews\/?$/, 'review'],
  ['post', /^orders\/?$/, 'order'],
  ['get', /^orders\/track\//, 'track'],
  ['post', /^orders\/quote\/?$/, 'quote'],
  ['post', /^cart\/apply-coupon\/?$/, 'coupon'],
];
const proofScope = (method = 'get', url = '') => {
  const p = pathOf(url);
  const m = method.toLowerCase();
  const rule = PROOF_RULES.find(([rm, re]) => rm === m && re.test(p));
  return rule ? rule[2] : null;
};

api.interceptors.request.use(async (config) => {
  const kind = kindOf(config.url);
  if (!isSessionFlow(config.url)) {
    let token = tokens[kind];
    if ((!token || expiresSoon(token)) && hasSession(kind)) {
      try { token = await refreshSession(kind); } catch { token = tokens[kind]; }
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    else delete config.headers.Authorization;
  }
  const scope = proofScope(config.method, config.url);
  if (scope) {
    try { Object.assign(config.headers, await getHumanProofHeaders(BASE_URL, scope)); }
    catch { /* the server will answer 428 with a readable message */ }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const kind = kindOf(config.url);

    // Expired / used-up security challenge → solve a fresh one once.
    if (status === 428 && !config._proofRetry && proofScope(config.method, config.url)) {
      config._proofRetry = true;
      return api(config);
    }

    if (status === 401 && !isSessionFlow(config.url)) {
      // Access token expired or was revoked → refresh once and retry; if that fails, end THIS session only.
      if (!config._authRetry && hasSession(kind)) {
        config._authRetry = true;
        try {
          await refreshSession(kind);
          return api(config);
        } catch { /* fall through */ }
      }
      clearAuthSession(kind);
    }
    return Promise.reject(error);
  }
);

export default api;
