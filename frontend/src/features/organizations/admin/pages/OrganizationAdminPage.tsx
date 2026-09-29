import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { organizationAdminApi } from '../../api/organizationApi';
import CopyableCode from '../../shared/CopyableCode';
import { ORG_TYPE_ICON, ORG_TYPE_LABEL } from '../../shared/orgTypes';
import { displayNameFromEmail } from '../../shared/displayName';
import type { OrgManageDetail, OrgMembership, OrgRole, OrgType, SubOrg } from '../../../../types';
import { ApiError } from '../../../../api/axiosClient';
import { useAuth } from '../../../../context/useAuth';

const ROLES: OrgRole[] = ['ADMIN', 'OFFICER', 'CONTRIBUTOR', 'MEMBER'];

type SubOrgFilter = 'ALL' | Exclude<OrgType, 'UNIVERSITY'>;
const SUB_ORG_FILTERS: { value: SubOrgFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DEPARTMENT', label: 'Departments' },
  { value: 'PROGRAM', label: 'Programs' },
];

type RegenerateTarget = 'joinCode' | 'joinId';

function errorText(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** Keyed by orgId so moving from a university to one of its sub-orgs starts from a clean state. */
export default function OrganizationAdminPage() {
  const { orgId } = useParams<{ orgId: string }>();
  if (!orgId) return null;
  return <OrganizationManageView key={orgId} orgId={orgId} />;
}

function OrganizationManageView({ orgId }: Readonly<{ orgId: string }>) {
  const { user } = useAuth();
  const [org, setOrg] = useState<OrgManageDetail | null>(null);
  const [members, setMembers] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null);

  const [regenerateTarget, setRegenerateTarget] = useState<RegenerateTarget | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [subOrgs, setSubOrgs] = useState<SubOrg[]>([]);
  const [subOrgsLoading, setSubOrgsLoading] = useState(false);
  const [subOrgsError, setSubOrgsError] = useState<string | null>(null);
  const [subOrgFilter, setSubOrgFilter] = useState<SubOrgFilter>('ALL');
  const [subOrgQuery, setSubOrgQuery] = useState('');
  const [unlinkTarget, setUnlinkTarget] = useState<SubOrg | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | undefined>(undefined);

  const isUniversity = org?.type === 'UNIVERSITY';

  const loadSubOrgs = useCallback(async () => {
    setSubOrgsLoading(true);
    setSubOrgsError(null);
    try {
      setSubOrgs(await organizationAdminApi.listSubOrgs(orgId));
    } catch (e) {
      setSubOrgsError(errorText(e, 'Could not load sub-organizations.'));
    } finally {
      setSubOrgsLoading(false);
    }
  }, [orgId]);

  // Runs once per org (the view is keyed by orgId).
  useEffect(() => {
    let cancelled = false;
    Promise.all([organizationAdminApi.getDetails(orgId), organizationAdminApi.listMembers(orgId)])
      .then(([details, memberList]) => {
        if (cancelled) return;
        setOrg(details);
        setMembers(memberList);
        if (details.type === 'UNIVERSITY') void loadSubOrgs();
      })
      .catch(e => { if (!cancelled) setError(errorText(e, 'Could not load this organization.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, loadSubOrgs]);

  const pending = members.filter(m => m.status === 'PENDING');
  const decided = members.filter(m => m.status !== 'PENDING');

  const visibleSubOrgs = useMemo(() => {
    const q = subOrgQuery.trim().toLowerCase();
    return subOrgs.filter(s =>
      (subOrgFilter === 'ALL' || s.type === subOrgFilter) && (!q || s.name.toLowerCase().includes(q)));
  }, [subOrgs, subOrgFilter, subOrgQuery]);

  const subOrgCounts = useMemo(() => ({
    ALL: subOrgs.length,
    DEPARTMENT: subOrgs.filter(s => s.type === 'DEPARTMENT').length,
    PROGRAM: subOrgs.filter(s => s.type === 'PROGRAM').length,
  }), [subOrgs]);

  const runMemberAction = async (membershipId: string, action: () => Promise<unknown>, fallback: string) => {
    setBusyMembershipId(membershipId);
    setError(null);
    try {
      await action();
      setMembers(await organizationAdminApi.listMembers(orgId));
    } catch (e) {
      setError(errorText(e, fallback));
    } finally {
      setBusyMembershipId(null);
    }
  };

  const approve = (membershipId: string) =>
    runMemberAction(membershipId, () => organizationAdminApi.approveMember(orgId, membershipId), 'Could not approve this request.');

  const reject = (membershipId: string) =>
    runMemberAction(membershipId, () => organizationAdminApi.rejectMember(orgId, membershipId), 'Could not reject this request.');

  const changeRole = (membershipId: string, role: OrgRole) =>
    runMemberAction(membershipId, () => organizationAdminApi.changeRole(orgId, membershipId, role), 'Could not change role.');

  const confirmRegenerate = async () => {
    if (!regenerateTarget || !org) return;
    setRegenerating(true);
    setError(null);
    try {
      if (regenerateTarget === 'joinCode') {
        const { joinCode } = await organizationAdminApi.regenerateJoinCode(orgId);
        setOrg({ ...org, joinCode });
      } else {
        const { joinId } = await organizationAdminApi.regenerateJoinId(orgId);
        setOrg({ ...org, joinId });
      }
    } catch (e) {
      setError(errorText(e, 'Could not regenerate the code.'));
    } finally {
      setRegenerating(false);
      setRegenerateTarget(null);
    }
  };

  const confirmUnlink = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    setUnlinkError(undefined);
    try {
      await organizationAdminApi.unlinkSubOrg(orgId, unlinkTarget.id);
      setSubOrgs(list => list.filter(s => s.id !== unlinkTarget.id));
      setUnlinkTarget(null);
    } catch (e) {
      setUnlinkError(errorText(e, 'Could not unlink this sub-organization.'));
    } finally {
      setUnlinking(false);
    }
  };

  const backLink = org?.parentOrgId && org.canManageParent
    ? { to: `/organizations/${org.parentOrgId}/manage`, label: `Back to ${org.parentOrgName ?? 'university'}` }
    : { to: '/organizations', label: 'My organizations' };

  return (
    <>
      <div className="oa-page">
        <Link to={backLink.to} className="oa-back">
          <i className="fi fi-rr-arrow-left" aria-hidden="true"></i>
          <span>{backLink.label}</span>
        </Link>

        {loading && <div className="oa-empty" role="status">Loading organization…</div>}

        {!loading && !org && error && <div className="oa-alert oa-alert-error" role="alert">{error}</div>}

        {org && (
          <>
            <header className="oa-header">
              <span className="oa-header-icon" aria-hidden="true"><i className={`fi ${ORG_TYPE_ICON[org.type]}`}></i></span>
              <div className="oa-header-text">
                <h2 className="oa-title">{org.name}</h2>
                <div className="oa-header-meta">
                  <span className="oa-chip">{ORG_TYPE_LABEL[org.type]}</span>
                  {org.parentOrgName && (
                    <span className="oa-chip oa-chip-link">
                      <i className="fi fi-rr-link-alt" aria-hidden="true"></i>
                      Linked under {org.parentOrgName}
                    </span>
                  )}
                  {org.openJoin && <span className="oa-chip">Open join</span>}
                </div>
              </div>
            </header>

            {error && <div className="oa-alert oa-alert-error" role="alert">{error}</div>}

            {/* ── Invite codes ── */}
            <section className="oa-card" aria-labelledby="oa-codes-title">
              <h3 id="oa-codes-title" className="oa-card-title">Invite codes</h3>
              <div className="oa-codes">
                <div className="oa-code-block">
                  <div className="oa-code-head">
                    <span className="oa-code-label">Join Code</span>
                    {org.canAdminister && (
                      <button type="button" className="oa-btn-link" onClick={() => setRegenerateTarget('joinCode')}>
                        <i className="fi fi-rr-refresh" aria-hidden="true"></i> Regenerate
                      </button>
                    )}
                  </div>
                  <CopyableCode value={org.joinCode} label="join code" />
                  <p className="oa-hint">People enter this on the Organizations page to join as members.</p>
                </div>

                {isUniversity && org.joinId && (
                  <div className="oa-code-block">
                    <div className="oa-code-head">
                      <span className="oa-code-label">Join ID</span>
                      {org.canAdminister && (
                        <button type="button" className="oa-btn-link" onClick={() => setRegenerateTarget('joinId')}>
                          <i className="fi fi-rr-refresh" aria-hidden="true"></i> Regenerate
                        </button>
                      )}
                    </div>
                    <CopyableCode value={org.joinId} label="Join ID" />
                    <p className="oa-hint">Departments and programs enter this when they're created to be listed under {org.name}.</p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Pending requests ── */}
            {pending.length > 0 && (
              <section className="oa-card" aria-labelledby="oa-pending-title">
                <h3 id="oa-pending-title" className="oa-card-title">
                  Pending requests <span className="oa-count oa-count-warn">{pending.length}</span>
                </h3>
                <ul className="oa-list">
                  {pending.map(m => (
                    <li key={m.membershipId} className="oa-row">
                      <MemberIdentity email={m.email} isYou={m.userId === user?.userId} />
                      <div className="oa-row-actions">
                        <button
                          type="button"
                          onClick={() => void approve(m.membershipId)}
                          disabled={busyMembershipId === m.membershipId}
                          className="oa-btn-primary oa-btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void reject(m.membershipId)}
                          disabled={busyMembershipId === m.membershipId}
                          className="oa-btn-link oa-btn-danger"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Members ── */}
            <section className="oa-card" aria-labelledby="oa-members-title">
              <h3 id="oa-members-title" className="oa-card-title">
                Members <span className="oa-count">{decided.length}</span>
              </h3>
              {decided.length === 0 ? (
                <p className="oa-hint">No approved members yet. Share the join code above to invite people.</p>
              ) : (
                <ul className="oa-list">
                  {decided.map(m => (
                    <li key={m.membershipId} className="oa-row">
                      <MemberIdentity email={m.email} isYou={m.userId === user?.userId} />
                      <div className="oa-row-actions">
                        <select
                          value={m.role}
                          onChange={e => void changeRole(m.membershipId, e.target.value as OrgRole)}
                          disabled={!org.canAdminister || busyMembershipId === m.membershipId}
                          className="oa-select"
                          aria-label={`Role for ${m.email}`}
                          title={org.canAdminister ? undefined : 'Only admins can change roles'}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <span className={`oa-badge ${m.status === 'REJECTED' ? 'oa-badge-rejected' : 'oa-badge-approved'}`}>{m.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Sub-organizations (universities only) ── */}
            {isUniversity && (
              <section className="oa-card" aria-labelledby="oa-suborgs-title">
                <div className="oa-card-head">
                  <h3 id="oa-suborgs-title" className="oa-card-title">
                    Sub-organizations <span className="oa-count">{subOrgs.length}</span>
                  </h3>
                  {subOrgs.length > 0 && (
                    <input
                      type="search"
                      value={subOrgQuery}
                      onChange={e => setSubOrgQuery(e.target.value)}
                      placeholder="Search sub-organizations"
                      className="oa-input oa-search"
                      aria-label="Search sub-organizations"
                    />
                  )}
                </div>

                {subOrgs.length > 0 && (
                  <div className="oa-filters" role="tablist" aria-label="Filter sub-organizations by type">
                    {SUB_ORG_FILTERS.map(f => (
                      <button
                        key={f.value}
                        type="button"
                        role="tab"
                        aria-selected={subOrgFilter === f.value}
                        className={`oa-filter ${subOrgFilter === f.value ? 'is-active' : ''}`}
                        onClick={() => setSubOrgFilter(f.value)}
                      >
                        {f.label} <span className="oa-filter-count">{subOrgCounts[f.value]}</span>
                      </button>
                    ))}
                  </div>
                )}

                {subOrgsError && <div className="oa-alert oa-alert-error" role="alert">{subOrgsError}</div>}

                {subOrgsLoading && subOrgs.length === 0 && <p className="oa-hint">Loading sub-organizations…</p>}

                {!subOrgsLoading && !subOrgsError && subOrgs.length === 0 && (
                  <div className="oa-empty oa-empty-suborgs">
                    <span className="oa-empty-icon" aria-hidden="true"><i className="fi fi-rr-sitemap"></i></span>
                    <p className="oa-empty-title">No sub-organizations yet</p>
                    <p className="oa-empty-text">
                      When someone creates a Department or Program with your Join ID
                      {org.joinId && <> <strong className="oa-mono">{org.joinId}</strong></>}, it appears here.
                    </p>
                  </div>
                )}

                {subOrgs.length > 0 && visibleSubOrgs.length === 0 && (
                  <p className="oa-hint">No sub-organizations match your filter.</p>
                )}

                {visibleSubOrgs.length > 0 && (
                  <ul className="oa-list">
                    {visibleSubOrgs.map(s => (
                      <li key={s.id} className="oa-row oa-suborg-row">
                        <div className="oa-suborg-main">
                          <span className="oa-suborg-icon" aria-hidden="true"><i className={`fi ${ORG_TYPE_ICON[s.type]}`}></i></span>
                          <div className="oa-suborg-text">
                            <span className="oa-row-name">{s.name}</span>
                            <span className="oa-suborg-meta">
                              {ORG_TYPE_LABEL[s.type]} · {s.memberCount} {s.memberCount === 1 ? 'member' : 'members'}
                              {s.pendingCount > 0 && <span className="oa-badge oa-badge-pending">{s.pendingCount} pending</span>}
                            </span>
                          </div>
                        </div>
                        <div className="oa-row-actions">
                          <Link to={`/organizations/${s.id}/manage`} className="oa-btn-primary oa-btn-sm">Manage</Link>
                          {org.canAdminister && (
                            <button
                              type="button"
                              className="oa-icon-btn"
                              onClick={() => { setUnlinkError(undefined); setUnlinkTarget(s); }}
                              aria-label={`Unlink ${s.name}`}
                              title="Unlink from this university"
                            >
                              <i className="fi fi-rr-link-slash" aria-hidden="true"></i>
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={regenerateTarget !== null}
        title={regenerateTarget === 'joinId' ? 'Regenerate Join ID?' : 'Regenerate join code?'}
        description={regenerateTarget === 'joinId'
          ? 'The current Join ID stops working for new departments and programs. Sub-organizations already linked stay linked.'
          : 'The current join code stops working. Existing members keep their access.'}
        confirmLabel="Regenerate"
        busyLabel="Regenerating…"
        busy={regenerating}
        onCancel={() => { if (!regenerating) setRegenerateTarget(null); }}
        onConfirm={() => void confirmRegenerate()}
      />

      <ConfirmDialog
        open={unlinkTarget !== null}
        tone="danger"
        title={`Unlink ${unlinkTarget?.name ?? ''}?`}
        description={`It will no longer appear under ${org?.name ?? 'this university'}, and university officers lose access to manage it. The ${unlinkTarget ? ORG_TYPE_LABEL[unlinkTarget.type].toLowerCase() : 'organization'} and its members are kept.`}
        confirmLabel="Unlink"
        busyLabel="Unlinking…"
        busy={unlinking}
        error={unlinkError}
        onCancel={() => { if (!unlinking) setUnlinkTarget(null); }}
        onConfirm={() => void confirmUnlink()}
      />

      <style>{`
        .oa-page { padding: 28px 32px; max-width: 900px; }
        .oa-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: #0C447C; text-decoration: none; font-weight: 600;
        }
        .oa-back i { display: flex; line-height: 1; font-size: 12px; }
        .oa-back:hover span { text-decoration: underline; }

        .oa-header { display: flex; align-items: center; gap: 14px; margin: 14px 0 20px; }
        .oa-header-icon {
          width: 48px; height: 48px; flex-shrink: 0; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #0C447C, #3b82f6); color: #fff; font-size: 22px;
        }
        .oa-header-icon i { display: flex; line-height: 1; }
        .oa-header-text { min-width: 0; }
        .oa-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.02em; overflow-wrap: anywhere; }
        .oa-header-meta { display: flex; flex-wrap: wrap; gap: 6px; }
        .oa-chip {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 3px 9px; border-radius: 999px;
        }
        .oa-chip i { display: flex; line-height: 1; font-size: 11px; }
        .oa-chip-link { background: #eff6ff; color: #0C447C; }

        .oa-alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
        .oa-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

        .oa-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
        .oa-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .oa-card-head .oa-card-title { margin: 0; }
        .oa-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
        .oa-count { font-size: 11px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 2px 8px; border-radius: 999px; }
        .oa-count-warn { background: #fef9c3; color: #a16207; }
        .oa-hint { font-size: 12px; color: #64748b; margin: 0; line-height: 1.45; }

        .oa-codes { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
        .oa-code-block { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; border: 1px solid #f1f5f9; border-radius: 12px; background: #fbfcfe; }
        .oa-code-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .oa-code-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }

        .oa-input {
          height: 36px; border: 1.5px solid #e2e8f0; border-radius: 10px;
          padding: 0 12px; font-size: 13px; color: #0f172a; outline: none; background: #f8fafc; font-family: inherit;
        }
        .oa-input:focus { border-color: #3b82f6; background: #fff; }
        .oa-search { width: 240px; max-width: 100%; }

        .oa-btn-primary {
          display: inline-flex; align-items: center; justify-content: center;
          height: 38px; padding: 0 16px; background: #0C447C; color: #fff; border: none; text-decoration: none;
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .oa-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .oa-btn-primary:hover:not(:disabled) { background: #0a3867; }
        .oa-btn-primary:focus-visible, .oa-icon-btn:focus-visible, .oa-filter:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }
        .oa-btn-sm { height: 30px; padding: 0 12px; font-size: 12px; border-radius: 8px; }
        .oa-btn-link {
          display: inline-flex; align-items: center; gap: 5px;
          background: none; border: none; font-size: 12px; font-weight: 600; cursor: pointer; color: #0C447C; font-family: inherit; padding: 0;
        }
        .oa-btn-link i { display: flex; line-height: 1; font-size: 11px; }
        .oa-btn-link:disabled { opacity: 0.6; cursor: not-allowed; }
        .oa-btn-danger { color: #dc2626; }
        .oa-icon-btn {
          width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
          border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: #64748b; font-size: 13px; cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .oa-icon-btn i { display: flex; line-height: 1; }
        .oa-icon-btn:hover { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }

        .oa-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .oa-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid #f1f5f9; border-radius: 10px; }
        .oa-row-name { font-size: 13.5px; font-weight: 600; color: #0f172a; overflow-wrap: anywhere; }
        .oa-row-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .oa-select { height: 32px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; padding: 0 8px; font-family: inherit; background: #fff; }
        .oa-select:disabled { background: #f8fafc; color: #64748b; cursor: not-allowed; }
        .oa-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; }
        .oa-badge-approved { background: #dcfce7; color: #15803d; }
        .oa-badge-rejected { background: #fef2f2; color: #b91c1c; }
        .oa-badge-pending { background: #fef9c3; color: #a16207; padding: 1px 8px; }

        .oa-member { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .oa-member-avatar {
          width: 32px; height: 32px; flex-shrink: 0; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #0C447C, #3b82f6); color: #fff; font-weight: 700; font-size: 13px;
        }
        .oa-member-info { display: flex; flex-direction: column; min-width: 0; }
        .oa-member-name { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .oa-member-you { font-weight: 500; color: #64748b; }
        .oa-member-email { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .oa-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
        .oa-filter {
          display: inline-flex; align-items: center; gap: 6px;
          height: 30px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff;
          font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; font-family: inherit;
        }
        .oa-filter:hover { background: #f8fafc; }
        .oa-filter.is-active { background: #0C447C; border-color: #0C447C; color: #fff; }
        .oa-filter-count { font-size: 11px; opacity: 0.75; }

        .oa-suborg-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .oa-suborg-icon {
          width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px;
          display: flex; align-items: center; justify-content: center; background: #eff6ff; color: #0C447C; font-size: 15px;
        }
        .oa-suborg-icon i { display: flex; line-height: 1; }
        .oa-suborg-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .oa-suborg-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: #64748b; }

        .oa-empty { color: #94a3b8; font-size: 13px; padding: 24px; text-align: center; background: #fff; border: 1px dashed #e2e8f0; border-radius: 12px; margin-top: 14px; }
        .oa-empty-suborgs { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 0; }
        .oa-empty-icon {
          width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          background: #f1f5f9; color: #64748b; font-size: 18px; margin-bottom: 4px;
        }
        .oa-empty-icon i { display: flex; line-height: 1; }
        .oa-empty-title { font-size: 13.5px; font-weight: 700; color: #334155; margin: 0; }
        .oa-empty-text { font-size: 12.5px; color: #64748b; margin: 0; max-width: 420px; line-height: 1.5; }
        .oa-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #0f172a; letter-spacing: 0.05em; }

        @media (max-width: 640px) {
          .oa-page { padding: 20px 16px; }
          .oa-row { flex-wrap: wrap; }
          .oa-search { width: 100%; }
        }
      `}</style>
    </>
  );
}

function MemberIdentity({ email, isYou }: Readonly<{ email: string; isYou: boolean }>) {
  const name = displayNameFromEmail(email);
  return (
    <span className="oa-member">
      <span className="oa-member-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <span className="oa-member-info">
        <span className="oa-member-name">
          {name}
          {isYou && <span className="oa-member-you"> (You)</span>}
        </span>
        <span className="oa-member-email">{email}</span>
      </span>
    </span>
  );
}
