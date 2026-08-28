import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { organizationApi, organizationAdminApi } from '../../api/organizationApi';
import type { MyMembership, OrgType } from '../../../../types';
import { ApiError } from '../../../../api/axiosClient';

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
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<OrgType>('UNIVERSITY');
  const [newParentOrgId, setNewParentOrgId] = useState('');
  const [newOpenJoin, setNewOpenJoin] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    setInfo(null);
    try {
      const org = await organizationAdminApi.create(
        newName.trim(),
        newType,
        newParentOrgId.trim() || null,
        newOpenJoin,
      );
      setInfo(`Created ${org.name}. Join code: ${org.joinCode}`);
      setNewName('');
      setNewParentOrgId('');
      setNewOpenJoin(false);
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create organization.');
    } finally {
      setCreating(false);
    }
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

          <div className="org-card">
            <div className="org-card-title-row">
              <h3 className="org-card-title">Create an organization</h3>
              <button onClick={() => setShowCreate(v => !v)} className="org-btn-link">
                {showCreate ? 'Cancel' : 'New'}
              </button>
            </div>
            {showCreate && (
              <div className="org-create-form">
                <input
                  type="text"
                  placeholder="Organization name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="org-input"
                />
                <select value={newType} onChange={e => setNewType(e.target.value as OrgType)} className="org-input">
                  <option value="UNIVERSITY">University (top-level)</option>
                  <option value="DEPARTMENT">Department</option>
                  <option value="PROGRAM">Program</option>
                </select>
                {newType !== 'UNIVERSITY' && (
                  <input
                    type="text"
                    placeholder="Parent organization ID"
                    value={newParentOrgId}
                    onChange={e => setNewParentOrgId(e.target.value)}
                    className="org-input"
                  />
                )}
                <label className="org-checkbox-row">
                  <input type="checkbox" checked={newOpenJoin} onChange={e => setNewOpenJoin(e.target.checked)} />
                  <span>Open join (skip officer approval)</span>
                </label>
                <button onClick={handleCreate} disabled={creating || !newName.trim()} className="org-btn-primary">
                  {creating ? 'Creating…' : 'Create organization'}
                </button>
              </div>
            )}
          </div>
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
                    <span className="org-row-type">{m.orgType}</span>
                  </div>
                  <div className="org-row-badges">
                    <span className="org-badge">{m.role}</span>
                    <span className={`org-badge ${STATUS_STYLES[m.status]}`}>{m.status}</span>
                    {m.status === 'APPROVED' && (m.role === 'ADMIN' || m.role === 'OFFICER') && (
                      <Link to={`/organizations/${m.orgId}/manage`} className="org-btn-manage">Manage</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .org-page { padding: 28px 32px; max-width: 900px; }
        .org-header { margin-bottom: 20px; }
        .org-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 4px; letter-spacing: -0.02em; }
        .org-subtitle { font-size: 13px; color: #64748b; margin: 0; }

        .org-alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
        .org-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .org-alert-info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }

        .org-actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
        .org-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; }
        .org-card-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
        .org-card-title-row { display: flex; align-items: center; justify-content: space-between; }
        .org-card-title-row .org-card-title { margin: 0; }

        .org-inline-form { display: flex; gap: 8px; }
        .org-create-form { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .org-input {
          flex: 1; height: 38px; border: 2px solid #e2e8f0; border-radius: 10px;
          padding: 0 12px; font-size: 13px; color: #0f172a; outline: none;
          background: #f8fafc; font-family: inherit;
        }
        .org-input:focus { border-color: #3b82f6; background: #fff; }
        .org-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }

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

        @media (max-width: 700px) {
          .org-actions-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
