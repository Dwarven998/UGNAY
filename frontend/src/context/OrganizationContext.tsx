import { createContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '../context/useAuth';
import { organizationApi } from '../features/organizations/api/organizationApi';
import { secureStorage } from '../utils/secureStorage';
import type { MyMembership } from '../types';

interface OrganizationContextType {
  /** All of the current user's memberships, any status. */
  memberships: MyMembership[];
  /** The currently active organization, or null when working in "Personal" (legacy, no-org) mode. */
  activeOrgId: string | null;
  activeOrg: MyMembership | null;
  setActiveOrgId: (orgId: string | null) => void;
  refreshMemberships: () => Promise<void>;
  loading: boolean;
  /** True when the membership list could not be loaded (an empty list then means "unknown", not "none"). */
  loadError: boolean;
}

export const OrganizationContext = createContext<OrganizationContextType | null>(null);
const STORAGE_KEY = 'ugnay_active_org_id';
const MEMBERSHIPS_CACHE_KEY = 'ugnay_memberships_cache';

/*
 * The last membership list is remembered per user, so a reload can pick the active workspace (and start
 * loading its data) right away instead of waiting for the list first. It is refreshed on every load, and the
 * server checks membership on every request regardless.
 *
 * Stored with anti-tamper signature via secureStorage.
 */
function readCachedMemberships(userId: string | null): MyMembership[] | null {
  if (!userId) return null;
  const parsed = secureStorage.getItem<{ userId?: string; items?: MyMembership[] }>(MEMBERSHIPS_CACHE_KEY);
  return parsed?.userId === userId && Array.isArray(parsed.items) ? parsed.items : null;
}

function writeCachedMemberships(userId: string, items: MyMembership[]) {
  secureStorage.setItem(MEMBERSHIPS_CACHE_KEY, { userId, items });
}

export function OrganizationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.userId ?? null;
  const [memberships, setMemberships] = useState<MyMembership[]>(() => readCachedMemberships(userId) ?? []);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => secureStorage.getItem<string>(STORAGE_KEY));
  const [loading, setLoading] = useState(() => readCachedMemberships(userId) === null);
  const [loadError, setLoadError] = useState(false);

  // A different account (or signing out): start from that account's remembered list, or from nothing.
  const [listUserId, setListUserId] = useState<string | null>(() => (readCachedMemberships(userId) ? userId : null));
  if (userId && listUserId !== userId) {
    const cached = readCachedMemberships(userId);
    setListUserId(userId);
    setMemberships(cached ?? []);
    setLoading(cached === null);
  }

  const refreshMemberships = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setListUserId(null);
      setLoading(false);
      return;
    }
    try {
      const data = await organizationApi.listMine();
      setMemberships(data);
      setListUserId(userId);
      setLoadError(false);
      writeCachedMemberships(userId, data);
    } catch (err) {
      console.error('Failed to load organization memberships:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Wait for the signed-in user to be known; deciding earlier would treat everyone as signed out for a moment.
  useEffect(() => {
    if (authLoading) return;
    void refreshMemberships();
  }, [authLoading, refreshMemberships]);

  // Once memberships are known: keep the stored active org if it's still approved,
  // otherwise fall back to the first approved membership, otherwise "Personal" mode.
  useEffect(() => {
    if (loading || authLoading) return;
    const stillApproved = activeOrgId && memberships.some(m => m.orgId === activeOrgId && m.status === 'APPROVED');
    if (stillApproved) return;
    const first = memberships.find(m => m.status === 'APPROVED');
    setActiveOrgIdState(first ? first.orgId : null);
    if (first) secureStorage.setItem(STORAGE_KEY, first.orgId);
    else secureStorage.removeItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, loading, authLoading]);

  const setActiveOrgId = (orgId: string | null) => {
    setActiveOrgIdState(orgId);
    if (orgId) secureStorage.setItem(STORAGE_KEY, orgId);
    else secureStorage.removeItem(STORAGE_KEY);
  };

  const activeOrg = memberships.find(m => m.orgId === activeOrgId && m.status === 'APPROVED') ?? null;
  // Settled once the active org is an approved membership, or "Personal" with no approved membership to pick.
  const settled = activeOrgId ? activeOrg !== null : !memberships.some(m => m.status === 'APPROVED');
  const isInitializing = loading || !settled;

  return (
    <OrganizationContext.Provider
      value={{
        memberships,
        activeOrgId: activeOrg ? activeOrgId : null,
        activeOrg,
        setActiveOrgId,
        refreshMemberships,
        loading: isInitializing,
        loadError,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
