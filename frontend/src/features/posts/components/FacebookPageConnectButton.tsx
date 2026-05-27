import { useState } from 'react';

import axiosClient from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';

/** Mask a page ID by showing only the last 4 characters. */
function maskPageId(id: string): string {
  if (id.length <= 4) return '••••';
  return '••••' + id.slice(-4);
}

export default function FacebookPageConnectButton() {
  const { user, refreshUserProfile } = useAuth();
  const [isBusy, setIsBusy] = useState(false);

  const connect = async () => {
    setIsBusy(true);
    try {
      const { data } = await axiosClient.get<{ url: string }>('/api/auth/facebook/url');
      window.location.assign(data.url);
    } finally {
      setIsBusy(false);
    }
  };

  const disconnect = async () => {
    setIsBusy(true);
    try {
      await axiosClient.delete('/api/auth/facebook');
      await refreshUserProfile();
    } finally {
      setIsBusy(false);
    }
  };

  if (user?.facebookConnected) {
    /* Determine display name — mask the raw page ID for privacy */
    const displayName = user.facebookPageName
      ?? (user.facebookPageId ? maskPageId(user.facebookPageId) : 'Facebook Page');

    return (
      <div className="upe-fb-connection-card">
        <div className="upe-fb-connection-meta">
          {user.facebookPagePictureUrl ? (
            <img src={user.facebookPagePictureUrl} alt={user.facebookPageName ?? 'Facebook Page'} />
          ) : (
            <div className="upe-fb-connection-avatar">FB</div>
          )}
          <div>
            <div className="upe-fb-connection-label">Connected Facebook Page</div>
            <strong>{displayName}</strong>
          </div>
        </div>
        <button type="button" className="upe-fb-disconnect-btn" onClick={disconnect} disabled={isBusy}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="upe-fb-connect-btn" onClick={connect} disabled={isBusy}>
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
      Connect Facebook Page
    </button>
  );
}