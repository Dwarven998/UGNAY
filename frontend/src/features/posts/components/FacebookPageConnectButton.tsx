import { useState } from 'react';

import axiosClient from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';

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
            <strong>{user.facebookPageName ?? user.facebookPageId ?? 'Facebook Page'}</strong>
          </div>
        </div>
        <button type="button" className="upe-secondary-btn" onClick={disconnect} disabled={isBusy}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="upe-primary-cta" onClick={connect} disabled={isBusy}>
      Connect Facebook Page
    </button>
  );
}