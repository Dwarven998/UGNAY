import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from './AuthContext';
import { organizationApi } from '../features/organizations/api/organizationApi';
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
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);
const STORAGE_KEY = 'ugnay_active_org_id';

export function OrganizationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const refreshMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await organizationApi.listMine();
      setMemberships(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void refreshMemberships(); }, [refreshMemberships]);

  // Once memberships are known: keep the stored active org if it's still approved,
  // otherwise fall back to the first approved membership, otherwise "Personal" mode.
  useEffect(() => {
    if (loading) return;
    const stillApproved = activeOrgId && memberships.some(m => m.orgId === activeOrgId && m.status === 'APPROVED');
    if (stillApproved) return;
    const first = memberships.find(m => m.status === 'APPROVED');
    setActiveOrgIdState(first ? first.orgId : null);
    if (first) localStorage.setItem(STORAGE_KEY, first.orgId);
    else localStorage.removeItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, loading]);

  const setActiveOrgId = (orgId: string | null) => {
    setActiveOrgIdState(orgId);
    if (orgId) localStorage.setItem(STORAGE_KEY, orgId);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const activeOrg = memberships.find(m => m.orgId === activeOrgId && m.status === 'APPROVED') ?? null;
  const isInitializing = loading || (memberships.length > 0 && !activeOrg);

  return (
    <OrganizationContext.Provider
      value={{
        memberships,
        activeOrgId: activeOrg ? activeOrgId : null,
        activeOrg,
        setActiveOrgId,
        refreshMemberships,
        loading: isInitializing,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used inside OrganizationProvider');
  return ctx;
};
