import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { GuideStep } from '../../../components/ui/GuideTooltip';
import './facebook-oauth-guide.css';

/**
 * Steps used by GuideTooltip to walk users through the Facebook / Meta OAuth authorization flow
 * and prevent confusion around Page Scoping and Permission Granting.
 */
export const FACEBOOK_OAUTH_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'intro',
    title: 'Connecting to Meta (Facebook)',
    placement: 'bottom',
    icon: (
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    description: (
      <div>
        <p>Connecting opens Facebook's official authorization dialog. Before continuing, review these 3 quick tips to prevent permission issues.</p>
        <div className="gt-callout">
          <strong>Tip:</strong> You only need to configure this once per workspace.
        </div>
      </div>
    ),
  },
  {
    id: 'page-scoping',
    title: 'Step 1: Select Your Facebook Pages',
    placement: 'bottom',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    description: (
      <div>
        <p>When Meta asks <em>"What Pages do you want to use with UGNAY?"</em>:</p>
        <div className="gt-callout gt-callout--warning">
          <strong>Crucial:</strong> Choose <strong>"Opt into all current and future Pages"</strong> or explicitly check the Page you manage.
        </div>
        <p style={{ fontSize: '12px', color: '#64748b' }}>If your Page is unchecked, Meta hides it and UGNAY cannot connect to it.</p>
      </div>
    ),
  },
  {
    id: 'permissions',
    title: 'Step 2: Leave All Permissions Enabled',
    placement: 'bottom',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    description: (
      <div>
        <p>Meta displays permissions for managing content and reading insights:</p>
        <ul className="gt-checklist">
          <li>
            <span className="gt-checklist-icon">✓</span>
            <span><strong>Create & manage posts</strong> (needed to publish)</span>
          </li>
          <li>
            <span className="gt-checklist-icon">✓</span>
            <span><strong>Read Page content & insights</strong> (needed for analytics)</span>
          </li>
          <li>
            <span className="gt-checklist-icon">✓</span>
            <span><strong>Show list of Pages</strong> (needed to find your Page)</span>
          </li>
        </ul>
        <div className="gt-callout gt-callout--warning">
          <strong>Do not toggle any switches off</strong>, or post publishing will fail.
        </div>
      </div>
    ),
  },
  {
    id: 'admin-role',
    title: 'Step 3: Verify Admin Role on Facebook',
    placement: 'top',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    description: (
      <div>
        <p>Your logged-in personal Facebook account must have <strong>Admin</strong> or <strong>Task Access (Content)</strong> on the Facebook Page.</p>
        <p style={{ marginTop: '6px' }}>If you are only an Analyst or Viewer, ask a Page Admin to grant Content access in Facebook Page Settings.</p>
      </div>
    ),
  },
];

/**
 * In-page helper card that displays clear, upfront guidance on Facebook Page Scoping & Permissions.
 */
export function FacebookOAuthPermissionCard({
  onOpenDetailedGuide,
  className = '',
}: Readonly<{
  onOpenDetailedGuide?: () => void;
  className?: string;
}>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`fog-card ${className}`}>
      <div className="fog-card-header" onClick={() => setExpanded(prev => !prev)} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(prev => !prev)}>
        <div className="fog-card-title-wrap">
          <span className="fog-badge" aria-hidden="true">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </span>
          <span className="fog-card-title">Before connecting: Meta Permission Guide</span>
        </div>
        <div className="fog-card-right">
          <span className="fog-expand-hint">{expanded ? 'Hide tips' : 'View tips'}</span>
          <svg className={`fog-chevron ${expanded ? 'is-expanded' : ''}`} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className={`fog-card-content ${expanded ? 'is-open' : ''}`}>
        <p className="fog-intro">
          Avoid connection errors by following these 3 crucial steps in Facebook's authorization popup:
        </p>

        <ul className="fog-tips-list">
          <li className="fog-tip-item">
            <span className="fog-tip-num">1</span>
            <div>
              <strong>Select your Facebook Page:</strong>
              <p>In Meta’s popup, choose <em>"Opt into all current and future Pages"</em> or verify your specific Page is checked. Do not leave it unchecked.</p>
            </div>
          </li>
          <li className="fog-tip-item">
            <span className="fog-tip-num">2</span>
            <div>
              <strong>Keep all permissions turned ON:</strong>
              <p>Do not uncheck <em>"Manage Pages"</em>, <em>"Create posts"</em>, or <em>"Read insights"</em>. Disabling any scope prevents publishing.</p>
            </div>
          </li>
          <li className="fog-tip-item">
            <span className="fog-tip-num">3</span>
            <div>
              <strong>Page Admin Access:</strong>
              <p>You must have Admin or Content Manager access on the Facebook Page to link it.</p>
            </div>
          </li>
        </ul>

        {onOpenDetailedGuide && (
          <div className="fog-card-action">
            <button type="button" className="fog-link-btn" onClick={onOpenDetailedGuide}>
              View visual walkthrough & troubleshooting →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Detailed Modal explaining Meta OAuth Permissions with visual guidance & troubleshooting.
 */
export function FacebookOAuthGuideModal({
  open,
  onClose,
}: Readonly<{
  open: boolean;
  onClose: () => void;
}>) {
  if (!open) return null;

  return createPortal(
    <div className="ug-dialog-backdrop" onClick={onClose}>
      <div
        className="ug-dialog ug-dialog-md fog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fog-modal-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="fog-modal-header">
          <div className="fog-modal-title-group">
            <div className="fog-modal-icon" aria-hidden="true">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <h2 id="fog-modal-title" className="fog-modal-title">Facebook Page Permissions Guide</h2>
              <p className="fog-modal-sub">How to configure Meta OAuth without errors or missing pages</p>
            </div>
          </div>
          <button type="button" className="fog-modal-close" onClick={onClose} aria-label="Close dialog">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="fog-modal-body">
          {/* Visual Step 1 */}
          <div className="fog-guide-step">
            <div className="fog-step-badge">Step 1</div>
            <div className="fog-step-content">
              <h3>Page Selection & Scoping</h3>
              <p>
                When Meta asks <em>"What Pages do you want to use with UGNAY?"</em>, choose:
              </p>
              <div className="fog-mockup">
                <div className="fog-mockup-header">Meta Business Login</div>
                <div className="fog-mockup-option is-recommended">
                  <span className="fog-mockup-radio">●</span>
                  <div>
                    <strong>Opt into all current and future Pages</strong>
                    <span>Recommended — avoids needing to re-authorize when new Pages are created</span>
                  </div>
                </div>
                <div className="fog-mockup-divider">or choose specific Pages:</div>
                <div className="fog-mockup-checkbox">
                  <span className="fog-mockup-check">✓</span>
                  <span>Ensure your Organization's Facebook Page is selected</span>
                </div>
              </div>
              <div className="fog-note fog-note-warn">
                ⚠️ If you leave a Page unchecked, Facebook will not grant UGNAY access to publish to that Page.
              </div>
            </div>
          </div>

          {/* Visual Step 2 */}
          <div className="fog-guide-step">
            <div className="fog-step-badge">Step 2</div>
            <div className="fog-step-content">
              <h3>Required Permission Scopes</h3>
              <p>Meta displays permission switches. <strong>Keep all toggles enabled:</strong></p>
              <div className="fog-scopes-table">
                <div className="fog-scope-row">
                  <span className="fog-scope-toggle">ON</span>
                  <div>
                    <strong>Manage Pages & Publish Content</strong>
                    <p>Required to publish and schedule posts from the composer.</p>
                  </div>
                </div>
                <div className="fog-scope-row">
                  <span className="fog-scope-toggle">ON</span>
                  <div>
                    <strong>Read Engagement & Page Insights</strong>
                    <p>Required to populate the Analytics dashboard and post metrics.</p>
                  </div>
                </div>
                <div className="fog-scope-row">
                  <span className="fog-scope-toggle">ON</span>
                  <div>
                    <strong>Show a list of the Pages you manage</strong>
                    <p>Required to identify your Page ID and access token.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="fog-troubleshoot">
            <h3>Troubleshooting: "No Facebook Page connected" error?</h3>
            <p>If you see a connection error after returning from Facebook:</p>
            <ol>
              <li>Go to <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noreferrer" className="fog-external-link">Facebook Settings → Business Integrations</a>.</li>
              <li>Find <strong>UGNAY</strong> and click <strong>Remove</strong> (this resets permissions).</li>
              <li>Return to UGNAY, click <strong>Connect Facebook</strong>, and make sure to select your Page and grant all permissions.</li>
            </ol>
          </div>
        </div>

        <div className="fog-modal-footer">
          <button type="button" className="ug-btn ug-btn-primary" onClick={onClose}>
            I Understand, Let's Connect
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Help Button Pill to quickly open the Meta Permission Guide.
 */
export function FacebookOAuthHelpButton({
  onClick,
  className = '',
  label = 'Meta Permission Guide',
}: Readonly<{
  onClick: () => void;
  className?: string;
  label?: string;
}>) {
  return (
    <button
      type="button"
      className={`fog-help-trigger ${className}`}
      onClick={onClick}
      title="View guidance on Facebook Page selection and required permissions"
    >
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 .88-.36 1.68-.93 2.25z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
