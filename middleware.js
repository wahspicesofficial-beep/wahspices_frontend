/* global process */
// Vercel Routing Middleware for the same-site API proxy (/api/* → wahspices.runasp.net, see vercel.json).
//
// Behind the proxy every request reaches the API from a Vercel IP, which would make per-IP rate limits,
// login lockouts and proof-of-work treat all visitors as one. This passes the visitor's real IP along with a
// shared secret (Vercel env API_PROXY_SECRET = the API's Security__ProxySecret). The API only trusts the IP
// header when the secret matches, so nobody can spoof it by calling the API directly.
import { ipAddress, next } from '@vercel/functions';

export const config = { matcher: ['/api/:path*'] };

export default function middleware(request) {
  const headers = new Headers(request.headers);
  // never forward values a browser may have sent for these
  headers.delete('x-wah-client-ip');
  headers.delete('x-wah-proxy-key');

  const secret = process.env.API_PROXY_SECRET;
  const ip = ipAddress(request);
  if (secret && ip) {
    headers.set('x-wah-client-ip', ip);
    headers.set('x-wah-proxy-key', secret);
  }
  return next({ request: { headers } });
}
