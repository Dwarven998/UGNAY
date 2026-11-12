import { useState } from 'react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import PageAvatar from '../../../components/ui/PageAvatar';
import { useOrganization } from '../../../context/useOrganization';
import { useFacebookConnection } from '../hooks/useFacebookConnection';
import {
  FacebookOAuthGuideModal,
  FacebookOAuthHelpButton,
} from './FacebookOAuthGuide';

export default function FacebookPageConnectButton({
  showHelp = true,
}: Readonly<{
  showHelp?: boolean;
}>) {
  const { activeOrg } = useOrganization();
  const { connected, pageName, pagePictureUrl, isBusy, connect, disconnect } = useFacebookConnection();
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');

  const scopeLabel = activeOrg ? activeOrg.orgName : 'your personal workspace';

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDisconnectError('');
  };

  const confirmDisconnect = async () => {
    setDisconnecting(true);
    setDisconnectError('');
    try {
      await disconnect();
      setConfirmOpen(false);
    } catch (err) {
      console.error('Failed to disconnect Facebook Page:', err);
      setDisconnectError('Could not disconnect the Page. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (connected) {
    const displayName = pageName ?? 'Facebook Page';

    return (
      <>
        <div className="upe-fb-connection-card">
          <div className="upe-fb-connection-meta">
            <PageAvatar src={pagePictureUrl} name={displayName} className="upe-fb-connection-avatar" />
            <div>
              <div className="upe-fb-connection-label">Connected for {scopeLabel}</div>
              <strong>{displayName}</strong>
            </div>
          </div>
          <button
            type="button"
            className="upe-fb-disconnect-btn"
            onClick={() => setConfirmOpen(true)}
            disabled={isBusy || disconnecting}
          >
            Disconnect
          </button>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          tone="danger"
          title={`Disconnect ${displayName}?`}
          description={
            <>
              Ugnay will no longer be able to publish, schedule, or read insights for this Page in {scopeLabel}.
              Scheduled posts will not go out until a Page is connected again.
            </>
          }
          confirmLabel="Disconnect"
          busyLabel="Disconnecting…"
          busy={disconnecting}
          error={disconnectError}
          onConfirm={() => void confirmDisconnect()}
          onCancel={closeConfirm}
        />
      </>
    );
  }

  return (
    <>
      <div className="upe-fb-connect-wrap">
        <button type="button" className="upe-fb-connect-btn" onClick={connect} disabled={isBusy}>
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Connect Facebook Page for {scopeLabel}
        </button>

        {showHelp && (
          <FacebookOAuthHelpButton
            onClick={() => setGuideModalOpen(true)}
            label="Meta Permissions Guide"
          />
        )}
      </div>

      <FacebookOAuthGuideModal
        open={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
      />
    </>
  );
}
