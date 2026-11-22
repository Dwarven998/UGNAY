import { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, networkError } from '../api/errors';
import { sessionEvents } from '../api/sessionEvents';
import { AuthContext, AuthProvider } from './AuthContext';

vi.mock('../api/axiosClient.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/axiosClient.ts')>();
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
    resetSessionExpiryGuard: vi.fn(),
  };
});

const axiosModule = await import('../api/axiosClient.ts');
const getMock = vi.mocked(axiosModule.default.get);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFILE = {
  userId: 'u-1', orgName: 'Org', facebookConnected: false, facebookPageId: null, facebookPageName: null,
  facebookPagePictureUrl: null,
};
const HINT = 'ugnay_session_hint';

let container: HTMLDivElement;
let root: Root;
type AuthValue = React.ContextType<typeof AuthContext>;
let ctx: AuthValue = null;
const capture = (value: AuthValue) => { ctx = value; };

function Probe({ report }: Readonly<{ report: (value: AuthValue) => void }>) {
  report(useContext(AuthContext));
  return null;
}

async function mount() {
  await act(async () => {
    root.render(<AuthProvider><Probe report={capture} /></AuthProvider>);
  });
}

beforeEach(() => {
  getMock.mockReset();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AuthProvider session handling', () => {
  it('signs in from a valid session', async () => {
    localStorage.setItem(HINT, '1');
    getMock.mockResolvedValue({ data: PROFILE });
    await mount();
    expect(ctx?.user?.userId).toBe('u-1');
    expect(ctx?.sessionError).toBeNull();
    expect(localStorage.getItem(HINT)).toBe('1');
  });

  it('a network failure during the session check does not sign the user out', async () => {
    localStorage.setItem(HINT, '1');
    getMock.mockRejectedValue(networkError());
    await mount();
    expect(ctx?.isLoading).toBe(false);
    expect(ctx?.user).toBeNull();
    expect(ctx?.sessionError).toMatch(/connect/i);
    expect(localStorage.getItem(HINT)).toBe('1'); // still "signed in" on this device; a retry can recover
  });

  it('recovers on retry once the server is reachable again', async () => {
    localStorage.setItem(HINT, '1');
    getMock.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ data: PROFILE });
    await mount();
    expect(ctx?.sessionError).not.toBeNull();

    await act(async () => { await ctx?.refreshUserProfile(); });
    expect(ctx?.user?.userId).toBe('u-1');
    expect(ctx?.sessionError).toBeNull();
  });

  it('a 401 from the session check means signed out', async () => {
    localStorage.setItem(HINT, '1');
    getMock.mockRejectedValue(new ApiError(401, 'Please sign in to continue.', null, { code: 'UNAUTHORIZED' }));
    await mount();
    expect(ctx?.user).toBeNull();
    expect(ctx?.sessionError).toBeNull();
    expect(localStorage.getItem(HINT)).toBeNull();
  });

  it('a temporary failure while refreshing keeps the signed-in user', async () => {
    getMock.mockResolvedValueOnce({ data: PROFILE });
    await mount();
    expect(ctx?.user?.userId).toBe('u-1');

    getMock.mockRejectedValueOnce(new ApiError(503, 'Temporarily unavailable.', null, { code: 'SERVICE_UNAVAILABLE' }));
    await act(async () => { await ctx?.refreshUserProfile(); });
    expect(ctx?.user?.userId).toBe('u-1');
    expect(ctx?.sessionError).toBe('Temporarily unavailable.');
  });

  it('an expired session reported by any request signs out in-app and says why', async () => {
    getMock.mockResolvedValueOnce({ data: PROFILE });
    await mount();

    act(() => { sessionEvents.emitSessionEnded('expired'); });
    expect(ctx?.user).toBeNull();
    expect(ctx?.sessionEndReason).toBe('expired');
    expect(localStorage.getItem(HINT)).toBeNull();

    // Signing in again clears the notice.
    getMock.mockResolvedValueOnce({ data: PROFILE });
    await act(async () => { await ctx?.refreshUserProfile(); });
    expect(ctx?.user?.userId).toBe('u-1');
    expect(ctx?.sessionEndReason).toBeNull();
  });
});
