// Human proof for abuse-prone API calls (login, OTP, contact, orders, tracking …).
// The server hands out a signed, single-use, 2-minute challenge; we find a nonce so that
// SHA-256(salt + ':' + nonce) starts with `difficulty` zero bits, in a Web Worker so the UI never freezes.
// Optional Cloudflare Turnstile token on top when the server reports a site key.
import axios from 'axios';

// ── SHA-256 leading-zero search (runs inside a Worker; also usable on the main thread) ───────────
const SOLVER_SOURCE = `
const K = new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const W = new Uint32Array(64);
const B = new Uint8Array(64);
function leadingZeros(len) {           // hashes B[0..len) (single block, len <= 55)
  B[len] = 0x80;
  for (let i = len + 1; i < 62; i++) B[i] = 0;
  const bits = len * 8; B[62] = (bits >>> 8) & 255; B[63] = bits & 255;
  for (let i = 0; i < 16; i++) W[i] = (B[i*4] << 24) | (B[i*4+1] << 16) | (B[i*4+2] << 8) | B[i*4+3];
  for (let i = 16; i < 64; i++) {
    const a = W[i-15], b = W[i-2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i-16] + s0 + W[i-7] + s1) | 0;
  }
  let a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0xa54ff53a, e = 0x510e527f, f = 0x9b05688c, g = 0x1f83d9ab, h = 0x5be0cd19;
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  const h0 = (0x6a09e667 + a) | 0;
  if (h0 !== 0) return Math.clz32(h0);
  return 32 + Math.clz32((0xbb67ae85 + b) | 0);
}
function solve(salt, difficulty, start, count) {
  const prefix = salt + ':';
  for (let i = 0; i < prefix.length; i++) B[i] = prefix.charCodeAt(i);
  const end = start + count;
  for (let n = start; n < end; n++) {
    const s = String(n);
    let len = prefix.length;
    for (let i = 0; i < s.length; i++) B[len++] = s.charCodeAt(i);
    if (leadingZeros(len) >= difficulty) return n;
  }
  return -1;
}
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (e) => {
    const { salt, difficulty } = e.data;
    for (let start = 0; ; start += 1000000) {
      const n = solve(salt, difficulty, start, 1000000);
      if (n >= 0) { self.postMessage({ nonce: n }); return; }
    }
  };
}
`;

let workerUrl = null;
let mainThreadSolve = null;

function solveInWorker(salt, difficulty) {
  return new Promise((resolve, reject) => {
    try {
      if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([SOLVER_SOURCE], { type: 'text/javascript' }));
      const w = new Worker(workerUrl);
      const timer = setTimeout(() => { w.terminate(); reject(new Error('Security check timed out')); }, 60000);
      w.onmessage = (e) => { clearTimeout(timer); w.terminate(); resolve(e.data.nonce); };
      w.onerror = (err) => { clearTimeout(timer); w.terminate(); reject(err); };
      w.postMessage({ salt, difficulty });
    } catch (err) { reject(err); }
  });
}

// Fallback when Workers are unavailable (old browser / strict CSP): small chunks, yielding to the UI.
async function solveOnMainThread(salt, difficulty) {
  if (!mainThreadSolve) {
    // eslint-disable-next-line no-new-func
    mainThreadSolve = new Function(`${SOLVER_SOURCE}; return solve;`)();
  }
  for (let start = 0; start < 1e9; start += 20000) {
    const n = mainThreadSolve(salt, difficulty, start, 20000);
    if (n >= 0) return n;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('Security check failed');
}

async function solve(salt, difficulty) {
  try { return await solveInWorker(salt, difficulty); }
  catch { return solveOnMainThread(salt, difficulty); }
}

// ── Optional Cloudflare Turnstile ────────────────────────────────────────────
let turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoading) {
    turnstileLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => { turnstileLoading = null; reject(new Error('Turnstile failed to load')); };
      document.head.appendChild(s);
    });
  }
  return turnstileLoading;
}

async function getTurnstileToken(siteKey) {
  const ts = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    // Invisible unless Cloudflare decides it needs an interaction — then it appears bottom-right.
    host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;';
    document.body.appendChild(host);
    const done = (fn, v) => { try { ts.remove(id); } catch { /* ignore */ } host.remove(); fn(v); };
    const id = ts.render(host, {
      sitekey: siteKey,
      appearance: 'interaction-only',
      callback: (token) => done(resolve, token),
      'error-callback': () => done(reject, new Error('Turnstile check failed')),
      'timeout-callback': () => done(reject, new Error('Turnstile timed out')),
    });
  });
}

/**
 * Fetches + solves a challenge for `scope`. Returns headers to attach:
 * { 'X-PoW-Proof': 'challenge:nonce', 'X-Captcha-Token'?: '…' } (empty object when the server has it disabled).
 */
export async function getHumanProofHeaders(baseUrl, scope) {
  const res = await axios.get(`${baseUrl}/security/challenge`, { params: { scope }, timeout: 10000 });
  const c = res.data?.data;
  if (!c || c.enabled === false) return {};
  const nonce = await solve(c.salt, c.difficulty);
  const headers = { 'X-PoW-Proof': `${c.challenge}:${nonce}` };
  if (c.turnstileSiteKey) headers['X-Captcha-Token'] = await getTurnstileToken(c.turnstileSiteKey);
  return headers;
}
