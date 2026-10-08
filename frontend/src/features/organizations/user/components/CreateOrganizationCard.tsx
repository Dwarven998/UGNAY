import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { organizationAdminApi } from '../../api/organizationApi';
import CopyableCode from '../../shared/CopyableCode';
import { ORG_TYPE_ICON, ORG_TYPE_LABEL } from '../../shared/orgTypes';
import type { OrgDetail, OrgType } from '../../../../types';
import { ApiError } from '../../../../api/axiosClient';

const TYPE_OPTIONS: { value: OrgType; label: string; icon: string; description: string }[] = [
  { value: 'UNIVERSITY', label: 'University', icon: ORG_TYPE_ICON.UNIVERSITY, description: 'Top-level. Departments and programs can link to it.' },
  { value: 'DEPARTMENT', label: 'Department', icon: ORG_TYPE_ICON.DEPARTMENT, description: 'On its own, or linked under a university.' },
  { value: 'PROGRAM', label: 'Program', icon: ORG_TYPE_ICON.PROGRAM, description: 'On its own, or linked under a university.' },
];

interface Props {
  onClose: () => void;
  /** Called after the org exists, so the page can refresh its membership list. */
  onCreated: (org: OrgDetail) => void | Promise<void>;
}

export default function CreateOrganizationCard({ onClose, onCreated }: Readonly<Props>) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OrgType>('UNIVERSITY');
  const [joinId, setJoinId] = useState('');
  const [openJoin, setOpenJoin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<OrgDetail | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), joinId: useId(), joinIdHint: useId(), type: useId(), openJoin: useId() };

  useEffect(() => { nameRef.current?.focus(); }, []);

  const isSubOrg = type !== 'UNIVERSITY';
  const canSubmit = name.trim().length > 0 && !creating;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    setError(null);
    try {
      const org = await organizationAdminApi.create(
        name.trim(),
        type,
        isSubOrg && joinId.trim() ? joinId.trim().toUpperCase() : null,
        openJoin,
        { description: description.trim() || undefined }
      );
      setCreated(org);
      await onCreated(org);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the organization.');
    } finally {
      setCreating(false);
    }
  };

  const startAnother = () => {
    setCreated(null);
    setName('');
    setDescription('');
    setJoinId('');
    setOpenJoin(false);
    setError(null);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  };

  if (created) {
    return (
      <div className="coc-card" role="status">
        <div className="coc-success-head">
          <span className="coc-success-icon" aria-hidden="true"><i className="fi fi-rr-check"></i></span>
          <div>
            <h3 className="coc-title">{created.name} is ready</h3>
            <p className="coc-sub">
              {ORG_TYPE_LABEL[created.type]}
              {created.parentOrgName ? <> · linked under <strong>{created.parentOrgName}</strong></> : null}
              {' '}· you're its admin
            </p>
          </div>
        </div>

        <div className="coc-codes">
          <div className="coc-code-block">
            <span className="coc-code-label">Join Code</span>
            <CopyableCode value={created.joinCode} label="join code" />
            <span className="coc-code-hint">Share with people who should join as members.</span>
          </div>
          {created.joinId && (
            <div className="coc-code-block">
              <span className="coc-code-label">Join ID</span>
              <CopyableCode value={created.joinId} label="Join ID" />
              <span className="coc-code-hint">Share with departments and programs so they can link to this university.</span>
            </div>
          )}
        </div>

        <div className="coc-actions">
          <button type="button" className="coc-btn-secondary" onClick={startAnother}>Create another</button>
          <Link to={`/organizations/${created.id}/manage`} className="coc-btn-primary">Manage {created.name}</Link>
          <button type="button" className="coc-btn-link" onClick={onClose}>Done</button>
        </div>
        <style>{STYLES}</style>
      </div>
    );
  }

  return (
    <form className="coc-card" onSubmit={e => void submit(e)} noValidate>
      <div className="coc-head">
        <div>
          <h3 className="coc-title">Create an organization</h3>
          <p className="coc-sub">You'll be its admin and get a join code to invite members.</p>
        </div>
        <button type="button" onClick={onClose} className="coc-close" aria-label="Cancel creating an organization">
          <i className="fi fi-rr-cross-small" aria-hidden="true"></i>
        </button>
      </div>

      {error && <div className="coc-alert" role="alert">{error}</div>}

      <div className="coc-field">
        <label htmlFor={ids.name} className="coc-label">Organization name</label>
        <input
          id={ids.name}
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. College of Engineering"
          maxLength={255}
          autoComplete="organization"
          className="coc-input"
        />
      </div>

      <div className="coc-field">
        <label htmlFor="coc-org-desc" className="coc-label">
          Description / Mission <span className="coc-optional">(optional)</span>
        </label>
        <textarea
          id="coc-org-desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Empowering students through tech innovation and community events."
          rows={2}
          className="coc-input"
          style={{ height: 'auto', minHeight: '52px', padding: '8px 12px', resize: 'vertical' }}
        />
        <p className="coc-hint">The AI uses your description to set the brand tone and avoid generic output.</p>
      </div>

      <div className="coc-field">
        <span id={ids.type} className="coc-label">Type</span>
        <div className="coc-types" role="radiogroup" aria-labelledby={ids.type}>
          {TYPE_OPTIONS.map(opt => (
            <label key={opt.value} className={`coc-type ${type === opt.value ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="org-type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                className="coc-type-radio"
              />
              <span className="coc-type-icon" aria-hidden="true"><i className={`fi ${opt.icon}`}></i></span>
              <span className="coc-type-text">
                <span className="coc-type-label">{opt.label}</span>
                <span className="coc-type-desc">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {isSubOrg ? (
        <div className="coc-field">
          <label htmlFor={ids.joinId} className="coc-label">
            Join ID <span className="coc-optional">(optional)</span>
          </label>
          <input
            id={ids.joinId}
            type="text"
            value={joinId}
            onChange={e => setJoinId(e.target.value.toUpperCase())}
            placeholder="e.g. UNI-7KQ2M9"
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={ids.joinIdHint}
            className="coc-input coc-input-mono"
          />
          <p id={ids.joinIdHint} className="coc-hint">
            Enter a university's Join ID to list this {ORG_TYPE_LABEL[type].toLowerCase()} under it.
            Leave blank to create it on its own.
          </p>
        </div>
      ) : (
        <p className="coc-note">
          <i className="fi fi-rr-info" aria-hidden="true"></i>
          <span>You'll also get a <strong>Join ID</strong> that departments and programs use to link to your university.</span>
        </p>
      )}

      <label htmlFor={ids.openJoin} className="coc-toggle-row">
        <span className="coc-toggle-text">
          <span className="coc-toggle-title">Open join</span>
          <span className="coc-toggle-desc">Anyone with the join code becomes a member instantly, without officer approval.</span>
        </span>
        <input
          id={ids.openJoin}
          type="checkbox"
          role="switch"
          checked={openJoin}
          onChange={e => setOpenJoin(e.target.checked)}
          className="coc-switch"
        />
      </label>

      <button type="submit" disabled={!canSubmit} className="coc-btn-primary coc-submit">
        {creating ? 'Creating…' : `Create ${ORG_TYPE_LABEL[type].toLowerCase()}`}
      </button>
      <style>{STYLES}</style>
    </form>
  );
}

const STYLES = `
  .coc-card {
    grid-column: 1 / -1;
    display: flex; flex-direction: column; gap: 16px;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px;
    box-shadow: 0 4px 14px rgba(12,68,124,0.06);
  }
  .coc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .coc-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
  .coc-sub { font-size: 12.5px; color: #64748b; margin: 3px 0 0; }
  .coc-close {
    width: 32px; height: 32px; flex-shrink: 0; margin: -4px -6px 0 0;
    display: flex; align-items: center; justify-content: center;
    border: none; border-radius: 8px; background: transparent; color: #64748b; font-size: 18px; cursor: pointer;
  }
  .coc-close i { display: flex; line-height: 1; }
  .coc-close:hover { background: #f1f5f9; color: #0f172a; }
  .coc-close:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }

  .coc-alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

  .coc-field { display: flex; flex-direction: column; gap: 6px; }
  .coc-label { font-size: 12.5px; font-weight: 600; color: #334155; }
  .coc-optional { font-weight: 500; color: #94a3b8; }
  .coc-input {
    height: 42px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    padding: 0 12px; font-size: 14px; color: #0f172a; outline: none;
    background: #f8fafc; font-family: inherit; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .coc-input::placeholder { color: #94a3b8; }
  .coc-input:focus { border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
  .coc-input-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.06em; }
  .coc-hint { font-size: 12px; color: #64748b; margin: 0; line-height: 1.45; }

  .coc-types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .coc-type {
    position: relative; display: flex; align-items: flex-start; gap: 10px;
    padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 12px; background: #fff; cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .coc-type:hover { border-color: #93c5fd; background: #f8fbff; }
  .coc-type.is-selected { border-color: #0C447C; background: #eff6ff; box-shadow: 0 0 0 1px #0C447C inset; }
  .coc-type:has(.coc-type-radio:focus-visible) { box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }
  .coc-type-radio { position: absolute; opacity: 0; pointer-events: none; }
  .coc-type-icon {
    width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: #f1f5f9; color: #475569; font-size: 16px; transition: background 0.15s, color 0.15s;
  }
  .coc-type-icon i { display: flex; line-height: 1; }
  .coc-type.is-selected .coc-type-icon { background: #0C447C; color: #fff; }
  .coc-type-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .coc-type-label { font-size: 13.5px; font-weight: 700; color: #0f172a; }
  .coc-type-desc { font-size: 11.5px; color: #64748b; line-height: 1.4; }

  .coc-note {
    display: flex; align-items: flex-start; gap: 8px; margin: 0;
    padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px dashed #cbd5e1;
    font-size: 12.5px; color: #475569; line-height: 1.45;
  }
  .coc-note i { display: flex; line-height: 1; margin-top: 2px; color: #0C447C; }

  .coc-toggle-row {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer;
  }
  .coc-toggle-text { display: flex; flex-direction: column; gap: 2px; }
  .coc-toggle-title { font-size: 13px; font-weight: 600; color: #0f172a; }
  .coc-toggle-desc { font-size: 12px; color: #64748b; }
  .coc-switch {
    appearance: none; -webkit-appearance: none; flex-shrink: 0; margin: 0;
    width: 40px; height: 22px; border-radius: 999px; background: #cbd5e1; position: relative; cursor: pointer;
    transition: background 0.18s;
  }
  .coc-switch::after {
    content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,0.25); transition: transform 0.18s;
  }
  .coc-switch:checked { background: #0C447C; }
  .coc-switch:checked::after { transform: translateX(18px); }
  .coc-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }

  .coc-btn-primary {
    display: inline-flex; align-items: center; justify-content: center;
    height: 42px; padding: 0 18px; background: #0C447C; color: #fff; border: none; text-decoration: none;
    border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: background 0.15s, opacity 0.15s;
  }
  .coc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .coc-btn-primary:hover:not(:disabled) { background: #0a3867; }
  .coc-btn-primary:focus-visible, .coc-btn-secondary:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.35); }
  .coc-submit { width: 100%; }
  .coc-btn-secondary {
    height: 42px; padding: 0 16px; background: #fff; color: #334155; border: 1px solid #e2e8f0;
    border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .coc-btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
  .coc-btn-link { background: none; border: none; color: #0C447C; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; margin-left: auto; }

  .coc-success-head { display: flex; align-items: center; gap: 12px; }
  .coc-success-icon {
    width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; background: #dcfce7; color: #15803d; font-size: 18px;
  }
  .coc-success-icon i { display: flex; line-height: 1; }
  .coc-codes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .coc-code-block { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border: 1px solid #f1f5f9; border-radius: 12px; background: #fbfcfe; }
  .coc-code-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .coc-code-hint { font-size: 12px; color: #64748b; }
  .coc-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  @media (max-width: 640px) {
    .coc-types { grid-template-columns: 1fr; }
    .coc-btn-link { margin-left: 0; }
  }
`;
