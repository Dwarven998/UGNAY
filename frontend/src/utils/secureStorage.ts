/**
 * UGNAY Secure Storage Manager
 *
 * 1. Integrity protection (anti-tamper):
 *    Every cached item is stored in an envelope signed with HMAC-SHA-256. The signing secret is a random
 *    256-bit key created once per browser sign-in and kept across page refreshes, so cached items survive a
 *    reload, while any hand edit of an item (e.g. in DevTools) fails the check and the item is discarded.
 *    The secret is rotated on sign-out, which invalidates everything signed before it.
 *
 *    This guards against casual or accidental edits only. Code running in the page can always read the
 *    secret, so nothing stored here is trusted for authorization: the server checks every request.
 *
 * 2. Sensitive credential isolation:
 *    Authentication credentials (`ugnay_token`, `ugnay_userId`, `ugnay_orgName`) must NEVER reside in
 *    localStorage. The session lives in an HttpOnly cookie and the user's identity is loaded from
 *    `/api/auth/me` into React memory. Any such key found in storage is purged.
 *
 * 3. Cross-tab sign-out:
 *    Signing out in one tab removes the secret, which every other open tab sees, so they sign out too.
 */

/** Signed items live under this prefix, apart from plain UI preferences (guides, sidebar, view prefs). */
const NAMESPACE = 'ugnay_s:';
/** The per-browser signing secret. Starts with 'ugnay_' so sign-out's clear() rotates it. */
const SECRET_KEY = 'ugnay_s.key';
const SECRET_PATTERN = /^[0-9a-f]{64}$/;
const SIG_VERSION = 'v2';

const SENSITIVE_KEYS = ['ugnay_token', 'ugnay_userId', 'ugnay_orgName'];

interface StoredEnvelope<T = unknown> {
  __ug_sig: string;
  data: T;
}

/* ── SHA-256 / HMAC-SHA-256 (synchronous, so cached state can be read during React's first render) ── */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i]);
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockKey = new Uint8Array(64);
  blockKey.set(key.length > 64 ? sha256(key) : key);
  const inner = new Uint8Array(64 + message.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    inner[i] = blockKey[i] ^ 0x36;
    outer[i] = blockKey[i] ^ 0x5c;
  }
  inner.set(message, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map(byte => parseInt(byte, 16)));

/** Constant-time comparison, so a signature check does not leak how many leading characters matched. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── Signing secret ───────────────────────────────────────────────────────────────────────────── */

function generateSecret(): string | null {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) return null;
  const buf = new Uint8Array(32);
  window.crypto.getRandomValues(buf);
  return toHex(buf);
}

/**
 * The browser's signing secret, created on first use. It is read from storage every time (not cached in
 * memory) so every open tab always signs with the same, current secret, including right after another tab
 * has rotated it. Returns null when no secure random source or no storage is available; nothing is then
 * stored, rather than stored under a weak secret.
 */
function getSecret(create: boolean): Uint8Array | null {
  try {
    const existing = localStorage.getItem(SECRET_KEY);
    if (existing && SECRET_PATTERN.test(existing)) return fromHex(existing);
    if (!create) return null;
    const fresh = generateSecret();
    if (!fresh) return null;
    localStorage.setItem(SECRET_KEY, fresh);
    return fromHex(fresh);
  } catch {
    return null;
  }
}

const encoder = new TextEncoder();

function sign(secret: Uint8Array, key: string, dataStr: string): string {
  // The key is part of the signed message, so a valid item cannot be copied under another key.
  return `${SIG_VERSION}.${toHex(hmacSha256(secret, encoder.encode(`${SIG_VERSION}\n${key}\n${dataStr}`)))}`;
}

function verify(key: string, raw: string): { ok: true; data: unknown } | { ok: false } {
  try {
    const envelope = JSON.parse(raw) as StoredEnvelope;
    if (!envelope || typeof envelope !== 'object' || typeof envelope.__ug_sig !== 'string' || envelope.data === undefined) {
      return { ok: false };
    }
    const secret = getSecret(false);
    if (!secret) return { ok: false };
    const expected = sign(secret, key, JSON.stringify(envelope.data));
    return safeEqual(envelope.__ug_sig, expected) ? { ok: true, data: envelope.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

const storageKeyFor = (key: string) => NAMESPACE + key;

function removeQuietly(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export interface StorageProtectionOptions {
  /** Called when another tab signs out (the shared secret was removed there). */
  onSignedOutElsewhere?: () => void;
}

export const secureStorage = {
  /**
   * Reads an item and validates its integrity signature.
   * A tampered, unsigned or corrupted item is discarded and null is returned.
   */
  getItem<T = unknown>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    const storageKey = storageKeyFor(key);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const result = verify(key, raw);
      if (!result.ok) {
        console.warn(`[UGNAY Security] Integrity check failed on "${key}". Discarding it.`);
        removeQuietly(storageKey);
        return null;
      }
      return result.data as T;
    } catch {
      removeQuietly(storageKey);
      return null;
    }
  },

  /** Stores an item in a signed envelope. Credentials are refused outright. */
  setItem(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    if (SENSITIVE_KEYS.includes(key)) {
      console.warn(`[UGNAY Security] Refusing to store credential "${key}" in browser storage.`);
      return;
    }
    try {
      const secret = getSecret(true);
      if (!secret) return;
      const dataStr = JSON.stringify(value);
      if (dataStr === undefined) return;
      const envelope: StoredEnvelope = { __ug_sig: sign(secret, key, dataStr), data: value };
      localStorage.setItem(storageKeyFor(key), JSON.stringify(envelope));
    } catch (err) {
      console.warn(`[UGNAY Security] Failed to save storage key "${key}":`, err);
    }
  },

  /** Removes a specific item. */
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    removeQuietly(storageKeyFor(key));
  },

  /**
   * Purges any authentication credential from browser storage, so none ever appears in the
   * Application tab or can be read by injected script.
   */
  purgeSensitiveKeys(): void {
    if (typeof window === 'undefined') return;
    for (const key of SENSITIVE_KEYS) {
      removeQuietly(key);
      try {
        sessionStorage.removeItem(key);
      } catch {
        // noop
      }
    }
  },

  /**
   * Cleans all UGNAY-scoped storage, including the signing secret, so the next sign-in starts with a new
   * secret and everything signed before is invalid.
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ugnay_')) keysToRemove.push(k);
      }
      keysToRemove.forEach(removeQuietly);
    } catch {
      // noop
    }
  },

  /**
   * Purges credentials and legacy signed items, then watches storage changes made by other tabs (or by
   * hand in DevTools): injected credentials are removed, signed items that fail verification are reverted,
   * and removal of the secret (a sign-out in another tab) is reported.
   */
  initStorageProtection(options: StorageProtectionOptions = {}): () => void {
    if (typeof window === 'undefined') return () => {};

    this.purgeSensitiveKeys();
    purgeLegacySignedItems();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;

      // localStorage.clear() from elsewhere: treat like a sign-out.
      if (e.key === null) {
        options.onSignedOutElsewhere?.();
        return;
      }

      if (SENSITIVE_KEYS.includes(e.key)) {
        removeQuietly(e.key);
        return;
      }

      if (e.key === SECRET_KEY) {
        if (!e.newValue) options.onSignedOutElsewhere?.();
        else if (!SECRET_PATTERN.test(e.newValue)) removeQuietly(SECRET_KEY);
        return;
      }

      if (e.key.startsWith(NAMESPACE) && e.newValue) {
        const result = verify(e.key.slice(NAMESPACE.length), e.newValue);
        if (!result.ok) {
          console.warn(`[UGNAY Security] External edit rejected on "${e.key}". Reverting change.`);
          if (e.oldValue && verify(e.key.slice(NAMESPACE.length), e.oldValue).ok) {
            localStorage.setItem(e.key, e.oldValue);
          } else {
            removeQuietly(e.key);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  },
};

/**
 * Items signed by the previous scheme sat directly under 'ugnay_<name>' and can never verify again;
 * remove them. Plain UI preferences under 'ugnay_' (guides, sidebar, view prefs) are not envelopes and stay.
 */
function purgeLegacySignedItems() {
  try {
    const legacy: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('ugnay_') || k.startsWith(NAMESPACE) || k === SECRET_KEY) continue;
      const raw = localStorage.getItem(k);
      if (!raw || raw[0] !== '{') continue;
      try {
        const parsed = JSON.parse(raw) as Partial<StoredEnvelope> | null;
        if (parsed && typeof parsed === 'object' && '__ug_sig' in parsed) legacy.push(k);
      } catch {
        // not JSON: a plain preference, leave it
      }
    }
    legacy.forEach(removeQuietly);
  } catch {
    // noop
  }
}
