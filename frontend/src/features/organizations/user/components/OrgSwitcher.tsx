import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { useOrganization } from '../../../../context/OrganizationContext';

export default function OrgSwitcher() {
  const { user } = useAuth();
  const { memberships, activeOrgId, activeOrg, setActiveOrgId } = useOrganization();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const approved = memberships.filter(m => m.status === 'APPROVED');
  const currentName = activeOrg ? activeOrg.orgName : (user?.orgName || 'Personal Workspace');
  const currentRole = activeOrg ? activeOrg.role : 'Personal';

  return (
    <div className="org-switcher" ref={rootRef}>
      <button type="button" className="org-switcher-trigger" onClick={() => setOpen(v => !v)}>
        <div className="org-switcher-avatar">{currentName.charAt(0).toUpperCase()}</div>
        <div className="org-switcher-info">
          <span className="org-switcher-name">{currentName}</span>
          <span className="org-switcher-role">{currentRole}</span>
        </div>
        <svg className={`org-switcher-chevron ${open ? 'is-open' : ''}`} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="org-switcher-menu">
          <button
            type="button"
            className={`org-switcher-item ${!activeOrgId ? 'is-active' : ''}`}
            onClick={() => { setActiveOrgId(null); setOpen(false); }}
          >
            <span>{user?.orgName || 'Personal Workspace'}</span>
            {!activeOrgId && <span className="org-switcher-check">✓</span>}
          </button>

          {approved.length > 0 && <div className="org-switcher-divider" />}

          {approved.map(m => (
            <button
              key={m.orgId}
              type="button"
              className={`org-switcher-item ${activeOrgId === m.orgId ? 'is-active' : ''}`}
              onClick={() => { setActiveOrgId(m.orgId); setOpen(false); }}
            >
              <span>{m.orgName}</span>
              {activeOrgId === m.orgId && <span className="org-switcher-check">✓</span>}
            </button>
          ))}

          <div className="org-switcher-divider" />
          <Link to="/organizations" className="org-switcher-manage" onClick={() => setOpen(false)}>
            Create or join an organization
          </Link>
        </div>
      )}

      <style>{`
        .org-switcher { position: relative; margin-bottom: 20px; z-index: 30; }
        .org-switcher-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all 0.15s;
        }
        .org-switcher-trigger:hover { background: rgba(255,255,255,0.07); }
        .org-switcher-avatar {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 14px; flex-shrink: 0;
        }
        .org-switcher-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .org-switcher-name {
          color: #e2e8f0; font-size: 13px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .org-switcher-role { color: #64748b; font-size: 11px; font-weight: 500; text-transform: capitalize; }
        .org-switcher-chevron { color: #64748b; flex-shrink: 0; transition: transform 0.15s; }
        .org-switcher-chevron.is-open { transform: rotate(180deg); }

        .org-switcher-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0; right: 0;
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        .org-switcher-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 10px;
          background: none;
          border: none;
          border-radius: 8px;
          color: #cbd5e1;
          font-size: 12.5px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }
        .org-switcher-item:hover { background: rgba(255,255,255,0.06); }
        .org-switcher-item.is-active { color: #fff; font-weight: 600; }
        .org-switcher-check { color: #3b82f6; font-weight: 700; }
        .org-switcher-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 2px; }
        .org-switcher-manage {
          display: block;
          padding: 9px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #60a5fa;
          text-decoration: none;
          border-radius: 8px;
        }
        .org-switcher-manage:hover { background: rgba(59,130,246,0.08); }
      `}</style>
    </div>
  );
}
