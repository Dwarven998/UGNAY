import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { useDialog } from '../../../../components/ui/useDialog';
import { organizationApi } from '../../api/organizationApi';
import CreateOrganizationCard from '../components/CreateOrganizationCard';
import { ORG_TYPE_LABEL } from '../../shared/orgTypes';
import { displayNameFromEmail } from '../../shared/displayName';
import type { MyMembership, OrgMember } from '../../../../types';
import { ApiError } from '../../../../api/axiosClient';
import { useAuth } from '../../../../context/useAuth';
import { useOrganization } from '../../../../context/useOrganization';

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'org-badge-approved',
  PENDING: 'org-badge-pending',
  REJECTED: 'org-badge-rejected',
};

export default function OrganizationsPage() {
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const { user } = useAuth();
  const { refreshMemberships } = useOrganization();

  // Member-only row menu: view members / leave organization.
  const [menuOrgId, setMenuOrgId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [membersOf, setMembersOf] = useState<MyMembership | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<MyMembership | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!menuOrgId) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOrgId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOrgId(null); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOrgId]);

  // Focus, Escape and scroll lock for the Members dialog (the Leave dialog gets the same from ConfirmDialog).
  const membersDialogRef = useDialog<HTMLDivElement>({ open: Boolean(membersOf), onClose: () => setMembersOf(null) });

  const openMembers = async (m: MyMembership) => {
    setMenuOrgId(null);
    setMembersOf(m);
    setMembers([]);
    setMembersError(null);
    setMembersLoading(true);
    try {
      setMembers(await organizationApi.listMembers(m.orgId));
    } catch (e) {
      setMembersError(e instanceof ApiError ? e.message : 'Could not load members.');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    setError(null);
    setInfo(null);
    try {
      await organizationApi.leave(leaveTarget.orgId);
      setInfo(`You left ${leaveTarget.orgName}.`);
      setLeaveTarget(null);
      await Promise.all([load(), refreshMemberships()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not leave the organization.');
      setLeaveTarget(null);
    } finally {
      setLeaving(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await organizationApi.listMine();
      setMemberships(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setError(null);
    setInfo(null);
    try {
      const result = await organizationApi.joinByCode(joinCode.trim().toUpperCase());
      setJoinCode('');
      setInfo(
        result.status === 'APPROVED'
          ? `Joined ${result.orgName}.`
          : `Requested to join ${result.orgName}. Waiting for officer approval.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not join with that code.');
    } finally {
      setJoining(false);
    }
  };

  const handleCreated = async () => {
    setError(null);
    setInfo(null);
    await Promise.all([load(), refreshMemberships()]);
  };

  return (
    <>
      <div className="org-page">
        <div className="org-header">
          <div>
            <h2 className="org-title">Organizations</h2>
            <p className="org-subtitle">Organizations you belong to, and ways to join or create one.</p>
          </div>
        </div>

        {error && <div className="org-alert org-alert-error">{error}</div>}
        {info && <div className="org-alert org-alert-info">{info}</div>}

        <div className="org-actions-row">
          <div className="org-card org-join-card">
            <h3 className="org-card-title">Join with a code</h3>
            <div className="org-inline-form">
              <input
                type="text"
                placeholder="Enter join code"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                className="org-input"
              />
              <button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="org-btn-primary">
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>

          {!showCreate ? (
            <button type="button" className="org-card org-create-trigger" onClick={() => setShowCreate(true)}>
              <span className="org-create-trigger-text">
                <span className="org-card-title">Create an organization</span>
                <span className="org-create-trigger-sub">Start a university, department, or program</span>
              </span>
              <span className="org-create-plus" aria-hidden="true">
                <i className="fi fi-rr-plus"></i>
              </span>
            </button>
          ) : (
            <CreateOrganizationCard onClose={() => setShowCreate(false)} onCreated={handleCreated} />
          )}
        </div>

        <div className="org-list-section">
          <h3 className="org-section-title">My memberships</h3>
          {loading ? (
            <div className="org-empty">Loading…</div>
          ) : memberships.length === 0 ? (
            <div className="org-empty">You haven't joined any organizations yet.</div>
          ) : (
            <div className="org-list">
              {memberships.map(m => (
                <div key={m.orgId} className="org-row">
                  <div className="org-row-main">
                    <span className="org-row-name">{m.orgName}</span>
                    <span className="org-row-type">{ORG_TYPE_LABEL[m.orgType]}</span>
                  </div>
                  <div className="org-row-badges">
                    <span className="org-badge">{m.role}</span>
                    <span className={`org-badge ${STATUS_STYLES[m.status]}`}>{m.status}</span>
                    {m.status === 'APPROVED' && (m.role === 'ADMIN' || m.role === 'OFFICER') && (
                      <Link to={`/organizations/${m.orgId}/manage`} className="org-btn-manage">Manage</Link>
                    )}
                    {m.role === 'MEMBER' && (
                      <div className="org-menu" ref={menuOrgId === m.orgId ? menuRef : undefined}>
                        <button
                          type="button"
                          className={`org-menu-trigger ${menuOrgId === m.orgId ? 'is-open' : ''}`}
                          onClick={() => setMenuOrgId(id => (id === m.orgId ? null : m.orgId))}
                          aria-label={`More options for ${m.orgName}`}
                          aria-haspopup="menu"
                          aria-expanded={menuOrgId === m.orgId}
                        >
                          <i className="fi fi-rr-menu-dots-vertical" aria-hidden="true"></i>
                        </button>
                        {menuOrgId === m.orgId && (
                          <div className="org-menu-list" role="menu">
                            {m.status === 'APPROVED' && (
                              <button type="button" role="menuitem" className="org-menu-item" onClick={() => void openMembers(m)}>
                                <i className="fi fi-rr-users" aria-hidden="true"></i>
                                <span>View Members</span>
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className="org-menu-item org-menu-item-danger"
                              onClick={() => { setMenuOrgId(null); setLeaveTarget(m); }}
                            >
                              <i className="fi fi-rr-exit" aria-hidden="true"></i>
                              <span>
                                {m.status === 'APPROVED' ? `Leave Organization ${m.orgName}` : `Withdraw request to ${m.orgName}`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── View Members dialog ── */}
      {membersOf && createPortal(
        <div className="org-modal-backdrop" onClick={() => setMembersOf(null)}>
          <div
            ref={membersDialogRef}
            className="org-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-members-title"
            aria-busy={membersLoading || undefined}
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
          >
            <div className="org-modal-header">
              <div>
                <h3 id="org-members-title" className="org-modal-title">Members of {membersOf.orgName}</h3>
                <p className="org-modal-sub">
                  {membersLoading
                    ? 'Loading members…'
                    : membersError
                      ? '—'
                      : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                </p>
              </div>
              <button type="button" className="org-modal-close" onClick={() => setMembersOf(null)} aria-label="Close dialog">
                <i className="fi fi-rr-cross-small" aria-hidden="true"></i>
              </button>
            </div>
            <div className="org-modal-body">
              {membersLoading ? (
                <div className="org-empty" role="status">Loading…</div>
              ) : membersError ? (
                <div className="org-alert org-alert-error" role="alert">{membersError}</div>
              ) : members.length === 0 ? (
                <div className="org-empty">No members yet.</div>
              ) : (
                <ul className="org-member-list">
                  {members.map(mem => (
                    <li key={mem.userId} className="org-member-row">
                      <span className="org-member-avatar" aria-hidden="true">
                        {displayNameFromEmail(mem.email).charAt(0).toUpperCase()}
                      </span>
                      <span className="org-member-info">
                        <span className="org-member-name">
                          {displayNameFromEmail(mem.email)}
                          {mem.userId === user?.userId && <span className="org-member-you"> (You)</span>}
                        </span>
                        <span className="org-member-email">{mem.email}</span>
                      </span>
                      <span className="org-badge">{mem.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="org-modal-footer">
              <button type="button" className="org-btn-secondary" onClick={() => setMembersOf(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Leave confirmation dialog ── */}
      <ConfirmDialog
        open={leaveTarget !== null}
        tone="danger"
        title={leaveTarget?.status === 'APPROVED' ? `Leave ${leaveTarget.orgName}?` : `Withdraw request to ${leaveTarget?.orgName ?? ''}?`}
        description={leaveTarget?.status === 'APPROVED'
          ? "You'll lose access to this organization's posts and media. You can rejoin later with a join code."
          : 'Your pending request will be removed. You can request again later with a join code.'}
        confirmLabel={leaveTarget?.status === 'APPROVED' ? 'Leave organization' : 'Withdraw request'}
        busyLabel="Leaving…"
        busy={leaving}
        onCancel={() => { if (!leaving) setLeaveTarget(null); }}
        onConfirm={() => void handleLeave()}
      />

      <style>{`
        .org-page { padding: 28px 32px; max-width: 900px; }
        .org-header { margin-bottom: 20px; }
        .org-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 4px; letter-spacing: -0.02em; }
        .org-subtitle { font-size: 13px; color: #64748b; margin: 0; }

        .org-alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
        .org-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .org-alert-info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }

        .org-actions-row { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 16px; margin-bottom: 28px; }
        .org-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; }
        .org-card-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
        .org-card-title-row { display: flex; align-items: center; justify-content: space-between; }
        .org-card-title-row .org-card-title { margin: 0; }

        .org-inline-form { display: flex; gap: 8px; }
        .org-input {
          flex: 1; height: 38px; border: 2px solid #e2e8f0; border-radius: 10px;
          padding: 0 12px; font-size: 13px; color: #0f172a; outline: none;
          background: #f8fafc; font-family: inherit;
        }
        .org-input:focus { border-color: #3b82f6; background: #fff; }

        .org-btn-primary {
          height: 38px; padding: 0 18px; background: #0C447C; color: #fff; border: none;
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .org-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .org-btn-primary:hover:not(:disabled) { background: #0a3867; }
        .org-btn-link { background: none; border: none; color: #0C447C; font-size: 12px; font-weight: 600; cursor: pointer; }

        .org-section-title { font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 12px; }
        .org-empty { color: #94a3b8; font-size: 13px; padding: 24px; text-align: center; background: #fff; border: 1px dashed #e2e8f0; border-radius: 12px; }

        .org-list { display: flex; flex-direction: column; gap: 8px; }
        .org-row {
          display: flex; align-items: center; justify-content: space-between;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px;
        }
        .org-row-main { display: flex; align-items: center; gap: 10px; }
        .org-row-name { font-size: 14px; font-weight: 600; color: #0f172a; }
        .org-row-type { font-size: 11px; font-weight: 600; color: #94a3b8; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }
        .org-row-badges { display: flex; align-items: center; gap: 8px; }
        .org-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; }
        .org-badge-approved { background: #dcfce7; color: #15803d; }
        .org-badge-pending { background: #fef9c3; color: #a16207; }
        .org-badge-rejected { background: #fef2f2; color: #b91c1c; }
        .org-btn-manage {
          font-size: 12px; font-weight: 600; color: #fff; background: #0C447C;
          padding: 6px 12px; border-radius: 8px; text-decoration: none;
        }

        /* Create-organization card (whole card is the button) */
        .org-create-trigger {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          text-align: left; font-family: inherit; cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .org-create-trigger .org-card-title { display: block; margin: 0 0 4px; }
        .org-create-trigger-text { display: flex; flex-direction: column; min-width: 0; }
        .org-create-trigger-sub { font-size: 12.5px; color: #64748b; }
        .org-create-plus {
          width: 44px; height: 44px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 12px; background: #eff6ff; color: #0C447C; font-size: 18px;
          transition: background 0.15s, color 0.15s, transform 0.15s;
        }
        .org-create-plus i { display: flex; line-height: 1; }
        .org-create-trigger:hover,
        .org-create-trigger:focus-visible {
          border-color: #93c5fd; background: #f8fbff;
          box-shadow: 0 4px 14px rgba(12,68,124,0.08); outline: none;
        }
        .org-create-trigger:hover .org-create-plus,
        .org-create-trigger:focus-visible .org-create-plus { background: #0C447C; color: #fff; transform: rotate(90deg); }

        /* Member row menu */
        .org-menu { position: relative; }
        .org-menu-trigger {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid transparent; border-radius: 8px; background: transparent;
          color: #64748b; font-size: 15px; cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .org-menu-trigger i { display: flex; line-height: 1; }
        .org-menu-trigger:hover,
        .org-menu-trigger:focus-visible,
        .org-menu-trigger.is-open { background: #f1f5f9; color: #0f172a; outline: none; }
        .org-menu-list {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
          min-width: 220px; max-width: 300px;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 6px; box-shadow: 0 12px 32px rgba(15,23,42,0.14);
        }
        .org-menu-item {
          width: 100%;
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border: none; border-radius: 8px; background: none;
          color: #334155; font-size: 13px; font-weight: 500; font-family: inherit;
          text-align: left; cursor: pointer; transition: background 0.15s;
        }
        .org-menu-item i { display: flex; line-height: 1; font-size: 14px; flex-shrink: 0; }
        .org-menu-item span { overflow-wrap: anywhere; }
        .org-menu-item:hover,
        .org-menu-item:focus-visible { background: #f1f5f9; outline: none; }
        .org-menu-item-danger { color: #b91c1c; }
        .org-menu-item-danger:hover,
        .org-menu-item-danger:focus-visible { background: #fef2f2; }

        /* Dialogs */
        .org-modal-backdrop {
          position: fixed; inset: 0; z-index: 900;
          background: rgba(2,6,23,0.55); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
          animation: ugDialogFade 0.18s ease-out;
        }
        .org-modal {
          width: 100%; max-width: 460px; max-height: min(640px, calc(100vh - 32px));
          display: flex; flex-direction: column; overflow: hidden;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
          box-shadow: 0 24px 60px rgba(2,6,23,0.22), 0 4px 12px rgba(2,6,23,0.06);
          animation: ugDialogIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }
        .org-modal-sm { max-width: 400px; }
        .org-modal-header {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          padding: 20px 16px 14px 22px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
        }
        .org-modal-title { font-size: 16px; font-weight: 700; line-height: 1.35; color: #0f172a; margin: 0; overflow-wrap: anywhere; }
        .org-modal-sub { font-size: 12.5px; color: #64748b; margin: 4px 0 0; }
        .org-modal-text { font-size: 13px; color: #475569; line-height: 1.5; margin: 8px 0 18px; }
        .org-modal-close {
          width: 34px; height: 34px; flex-shrink: 0; margin-top: -4px;
          display: flex; align-items: center; justify-content: center;
          border: none; border-radius: 9px; background: transparent; color: #64748b; font-size: 18px; cursor: pointer;
          transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
        }
        .org-modal-close i { display: flex; line-height: 1; }
        .org-modal-close:hover { background: #f1f5f9; color: #0f172a; }
        .org-modal-close:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }
        .org-modal-body { overflow-y: auto; overscroll-behavior: contain; min-height: 0; padding: 10px 14px 12px; }
        .org-modal-body > .org-empty, .org-modal-body > .org-alert { margin: 8px; }
        .org-modal-footer {
          display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
          padding: 12px 16px; border-top: 1px solid #f1f5f9; background: #fbfcfe;
        }
        .org-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .org-btn-secondary {
          height: 38px; padding: 0 16px; background: #fff; color: #334155; border: 1px solid #e2e8f0;
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
          transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .org-btn-secondary:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
        .org-btn-secondary:focus-visible, .org-btn-danger:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }
        @media (max-width: 480px) {
          .org-modal-backdrop { align-items: flex-end; padding: 0; }
          .org-modal { max-width: none; max-height: 88vh; border-radius: 18px 18px 0 0; border-bottom: none; }
          .org-modal-footer { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
          .org-modal-footer .org-btn-secondary { flex: 1; height: 44px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .org-modal-backdrop, .org-modal { animation: none; }
        }
        .org-btn-danger {
          height: 38px; padding: 0 16px; background: #dc2626; color: #fff; border: none;
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .org-btn-danger:hover:not(:disabled) { background: #b91c1c; }
        .org-btn-secondary:disabled, .org-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

        .org-member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .org-member-row { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 10px; }
        .org-member-row:hover { background: #f8fafc; }
        .org-member-avatar {
          width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #0C447C, #3b82f6); color: #fff; font-weight: 700; font-size: 14px;
        }
        .org-member-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .org-member-name { font-size: 13.5px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .org-member-you { font-weight: 500; color: #64748b; }
        .org-member-email { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        @media (max-width: 700px) {
          .org-actions-row { grid-template-columns: 1fr; }
          .org-row { flex-wrap: wrap; gap: 10px; }
        }
      `}</style>
    </>
  );
}
