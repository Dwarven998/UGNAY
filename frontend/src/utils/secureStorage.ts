/**
 * UGNAY Secure Storage Manager
 *
 * 1. Anti-Tamper Protection:
 *    All stored cache items are signed with a memory-only session secret.
 *    Any manual alteration or tampering in browser DevTools immediately invalidates
 *    the integrity check, causing the tampered entry to be discarded safely.
 *
 * 2. Sensitive Credential Isolation:
 *    Authentication credentials (`ugnay_token`, `ugnay_userId`, `ugnay_orgName`)
 *    must NEVER reside in plaintext in localStorage.
 *    Tokens are handled via HttpOnly cookies, and user identity is loaded
 *    directly from `/api/auth/me` into React memory.
 */

// Memory-only session secret initialized once per browser session.
// Because it never touches localStorage, DevTools users cannot forge valid signatures.
const SESSION_SECRET = (() => {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const buf = new Uint8Array(16);
    window.crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
})();

/** Fast, robust 32-bit FNV-1a hash with session secret and key salt */
function hashPayload(key: string, dataStr: string): string {
  let hash = 0x811c9dc5;
  const combined = `${SESSION_SECRET}:${key}:${dataStr}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

interface StoredEnvelope<T = unknown> {
  __ug_sig: string;
  data: T;
}

const SENSITIVE_KEYS = ['ugnay_token', 'ugnay_userId', 'ugnay_orgName'];

export const secureStorage = {
  /**
   * Reads an item from storage and validates its integrity signature.
   * If tampered, manually modified in DevTools, or corrupted, it will be discarded.
   */
  getItem<T = unknown>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const envelope = JSON.parse(raw) as StoredEnvelope<T>;
      if (!envelope || typeof envelope !== 'object' || !envelope.__ug_sig || envelope.data === undefined) {
        // Plaintext or unsigned legacy key. Clear and reject for security.
        localStorage.removeItem(key);
        return null;
      }

      const expectedSig = hashPayload(key, JSON.stringify(envelope.data));
      if (envelope.__ug_sig !== expectedSig) {
        console.warn(`[UGNAY Security] Tampering detected on "${key}". Discarding unauthorized change.`);
        localStorage.removeItem(key);
        return null;
      }

      return envelope.data;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Stores an item with an integrity signature bound to the active session.
   */
  setItem(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
      const dataStr = JSON.stringify(value);
      const envelope: StoredEnvelope = {
        __ug_sig: hashPayload(key, dataStr),
        data: value,
      };
      localStorage.setItem(key, JSON.stringify(envelope));
    } catch (err) {
      console.warn(`[UGNAY Security] Failed to save storage key "${key}":`, err);
    }
  },

  /**
   * Removes a specific key from storage.
   */
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // noop
    }
  },

  /**
   * Purges sensitive auth tokens and user IDs from local storage so they
   * never appear in the Application tab.
   */
  purgeSensitiveKeys(): void {
    if (typeof window === 'undefined') return;
    for (const key of SENSITIVE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // noop
      }
    }
  },

  /**
   * Cleans all UGNAY-scoped storage.
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ugnay_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // noop
    }
  },

  /**
   * Registers a storage listener to block manual tampering of keys in DevTools.
   */
  initStorageProtection(): () => void {
    if (typeof window === 'undefined') return () => {};

    // Immediate cleanup of sensitive credentials
    this.purgeSensitiveKeys();

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) return;

      // Immediately purge sensitive keys if someone tries to inject them
      if (SENSITIVE_KEYS.includes(e.key)) {
        localStorage.removeItem(e.key);
        return;
      }

      // If a protected ugnay key was modified externally in DevTools
      if (e.key.startsWith('ugnay_')) {
        if (!e.newValue) return; // Deleted
        try {
          const envelope = JSON.parse(e.newValue) as StoredEnvelope;
          const expectedSig = hashPayload(e.key, JSON.stringify(envelope?.data));
          if (!envelope?.__ug_sig || envelope.__ug_sig !== expectedSig) {
            console.warn(`[UGNAY Security] External edit rejected on "${e.key}". Reverting change.`);
            if (e.oldValue) {
              localStorage.setItem(e.key, e.oldValue);
            } else {
              localStorage.removeItem(e.key);
            }
          }
        } catch {
          // Invalid format, remove
          localStorage.removeItem(e.key);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  },
};
