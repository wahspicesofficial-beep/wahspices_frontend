// Where the API lives.
//
// Production (Vercel): the website calls its OWN origin — /api/... and /uploads/... — and Vercel proxies those
// to the .NET API (vercel.json rewrites + middleware.js). Same site → the httpOnly SameSite=Strict refresh
// cookie is a first-party cookie, so a page reload keeps you signed in (also on Safari / iPhone).
// Development: the API URL from .env (http://localhost:5056/api).
//
// Two things still talk to the API host directly (bearer token only — no cookies involved):
//   • the SignalR notifications hub — the proxy can't carry WebSockets
//   • large multipart uploads — the proxy caps request bodies at ~4 MB
const configured = (import.meta.env.VITE_API_URL || 'http://localhost:5056/api').replace(/\/+$/, '');
const configuredOrigin = /^https?:\/\//i.test(configured) ? configured.replace(/\/api$/i, '') : '';

/** Base URL for API calls. */
export const API_URL = import.meta.env.PROD ? '/api' : configured;
/** Origin that serves /uploads/... images ('' = this site, proxied in production). */
export const ASSET_ORIGIN = import.meta.env.PROD ? '' : configuredOrigin;
/** The API host itself (VITE_API_URL), for the hub and large uploads. */
export const DIRECT_API_ORIGIN = configuredOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
export const DIRECT_API_URL = `${DIRECT_API_ORIGIN}/api`;
