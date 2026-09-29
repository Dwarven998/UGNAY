// Google Identity Services (https://developers.google.com/identity/oauth2/web/guides/use-token-model).
// The popup returns an access token; the backend verifies it with Google before trusting the email.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback?: (error: { type: string; message?: string }) => void;
    }) => TokenClient;
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load Google Sign-In. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Warm the script up so the popup opens immediately on click (browsers block popups opened after a delay). */
export function preloadGoogleIdentity() {
  if (CLIENT_ID) void loadGoogleScript().catch(() => {});
}

/** Opens the Google account chooser and resolves with an OAuth access token. */
export async function requestGoogleAccessToken(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in the frontend .env.');
  }
  await loadGoogleScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Could not load Google Sign-In. Please try again.');

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'openid email profile',
      callback: response => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error_description || 'Google sign-in was cancelled.'));
      },
      error_callback: error => {
        reject(new Error(
          error.type === 'popup_closed' ? 'Google sign-in was cancelled.'
            : error.type === 'popup_failed_to_open' ? 'The Google popup was blocked. Allow popups for this site and try again.'
            : error.message || 'Google sign-in failed. Please try again.',
        ));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}
