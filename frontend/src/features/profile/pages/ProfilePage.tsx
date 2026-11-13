// Profile: the signed-in user's own account, password, organizations and posts.
// All data comes from /api/profile, which only ever reads the session's own user. Nothing here is cached
// in browser storage, so signing out (or another user signing in) leaves nothing behind.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../api/axiosClient';
import { useAuth } from '../../../context/useAuth';
import PostThumb from '../../posts/components/PostThumb';
import { ORG_TYPE_LABEL } from '../../organizations/shared/orgTypes';
import { displayNameFromEmail } from '../../organizations/shared/displayName';
import { profileApi } from '../api/profileApi';
import type { ProfilePostSummary, UserProfile } from '../../../types';
import '../profile.css';

const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72;
const RESET_LINK_COOLDOWN_S = 60;

type PostFilter = 'ALL' | ProfilePostSummary['status'];

const STATUS_LABEL: Record<ProfilePostSummary['status'], string> = {
  PUBLISHED: 'Published',
  SCHEDULED: 'Scheduled',
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
};

const STATUS_CLASS: Record<ProfilePostSummary['status'], string> = {
  PUBLISHED: 'pf-badge-green',
  SCHEDULED: 'pf-badge-blue',
  DRAFT: 'pf-badge-gray',
  PENDING_REVIEW: 'pf-badge-yellow',
  REJECTED: 'pf-badge-red',
  FAILED: 'pf-badge-red',
};

const MEMBERSHIP_CLASS: Record<string, string> = {
  APPROVED: 'pf-badge-green',
  PENDING: 'pf-badge-yellow',
  REJECTED: 'pf-badge-red',
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(iso)}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

function postDateLabel(p: ProfilePostSummary): string {
  if (p.status === 'PUBLISHED' && p.publishedAt) return `Published ${formatDateTime(p.publishedAt)}`;
  if (p.scheduledAt && (p.status === 'SCHEDULED' || p.status === 'PENDING_REVIEW')) return `Scheduled for ${formatDateTime(p.scheduledAt)}`;
  return p.createdAt ? `Created ${formatDate(p.createdAt)}` : '';
}

/** 0–3: a light hint only; the server enforces the real rule (6–72 characters). */
function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < MIN_PASSWORD) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  if (pw.length >= 12 && variety >= 3) return 3;
  if (pw.length >= 8 && variety >= 2) return 2;
  return 1;
}
const STRENGTH_LABEL = ['Too short', 'Weak', 'Good', 'Strong'] as const;

function PasswordField({
  id, label, value, onChange, autoComplete, placeholder, invalid, describedBy,
}: Readonly<{
  id: string; label: string; value: string; onChange: (v: string) => void;
  autoComplete: string; placeholder: string; invalid?: boolean; describedBy?: string;
}>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pf-field">
      <label htmlFor={id} className="pf-label">{label}</label>
      <div className="pf-input-wrap">
        <i className="fi fi-rr-lock pf-input-icon" aria-hidden="true"></i>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`pf-input${invalid ? ' is-invalid' : ''}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={MAX_PASSWORD}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          spellCheck={false}
        />
        <button
          type="button"
          className="pf-eye"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          <i className={`fi ${visible ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  // Tagged with the account it was loaded for, so another account's data is never shown, even for a frame.
  const [loaded, setLoaded] = useState<{ userId: string | undefined; profile: UserProfile } | null>(null);
  const profile = loaded && loaded.userId === user?.userId ? loaded.profile : null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Reset link (for accounts that don't know their current password, e.g. Google sign-in)
  const [linkSending, setLinkSending] = useState(false);
  const [linkInfo, setLinkInfo] = useState<string | null>(null);
  const [linkCooldown, setLinkCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);

  const [filter, setFilter] = useState<PostFilter>('ALL');

  const userId = user?.userId;
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setReloadKey(k => k + 1);
  }, []);

  // Load on open, on retry, and whenever the signed-in account changes. A response that arrives after
  // the account changed is dropped, so one account's data can never land on another's page.
  useEffect(() => {
    let cancelled = false;
    profileApi.get()
      .then(data => {
        if (cancelled) return;
        setLoaded({ userId, profile: data });
        setLoadError(null);
      })
      .catch(e => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Could not load your profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  useEffect(() => () => { if (cooldownTimer.current) window.clearInterval(cooldownTimer.current); }, []);

  const strength = passwordStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= MIN_PASSWORD && newPassword === confirmPassword && !pwSaving;

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPassword.length < MIN_PASSWORD) { setPwError(`New password must be at least ${MIN_PASSWORD} characters.`); return; }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match.'); return; }
    if (newPassword === currentPassword) { setPwError('Your new password must be different from your current password.'); return; }
    setPwSaving(true);
    try {
      const res = await profileApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess(res.message);
      void load();
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Could not change your password. Please try again.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleSendResetLink = async () => {
    setLinkSending(true);
    setLinkInfo(null);
    setPwError(null);
    try {
      const res = await profileApi.sendResetLink();
      setLinkInfo(res.message);
      setLinkCooldown(RESET_LINK_COOLDOWN_S);
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
      cooldownTimer.current = window.setInterval(() => {
        setLinkCooldown(s => {
          if (s <= 1 && cooldownTimer.current) { window.clearInterval(cooldownTimer.current); cooldownTimer.current = null; }
          return Math.max(0, s - 1);
        });
      }, 1000);
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Could not send the reset link. Please try again.');
    } finally {
      setLinkSending(false);
    }
  };

  const approvedOrgs = useMemo(() => profile?.memberships.filter(m => m.status === 'APPROVED').length ?? 0, [profile]);
  const visiblePosts = useMemo(
    () => (profile?.recentPosts ?? []).filter(p => filter === 'ALL' || p.status === filter),
    [profile, filter],
  );

  const stats = profile?.postStats;
  type FilterChip = { key: PostFilter; label: string; count: number };
  const filters: FilterChip[] = stats ? ([
    { key: 'ALL', label: 'All', count: stats.total },
    { key: 'PUBLISHED', label: 'Published', count: stats.published },
    { key: 'SCHEDULED', label: 'Scheduled', count: stats.scheduled },
    { key: 'DRAFT', label: 'Drafts', count: stats.drafts },
    { key: 'PENDING_REVIEW', label: 'Pending', count: stats.pendingReview },
    { key: 'REJECTED', label: 'Rejected', count: stats.rejected },
    { key: 'FAILED', label: 'Failed', count: stats.failed },
  ] as FilterChip[]).filter(f => f.key === 'ALL' || f.count > 0) : [];

  const email = profile?.email ?? '';
  const name = email ? displayNameFromEmail(email) : '';

  return (
    <div className="pf-page">
      <div className="pf-header">
        <h2 className="pf-title">Profile</h2>
        <p className="pf-subtitle">Your account, security, organizations and posts. Only you can see this page.</p>
      </div>

      {loadError && (
        <div className="pf-alert pf-alert-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="pf-btn-link" onClick={() => void load()}>Try again</button>
        </div>
      )}

      {/* ── Account summary ── */}
      <section className="pf-card pf-account" aria-labelledby="pf-account-title" aria-busy={loading}>
        <div className="pf-identity">
          <div className="pf-avatar" aria-hidden="true">{(name || '?').charAt(0).toUpperCase()}</div>
          <div className="pf-identity-text">
            <h3 id="pf-account-title" className="pf-name">{loading && !profile ? <span className="pf-skel pf-skel-name" /> : name || 'Your account'}</h3>
            <p className="pf-email">
              <i className="fi fi-rr-envelope" aria-hidden="true"></i>
              {loading && !profile ? <span className="pf-skel pf-skel-email" /> : <span>{email}</span>}
            </p>
          </div>
        </div>
        <dl className="pf-stats">
          <div className="pf-stat"><dt>Organizations</dt><dd>{profile ? approvedOrgs : '–'}</dd></div>
          <div className="pf-stat"><dt>Posts made</dt><dd>{stats ? stats.total : '–'}</dd></div>
          <div className="pf-stat"><dt>Published</dt><dd>{stats ? stats.published : '–'}</dd></div>
          <div className="pf-stat"><dt>Scheduled</dt><dd>{stats ? stats.scheduled : '–'}</dd></div>
        </dl>
      </section>

      <div className="pf-grid">
        {/* ── Security ── */}
        <section className="pf-card" aria-labelledby="pf-security-title">
          <div className="pf-card-head">
            <span className="pf-card-icon" aria-hidden="true"><i className="fi fi-rr-shield-check"></i></span>
            <div>
              <h3 id="pf-security-title" className="pf-card-title">Change password</h3>
              <p className="pf-card-sub">
                {profile?.passwordChangedAt
                  ? `Last changed ${formatDate(profile.passwordChangedAt)}.`
                  : 'Changing it signs out your other devices.'}
              </p>
            </div>
          </div>

          {pwError && <div className="pf-alert pf-alert-error" role="alert">{pwError}</div>}
          {pwSuccess && <div className="pf-alert pf-alert-success" role="status">{pwSuccess}</div>}

          <form className="pf-form" onSubmit={handleChangePassword} noValidate>
            {/* Lets password managers save the new password against the right account. */}
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
            <PasswordField
              id="pf-current" label="Current password" value={currentPassword} onChange={setCurrentPassword}
              autoComplete="current-password" placeholder="Enter your current password"
            />
            <PasswordField
              id="pf-new" label="New password" value={newPassword} onChange={setNewPassword}
              autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD} characters`} describedBy="pf-strength"
            />
            {newPassword.length > 0 && (
              <div id="pf-strength" className={`pf-strength pf-strength-${strength}`} aria-live="polite">
                <span className="pf-strength-bar" aria-hidden="true"><span /><span /><span /></span>
                <span className="pf-strength-text">{STRENGTH_LABEL[strength]}</span>
              </div>
            )}
            <PasswordField
              id="pf-confirm" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword}
              autoComplete="new-password" placeholder="Re-enter your new password" invalid={mismatch}
              describedBy={mismatch ? 'pf-mismatch' : undefined}
            />
            {mismatch && <p id="pf-mismatch" className="pf-field-error">Passwords do not match.</p>}

            <button type="submit" className="pf-btn-primary" disabled={!canSubmit}>
              {pwSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <div className="pf-reset">
            <p className="pf-reset-text">Don't know your current password, or signed up with Google?</p>
            <button
              type="button"
              className="pf-btn-secondary"
              onClick={() => void handleSendResetLink()}
              disabled={linkSending || linkCooldown > 0 || !profile}
            >
              <i className="fi fi-rr-envelope" aria-hidden="true"></i>
              {linkSending ? 'Sending…' : linkCooldown > 0 ? `Link sent · resend in ${linkCooldown}s` : 'Email me a reset link'}
            </button>
            {linkInfo && <p className="pf-reset-info" role="status">{linkInfo}</p>}
          </div>
        </section>

        {/* ── Organizations ── */}
        <section className="pf-card" aria-labelledby="pf-orgs-title">
          <div className="pf-card-head">
            <span className="pf-card-icon" aria-hidden="true"><i className="fi fi-rr-building"></i></span>
            <div className="pf-card-head-text">
              <h3 id="pf-orgs-title" className="pf-card-title">Organizations</h3>
              <p className="pf-card-sub">Organizations you joined or asked to join.</p>
            </div>
            <Link to="/organizations" className="pf-head-link">Manage</Link>
          </div>

          {loading && !profile ? (
            <div className="pf-empty">Loading…</div>
          ) : !profile || profile.memberships.length === 0 ? (
            <div className="pf-empty">
              You haven't joined any organizations yet.{' '}
              <Link to="/organizations" className="pf-inline-link">Join or create one</Link>
            </div>
          ) : (
            <ul className="pf-org-list">
              {profile.memberships.map(m => (
                <li key={m.orgId} className="pf-org-row">
                  <span className="pf-org-avatar" aria-hidden="true">{m.orgName.charAt(0).toUpperCase()}</span>
                  <div className="pf-org-main">
                    <span className="pf-org-name">{m.orgName}</span>
                    <span className="pf-org-meta">
                      {ORG_TYPE_LABEL[m.orgType]}
                      {m.status === 'APPROVED' && m.joinedAt ? ` · Joined ${formatDate(m.joinedAt)}` : ''}
                      {m.status === 'PENDING' && m.requestedAt ? ` · Requested ${formatDate(m.requestedAt)}` : ''}
                    </span>
                  </div>
                  <div className="pf-org-badges">
                    <span className="pf-badge">{titleCase(m.role)}</span>
                    {m.status !== 'APPROVED' && (
                      <span className={`pf-badge ${MEMBERSHIP_CLASS[m.status]}`}>{titleCase(m.status)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Posts ── */}
      <section className="pf-card" aria-labelledby="pf-posts-title">
        <div className="pf-card-head">
          <span className="pf-card-icon" aria-hidden="true"><i className="fi fi-rr-document"></i></span>
          <div className="pf-card-head-text">
            <h3 id="pf-posts-title" className="pf-card-title">Posts you made</h3>
            <p className="pf-card-sub">Your posts in your personal workspace and in organizations you belong to.</p>
          </div>
          <Link to="/posts" className="pf-head-link">Open Posts</Link>
        </div>

        {filters.length > 1 && (
          <div className="pf-chips" role="group" aria-label="Filter posts by status">
            {filters.map(f => (
              <button
                key={f.key}
                type="button"
                className={`pf-chip${filter === f.key ? ' is-active' : ''}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}<span className="pf-chip-count">{f.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading && !profile ? (
          <div className="pf-empty">Loading…</div>
        ) : !profile || profile.recentPosts.length === 0 ? (
          <div className="pf-empty">
            You haven't made any posts yet.{' '}
            <Link to="/create" className="pf-inline-link">Create your first post</Link>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="pf-empty">No {filter === 'ALL' ? '' : STATUS_LABEL[filter as ProfilePostSummary['status']].toLowerCase() + ' '}posts among your recent posts.</div>
        ) : (
          <>
            <ul className="pf-post-list">
              {visiblePosts.map(p => (
                <li key={p.id} className="pf-post-row">
                  <PostThumb src={p.mediaUrl} className="pf-post-thumb" fallbackClassName="pf-post-thumb-text" />
                  <div className="pf-post-main">
                    <p className="pf-post-caption">{p.caption || <em className="pf-muted">No caption</em>}</p>
                    <p className="pf-post-meta">
                      <span className="pf-post-where">
                        <i className={`fi ${p.orgName ? 'fi-rr-building' : 'fi-rr-user'}`} aria-hidden="true"></i>
                        {p.orgName ?? 'Personal'}
                      </span>
                      <span className="pf-dot" aria-hidden="true">·</span>
                      <span>{postDateLabel(p)}</span>
                    </p>
                  </div>
                  <span className={`pf-badge pf-post-badge ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </li>
              ))}
            </ul>
            {stats && stats.total > profile.recentPosts.length && (
              <p className="pf-footnote">Showing your {profile.recentPosts.length} most recent posts. Counts include all {stats.total}.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
