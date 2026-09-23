import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import axiosClient from '../api/axiosClient';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';

export interface FacebookConnectionState {
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  pagePictureUrl: string | null;
}

interface FacebookStatusResponse {
  facebookConnected: boolean;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPagePictureUrl: string | null;
}

export interface FacebookConnectionContextType extends FacebookConnectionState {
  /** True while the connection of the active workspace is being (re)loaded. */
  loading: boolean;
  /**
   * True once the connection shown belongs to the active workspace. Anything that loads Page-scoped data
   * (posts, media, analytics) should wait for this, so it never runs against the previous workspace's Page.
   */
  resolved: boolean;
  /** Stable identifier of the workspace + Facebook Page currently in effect. Changes whenever the Page does. */
  scopeKey: string;
  isBusy: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  scopeLabel: 'organization' | 'personal';
}

export const FacebookConnectionContext = createContext<FacebookConnectionContextType | null>(null);

const EMPTY_STATE: FacebookConnectionState = { connected: false, pageId: null, pageName: null, pagePictureUrl: null };

interface OrgConnection { orgId: string; state: FacebookConnectionState }

/**
 * The one place that knows which Facebook Page the active workspace is connected to: the active
 * organization's Page when one is selected, otherwise the legacy per-user personal Page.
 *
 * It is shared by every screen (Post Manager, Media Repository, Analytics, the connect button), so they all
 * switch Pages at the same instant. Loaded status is tagged with the organization it was loaded for, so the
 * previous organization's Page is never reported for the next one while the new status is still loading.
 */
export function FacebookConnectionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user, refreshUserProfile } = useAuth();
  const { activeOrgId } = useOrganization();
  const [orgConnection, setOrgConnection] = useState<OrgConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const loadOrgStatus = useCallback(async () => {
    if (!activeOrgId) return;
    const requestedOrgId = activeOrgId;
    setLoading(true);
    try {
      const { data } = await axiosClient.get<FacebookStatusResponse>(`/api/auth/facebook/status?orgId=${requestedOrgId}`);
      setOrgConnection({
        orgId: requestedOrgId,
        state: {
          connected: data.facebookConnected,
          pageId: data.facebookPageId,
          pageName: data.facebookPageName,
          pagePictureUrl: data.facebookPagePictureUrl,
        },
      });
    } catch (err) {
      console.error('Failed to load Facebook connection status:', err);
      // Better "not connected" for this organization than the previous organization's Page.
      setOrgConnection({ orgId: requestedOrgId, state: EMPTY_STATE });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => { void loadOrgStatus(); }, [loadOrgStatus]);

  const orgResolved = !activeOrgId || orgConnection?.orgId === activeOrgId;

  const state: FacebookConnectionState = useMemo(() => {
    if (activeOrgId) {
      return orgConnection?.orgId === activeOrgId ? orgConnection.state : EMPTY_STATE;
    }
    return {
      connected: user?.facebookConnected ?? false,
      pageId: user?.facebookPageId ?? null,
      pageName: user?.facebookPageName ?? null,
      pagePictureUrl: user?.facebookPagePictureUrl ?? null,
    };
  }, [activeOrgId, orgConnection, user]);

  const refresh = useCallback(async () => {
    if (activeOrgId) await loadOrgStatus();
    else await refreshUserProfile();
  }, [activeOrgId, loadOrgStatus, refreshUserProfile]);

  const connect = useCallback(async () => {
    setIsBusy(true);
    try {
      const path = activeOrgId ? `/api/auth/facebook/url?orgId=${activeOrgId}` : '/api/auth/facebook/url';
      const { data } = await axiosClient.get<{ url: string }>(path);
      window.location.assign(data.url);
    } finally {
      setIsBusy(false);
    }
  }, [activeOrgId]);

  const disconnect = useCallback(async () => {
    setIsBusy(true);
    try {
      const path = activeOrgId ? `/api/auth/facebook?orgId=${activeOrgId}` : '/api/auth/facebook';
      await axiosClient.delete(path);
      // Everything Page-scoped goes blank right away; the refresh then confirms the new state.
      if (activeOrgId) setOrgConnection({ orgId: activeOrgId, state: EMPTY_STATE });
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [activeOrgId, refresh]);

  const scopeKey = `${activeOrgId ?? 'personal'}|${state.pageId ?? 'none'}`;

  const value = useMemo<FacebookConnectionContextType>(() => ({
    ...state,
    loading,
    resolved: orgResolved,
    scopeKey,
    isBusy,
    connect,
    disconnect,
    refresh,
    scopeLabel: activeOrgId ? 'organization' : 'personal',
  }), [state, loading, orgResolved, scopeKey, isBusy, connect, disconnect, refresh, activeOrgId]);

  return <FacebookConnectionContext.Provider value={value}>{children}</FacebookConnectionContext.Provider>;
}
