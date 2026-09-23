import { useContext } from 'react';

import { FacebookConnectionContext } from '../../../context/FacebookConnectionContext';

export type { FacebookConnectionState } from '../../../context/FacebookConnectionContext';

/**
 * The Facebook Page connection of the active workspace (the organization's when one is selected, otherwise the
 * personal one). The state is shared app-wide, so every screen agrees on which Page is in effect; use
 * `scopeKey` to tag Page-scoped data and `resolved` to know when it is safe to load it.
 */
export function useFacebookConnection() {
  const ctx = useContext(FacebookConnectionContext);
  if (!ctx) throw new Error('useFacebookConnection must be used inside FacebookConnectionProvider');
  return ctx;
}
