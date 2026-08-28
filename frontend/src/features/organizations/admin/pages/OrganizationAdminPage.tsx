import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { organizationApi, organizationAdminApi } from '../../api/organizationApi';
import type { OrgSummary, OrgMembership, OrgDirectory, OrgContributor, OrgRole } from '../../../../types';
import { ApiError } from '../../../../api/axiosClient';

const ROLES: OrgRole[] = ['ADMIN', 'OFFICER', 'CONTRIBUTOR', 'MEMBER'];

function ContributorPanel({ orgId, directoryId }: Readonly<{ orgId: string; directoryId: string }>) {
  const [contributors, setContributors] = useState<OrgContributor[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setContributors(await organizationAdminApi.listContributors(orgId, directoryId));
  }, [orgId, directoryId]);

  useEffect(() => { void load(); }, [load]);

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await organizationAdminApi.grantContributor(orgId, directoryId, email.trim());
      setEmail('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not grant access.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (userId: string) => {
    setBusy(true);
    try {
      await organizationAdminApi.revokeContributor(orgId, directoryId, userId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oa-contrib">
      {error && <div className="oa-alert oa-alert-error">{error}</div>}
      <div className="oa-inline-form">
        <input
          type="email"
          placeholder="Member email to grant upload access"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && grant()}
          className="oa-input"
        />
        <button onClick={grant} disabled={busy || !email.trim()} className="oa-btn-primary">Grant</button>
      </div>
      {contributors.length > 0 && (
        <ul className="oa-contrib-list">
          {contributors.map(c => (
            <li key={c.userId} className="oa-contrib-item">
              <span>{c.email}</span>
              <button onClick={() => revoke(c.userId)} disabled={busy} className="oa-btn-link oa-btn-danger">Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OrganizationAdminPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [members, setMembers] = useState<OrgMembership[]>([]);
  const [directories, setDirectories] = useState<OrgDirectory[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirectory, setExpandedDirectory] = useState<string | null>(null);

  const [newDirTitle, setNewDirTitle] = useState('');
  const [newDirRequiresApproval, setNewDirRequiresApproval] = useState(true);
  const [creatingDir, setCreatingDir] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setError(null);
    try {
      const [orgSummary, memberList, directoryList] = await Promise.all([
        organizationApi.getOrg(orgId),
        organizationAdminApi.listMembers(orgId),
        organizationAdminApi.listDirectories(orgId),
      ]);
      setOrg(orgSummary);
      setMembers(memberList);
      setDirectories(directoryList);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this organization.');
    }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  if (!orgId) return null;

  const pending = members.filter(m => m.status === 'PENDING');
  const decided = members.filter(m => m.status !== 'PENDING');

  const approve = async (membershipId: string) => {
    await organizationAdminApi.approveMember(orgId, membershipId);
    await load();
  };

  const reject = async (membershipId: string) => {
    await organizationAdminApi.rejectMember(orgId, membershipId);
    await load();
  };

  const changeRole = async (membershipId: string, role: OrgRole) => {
    try {
      await organizationAdminApi.changeRole(orgId, membershipId, role);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change role.');
    }
  };

  const regenerateJoinCode = async () => {
    const result = await organizationAdminApi.regenerateJoinCode(orgId);
    setJoinCode(result.joinCode);
  };

  const createDirectory = async () => {
    if (!newDirTitle.trim()) return;
    setCreatingDir(true);
    try {
      await organizationAdminApi.createDirectory(orgId, newDirTitle.trim(), newDirRequiresApproval);
      setNewDirTitle('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create directory.');
    } finally {
      setCreatingDir(false);
    }
  };

  return (
    <>
      <div className="oa-page">
        <Link to="/organizations" className="oa-back">&larr; My organizations</Link>
        <h2 className="oa-title">{org?.name ?? 'Loading…'}</h2>
        {org && <p className="oa-subtitle">{org.type}</p>}

        {error && <div className="oa-alert oa-alert-error">{error}</div>}

        <div className="oa-card">
          <h3 className="oa-card-title">Join code</h3>
          <div className="oa-inline-form">
            <code className="oa-join-code">{joinCode ?? '••••••••'}</code>
            <button onClick={regenerateJoinCode} className="oa-btn-primary">Regenerate</button>
          </div>
          <p className="oa-hint">Regenerating invalidates the previous code. Share it with people who should join.</p>
        </div>

        {pending.length > 0 && (
          <div className="oa-card">
            <h3 className="oa-card-title">Pending requests ({pending.length})</h3>
            <div className="oa-list">
              {pending.map(m => (
                <div key={m.membershipId} className="oa-row">
                  <span className="oa-row-name">{m.email}</span>
                  <div className="oa-row-actions">
                    <button onClick={() => approve(m.membershipId)} className="oa-btn-primary oa-btn-sm">Approve</button>
                    <button onClick={() => reject(m.membershipId)} className="oa-btn-link oa-btn-danger">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="oa-card">
          <h3 className="oa-card-title">Members ({decided.length})</h3>
          <div className="oa-list">
            {decided.map(m => (
              <div key={m.membershipId} className="oa-row">
                <span className="oa-row-name">{m.email}</span>
                <div className="oa-row-actions">
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.membershipId, e.target.value as OrgRole)}
                    className="oa-select"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className={`oa-badge ${m.status === 'REJECTED' ? 'oa-badge-rejected' : 'oa-badge-approved'}`}>{m.status}</span>
                </div>
              </div>
            ))}
            {decided.length === 0 && <p className="oa-hint">No approved members yet.</p>}
          </div>
        </div>

        <div className="oa-card">
          <h3 className="oa-card-title">Directories</h3>
          <div className="oa-inline-form">
            <input
              type="text"
              placeholder="New directory / event title"
              value={newDirTitle}
              onChange={e => setNewDirTitle(e.target.value)}
              className="oa-input"
            />
            <label className="oa-checkbox-row">
              <input type="checkbox" checked={newDirRequiresApproval} onChange={e => setNewDirRequiresApproval(e.target.checked)} />
              <span>Requires approval</span>
            </label>
            <button onClick={createDirectory} disabled={creatingDir || !newDirTitle.trim()} className="oa-btn-primary">
              {creatingDir ? 'Creating…' : 'Create'}
            </button>
          </div>

          <div className="oa-list oa-list-spaced">
            {directories.map(d => (
              <div key={d.id} className="oa-directory">
                <button
                  className="oa-directory-header"
                  onClick={() => setExpandedDirectory(v => v === d.id ? null : d.id)}
                >
                  <span className="oa-row-name">{d.title}</span>
                  <span className="oa-badge">{d.requiresApproval ? 'Moderated' : 'Auto-publish'}</span>
                </button>
                {expandedDirectory === d.id && <ContributorPanel orgId={orgId} directoryId={d.id} />}
              </div>
            ))}
            {directories.length === 0 && <p className="oa-hint">No directories yet.</p>}
          </div>
        </div>
      </div>

      <style>{`
        .oa-page { padding: 28px 32px; max-width: 900px; }
        .oa-back { font-size: 12px; color: #0C447C; text-decoration: none; font-weight: 600; }
        .oa-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 10px 0 2px; letter-spacing: -0.02em; }
        .oa-subtitle { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 20px; }

        .oa-alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
        .oa-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

        .oa-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
        .oa-card-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
        .oa-hint { font-size: 12px; color: #94a3b8; margin: 8px 0 0; }

        .oa-inline-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .oa-input {
          flex: 1; min-width: 180px; height: 38px; border: 2px solid #e2e8f0; border-radius: 10px;
          padding: 0 12px; font-size: 13px; color: #0f172a; outline: none; background: #f8fafc; font-family: inherit;
        }
        .oa-input:focus { border-color: #3b82f6; background: #fff; }
        .oa-join-code { font-size: 16px; font-weight: 700; letter-spacing: 0.1em; background: #f1f5f9; padding: 8px 14px; border-radius: 8px; color: #0f172a; }
        .oa-checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; white-space: nowrap; }

        .oa-btn-primary {
          height: 38px; padding: 0 16px; background: #0C447C; color: #fff; border: none;
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .oa-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .oa-btn-primary:hover:not(:disabled) { background: #0a3867; }
        .oa-btn-sm { height: 30px; padding: 0 12px; font-size: 12px; }
        .oa-btn-link { background: none; border: none; font-size: 12px; font-weight: 600; cursor: pointer; color: #0C447C; }
        .oa-btn-danger { color: #dc2626; }

        .oa-list { display: flex; flex-direction: column; gap: 8px; }
        .oa-list-spaced { margin-top: 14px; }
        .oa-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: 1px solid #f1f5f9; border-radius: 10px; }
        .oa-row-name { font-size: 13px; font-weight: 600; color: #0f172a; }
        .oa-row-actions { display: flex; align-items: center; gap: 10px; }
        .oa-select { height: 32px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; padding: 0 8px; font-family: inherit; }
        .oa-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; }
        .oa-badge-approved { background: #dcfce7; color: #15803d; }
        .oa-badge-rejected { background: #fef2f2; color: #b91c1c; }

        .oa-directory { border: 1px solid #f1f5f9; border-radius: 10px; overflow: hidden; }
        .oa-directory-header {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; background: none; border: none; cursor: pointer; font-family: inherit;
        }
        .oa-contrib { padding: 0 12px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
        .oa-contrib-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .oa-contrib-item { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #334155; padding: 6px 10px; background: #f8fafc; border-radius: 8px; }
      `}</style>
    </>
  );
}
