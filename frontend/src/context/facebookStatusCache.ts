import { secureStorage } from '../utils/secureStorage';

export interface FacebookConnectionState {
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  pagePictureUrl: string | null;
}

/*
 * The last status seen for each organization is remembered, so on a reload the screens can start loading
 * that Page's data at once instead of waiting for the status request first. The workspace switcher also uses
 * it to show each organization's Page logo without asking Facebook for every organization.
 *
 * Stored with anti-tamper signature via secureStorage.
 */
const STATUS_CACHE_KEY = 'ugnay_fb_status_cache';

export function readStatusCache(orgId: string): FacebookConnectionState | null {
  try {
    const all = secureStorage.getItem<Record<string, FacebookConnectionState>>(STATUS_CACHE_KEY);
    const state = all?.[orgId];
    return state && typeof state.connected === 'boolean' ? state : null;
  } catch {
    return null;
  }
}

export function writeStatusCache(orgId: string, state: FacebookConnectionState) {
  try {
    const all = secureStorage.getItem<Record<string, FacebookConnectionState>>(STATUS_CACHE_KEY) ?? {};
    all[orgId] = state;
    secureStorage.setItem(STATUS_CACHE_KEY, all);
  } catch {
    // ignore: only a start-up shortcut
  }
}
