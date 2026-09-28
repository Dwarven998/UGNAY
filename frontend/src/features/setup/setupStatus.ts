/** Whether this user has finished (or skipped) first-time setup on this browser. */
const keyFor = (userId: string) => `ugnay_setup_done_${userId}`;

export function isSetupDone(userId: string): boolean {
  try {
    return localStorage.getItem(keyFor(userId)) === 'true';
  } catch {
    return true; // No storage — never trap the user in setup.
  }
}

export function markSetupDone(userId: string) {
  try {
    localStorage.setItem(keyFor(userId), 'true');
  } catch {
    // ignore
  }
}

/** Set before leaving for Facebook OAuth from setup, so the callback lands back in setup. */
export const SETUP_FACEBOOK_RETURN_KEY = 'ugnay_setup_fb_return';
