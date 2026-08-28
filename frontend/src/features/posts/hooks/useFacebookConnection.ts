import { useState, useEffect, useCallback } from 'react';

import axiosClient from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';
import { useOrganization } from '../../../context/OrganizationContext';

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

const EMPTY_STATE: FacebookConnectionState = { connected: false, pageId: null, pageName: null, pagePictureUrl: null };

/**
 * Resolves the Facebook Page connection to use right now: the active organization's
 * connection when one is selected, otherwise the legacy per-user personal connection.
 * Shared by the connect/disconnect button and by post creation so both always agree
 * on which Page a post will actually publish to.
 */
export function useFacebookConnection() {
  const { user, refreshUserProfile } = useAuth();
  const { activeOrgId } = useOrganization();
  const [orgState, setOrgState] = useState<FacebookConnectionState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const loadOrgStatus = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const { data } = await axiosClient.get<FacebookStatusResponse>(`/api/auth/facebook/status?orgId=${activeOrgId}`);
      setOrgState({
        connected: data.facebookConnected,
        pageId: data.facebookPageId,
        pageName: data.facebookPageName,
        pagePictureUrl: data.facebookPagePictureUrl,
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => { void loadOrgStatus(); }, [loadOrgStatus]);

  const state: FacebookConnectionState = activeOrgId
    ? orgState
    : {
        connected: user?.facebookConnected ?? false,
        pageId: user?.facebookPageId ?? null,
        pageName: user?.facebookPageName ?? null,
        pagePictureUrl: user?.facebookPagePictureUrl ?? null,
      };

  const refresh = useCallback(async () => {
    if (activeOrgId) await loadOrgStatus();
    else await refreshUserProfile();
  }, [activeOrgId, loadOrgStatus, refreshUserProfile]);

  const connect = async () => {
    setIsBusy(true);
    try {
      const path = activeOrgId ? `/api/auth/facebook/url?orgId=${activeOrgId}` : '/api/auth/facebook/url';
      const { data } = await axiosClient.get<{ url: string }>(path);
      window.location.assign(data.url);
    } finally {
      setIsBusy(false);
    }
  };

  const disconnect = async () => {
    setIsBusy(true);
    try {
      const path = activeOrgId ? `/api/auth/facebook?orgId=${activeOrgId}` : '/api/auth/facebook';
      await axiosClient.delete(path);
      await refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return {
    ...state,
    loading,
    isBusy,
    connect,
    disconnect,
    refresh,
    scopeLabel: activeOrgId ? ('organization' as const) : ('personal' as const),
  };
}
