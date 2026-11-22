/**
 * Tells the app that the server no longer accepts this browser's session (an HTTP 401 from an API call).
 * AuthContext listens and signs the user out in-app; ProtectedRoute then sends them to the login page,
 * remembering where they were. No full page reload, no refresh tokens.
 */
export type SessionEndReason = 'expired' | 'signed-out';

type Listener = (reason: SessionEndReason) => void;

const listeners = new Set<Listener>();

export const sessionEvents = {
  onSessionEnded(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Returns false when nobody is listening (the caller then falls back to a hard redirect). */
  emitSessionEnded(reason: SessionEndReason): boolean {
    if (listeners.size === 0) return false;
    listeners.forEach(listener => listener(reason));
    return true;
  },
};
