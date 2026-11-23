/* global process, __dirname */ // Node-side config file
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Content-Security-Policy for the production build.
 * Allows exactly what the site uses: own origin, the API (VITE_API_URL), Google Fonts,
 * Razorpay Checkout, Google Sign-In, Google Maps embed (Contact page), any https image
 * (admin-entered images / CDN), and Web Workers from self/blob (proof-of-work solver).
 * No 'unsafe-eval' and no inline scripts. 'unsafe-inline' is allowed for STYLES only
 * (react-hot-toast / Razorpay inject <style> tags; the page loader uses an inline <style>).
 */
function buildCsp(apiOrigin, { forHeader = false } = {}) {
  const api = apiOrigin ? ` ${apiOrigin}` : '';
  // SignalR notifications hub (/hubs/notifications) uses a WebSocket to the API host: ws(s)://<api origin>
  const ws = apiOrigin ? ` ${apiOrigin.replace(/^http/, 'ws')}` : '';
  const directives = [
    "default-src 'self'",
    "script-src 'self' https://checkout.razorpay.com https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: https:${api}`,
    `connect-src 'self'${api}${ws} https://api.razorpay.com https://lumberjack.razorpay.com https://accounts.google.com/gsi/`,
    'frame-src https://api.razorpay.com https://checkout.razorpay.com https://accounts.google.com/gsi/ https://www.google.com https://maps.google.com',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.razorpay.com",
  ];
  // frame-ancestors / report-uri are ignored in <meta>; only send them as a real header.
  if (forHeader) directives.push("frame-ancestors 'none'");
  if (apiOrigin?.startsWith('https://')) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function securityHeadersPlugin(apiOrigin) {
  return {
    name: 'wah-security-headers',
    apply: 'build', // dev server needs inline react-refresh preamble + HMR websocket
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(apiOrigin)}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`;
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${meta}`);
    },
    generateBundle() {
      // Netlify / Cloudflare Pages format. For Vercel/nginx/IIS copy the same headers (see SECURITY notes in report).
      const headers = [
        '/*',
        `  Content-Security-Policy: ${buildCsp(apiOrigin, { forHeader: true })}`,
        '  X-Content-Type-Options: nosniff',
        '  X-Frame-Options: DENY',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com"), usb=(), interest-cohort=()',
        '  Cross-Origin-Opener-Policy: same-origin-allow-popups',
        '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: '_headers', source: headers });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  let apiOrigin = '';
  try { apiOrigin = new URL(env.VITE_API_URL || 'http://localhost:5056/api').origin; } catch { /* relative API URL → 'self' */ }

  return {
    plugins: [react(), securityHeadersPlugin(apiOrigin)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    build: {
      sourcemap: false, // never ship source maps to production
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion'],
            'vendor-ui': ['lucide-react', 'react-hot-toast'],
            'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          },
        },
      },
    },
  };
});
