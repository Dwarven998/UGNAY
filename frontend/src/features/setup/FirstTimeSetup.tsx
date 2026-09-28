import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../api/axiosClient';
import { useAuth } from '../../context/useAuth';
import { useOrganization } from '../../context/useOrganization';
import type { OrgType } from '../../types';
import { organizationAdminApi, organizationApi } from '../organizations/api/organizationApi';
import { useFacebookConnection } from '../posts/hooks/useFacebookConnection';
import { markSetupDone, SETUP_FACEBOOK_RETURN_KEY } from './setupStatus';
import '../../components/ui/dialog.css';
import './setup.css';

type Step = 'workspace' | 'facebook' | 'done';
type WorkspaceMode = 'choose' | 'create' | 'join';

const STEP_ORDER: Step[] = ['workspace', 'facebook', 'done'];
const STEP_LABEL: Record<Step, string> = { workspace: 'Workspace', facebook: 'Facebook Page', done: 'Ready' };

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);

/**
 * Short first-run flow for a new account: pick a workspace, connect a Facebook Page, then go straight to the
 * post composer. Every step can be skipped — the app works in the personal workspace without either.
 */
export default function FirstTimeSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { activeOrg, activeOrgId, setActiveOrgId, refreshMemberships } = useOrganization();
  const facebook = useFacebookConnection();

  const facebookParam = searchParams.get('facebook');
  const [step, setStep] = useState<Step>(() => {
    if (facebookParam === 'connected') return 'done';
    if (facebookParam === 'failed') return 'facebook';
    return 'workspace';
  });
  const [mode, setMode] = useState<WorkspaceMode>('choose');
  const [error, setError] = useState(facebookParam === 'failed' ? (searchParams.get('message') || 'Facebook connection failed.') : '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('UNIVERSITY');
  const [parentOrgId, setParentOrgId] = useState('');
  const [openJoin, setOpenJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const canModerate = activeOrg?.role === 'ADMIN' || activeOrg?.role === 'OFFICER';
  const canManageFacebook = !activeOrgId || canModerate;
  const workspaceName = activeOrg?.orgName ?? user?.orgName ?? 'Personal Workspace';

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step, mode]);

  // The OAuth round-trip lands here with ?facebook=…; drop the query so a refresh doesn't replay it.
  useEffect(() => {
    if (facebookParam) {
      void facebook.refresh();
      navigate('/setup', { replace: true });
    }
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (next: Step) => {
    setError('');
    setStep(next);
  };

  const finish = (destination: string) => {
    if (user) markSetupDone(user.userId);
    navigate(destination, { replace: true });
  };

  const createOrganization = async () => {
    if (!orgName.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const org = await organizationAdminApi.create(orgName.trim(), orgType, parentOrgId.trim() || null, openJoin);
      await refreshMemberships();
      setActiveOrgId(org.id);
      setInfo(`${org.name} is ready. Share join code ${org.joinCode} with your team.`);
      goTo('facebook');
    } catch (err) {
      setError(errorText(err, 'Could not create the organization.'));
    } finally {
      setBusy(false);
    }
  };

  const joinOrganization = async () => {
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const membership = await organizationApi.joinByCode(joinCode.trim().toUpperCase());
      await refreshMemberships();
      if (membership.status === 'APPROVED') {
        setActiveOrgId(membership.orgId);
        setInfo(`You joined ${membership.orgName}.`);
      } else {
        setInfo(`Your request to join ${membership.orgName} was sent. You can keep working in your personal workspace until an officer approves it.`);
      }
      goTo('facebook');
    } catch (err) {
      setError(errorText(err, 'Could not join with that code.'));
    } finally {
      setBusy(false);
    }
  };

  const connectFacebook = async () => {
    setError('');
    try {
      sessionStorage.setItem(SETUP_FACEBOOK_RETURN_KEY, '1');
    } catch {
      // Without storage the callback simply lands in Post Manager.
    }
    try {
      await facebook.connect();
    } catch (err) {
      sessionStorage.removeItem(SETUP_FACEBOOK_RETURN_KEY);
      setError(errorText(err, 'Could not start the Facebook connection.'));
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="su-page">
      <header className="su-top">
        <div className="su-brand">
          <img src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
          <span>Ugnay</span>
        </div>
        <button type="button" className="su-signout" onClick={logout}>Sign out</button>
      </header>

      <main className="su-main">
        <ol className="su-progress" aria-label="Setup progress">
          {STEP_ORDER.map((item, index) => (
            <li
              key={item}
              className={`su-progress-item${index < stepIndex ? ' is-done' : ''}${index === stepIndex ? ' is-current' : ''}`}
              aria-current={index === stepIndex ? 'step' : undefined}
            >
              <span className="su-progress-dot" aria-hidden="true">{index < stepIndex ? '✓' : index + 1}</span>
              <span className="su-progress-label">{STEP_LABEL[item]}</span>
            </li>
          ))}
        </ol>

        <section className="su-card" aria-labelledby="su-title">
          {error && <div className="su-alert su-alert-error" role="alert">{error}</div>}
          {info && step !== 'workspace' && <div className="su-alert su-alert-info" role="status">{info}</div>}

          {step === 'workspace' && mode === 'choose' && (
            <>
              <h1 id="su-title" ref={headingRef} tabIndex={-1} className="su-title">Welcome to Ugnay</h1>
              <p className="su-lead">What would you like to do?</p>
              <div className="su-choices">
                <button type="button" className="su-choice" onClick={() => { setMode('create'); setError(''); }}>
                  <span className="su-choice-icon" aria-hidden="true">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                  <span className="su-choice-text">
                    <span className="su-choice-title">Create an Organization</span>
                    <span className="su-choice-desc">Set up a workspace for your university, department or program.</span>
                  </span>
                </button>
                <button type="button" className="su-choice" onClick={() => { setMode('join'); setError(''); }}>
                  <span className="su-choice-icon" aria-hidden="true">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </span>
                  <span className="su-choice-text">
                    <span className="su-choice-title">Join an Organization</span>
                    <span className="su-choice-desc">Use the join code an officer or admin shared with you.</span>
                  </span>
                </button>
              </div>
              <div className="su-skip">
                <button type="button" className="su-link" onClick={() => goTo('facebook')}>
                  Skip — use my personal workspace
                </button>
              </div>
            </>
          )}

          {step === 'workspace' && mode === 'create' && (
            <form onSubmit={e => { e.preventDefault(); void createOrganization(); }} noValidate>
              <h1 id="su-title" ref={headingRef} tabIndex={-1} className="su-title">Create an Organization</h1>
              <p className="su-lead">You’ll be its admin and can invite your team with a join code.</p>
              <div className="su-fields">
                <div className="su-field">
                  <label htmlFor="su-org-name">Organization name</label>
                  <input id="su-org-name" type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. College of Engineering" required autoComplete="organization" />
                </div>
                <div className="su-field">
                  <label htmlFor="su-org-type">Type</label>
                  <select id="su-org-type" value={orgType} onChange={e => setOrgType(e.target.value as OrgType)}>
                    <option value="UNIVERSITY">University (top-level)</option>
                    <option value="DEPARTMENT">Department</option>
                    <option value="PROGRAM">Program</option>
                  </select>
                </div>
                {orgType !== 'UNIVERSITY' && (
                  <div className="su-field">
                    <label htmlFor="su-org-parent">Parent organization ID</label>
                    <input id="su-org-parent" type="text" value={parentOrgId} onChange={e => setParentOrgId(e.target.value)} aria-describedby="su-org-parent-hint" />
                    <p id="su-org-parent-hint" className="su-hint">You must be an admin of the parent organization.</p>
                  </div>
                )}
                <label className="su-check">
                  <input type="checkbox" checked={openJoin} onChange={e => setOpenJoin(e.target.checked)} />
                  <span>Open join (skip officer approval)</span>
                </label>
              </div>
              <div className="su-actions">
                <button type="button" className="ug-btn ug-btn-secondary" onClick={() => { setMode('choose'); setError(''); }} disabled={busy}>Back</button>
                <button type="submit" className="ug-btn ug-btn-primary" disabled={!orgName.trim() || busy}>
                  {busy && <span className="ug-spinner" aria-hidden="true" />}
                  {busy ? 'Creating…' : 'Create Organization'}
                </button>
              </div>
            </form>
          )}

          {step === 'workspace' && mode === 'join' && (
            <form onSubmit={e => { e.preventDefault(); void joinOrganization(); }} noValidate>
              <h1 id="su-title" ref={headingRef} tabIndex={-1} className="su-title">Join an Organization</h1>
              <p className="su-lead">Enter the join code you received.</p>
              <div className="su-fields">
                <div className="su-field">
                  <label htmlFor="su-join-code">Join code</label>
                  <input
                    id="su-join-code"
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="e.g. AB12CD"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="su-code"
                    required
                  />
                </div>
              </div>
              <div className="su-actions">
                <button type="button" className="ug-btn ug-btn-secondary" onClick={() => { setMode('choose'); setError(''); }} disabled={busy}>Back</button>
                <button type="submit" className="ug-btn ug-btn-primary" disabled={!joinCode.trim() || busy}>
                  {busy && <span className="ug-spinner" aria-hidden="true" />}
                  {busy ? 'Joining…' : 'Join Organization'}
                </button>
              </div>
            </form>
          )}

          {step === 'facebook' && (
            <>
              <div className="su-fb-icon" aria-hidden="true">
                <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <h1 id="su-title" ref={headingRef} tabIndex={-1} className="su-title">Connect your Facebook Page</h1>
              {facebook.connected ? (
                <>
                  <p className="su-lead"><strong>{facebook.pageName ?? 'Your Page'}</strong> is already connected to {workspaceName}.</p>
                  <div className="su-actions su-actions-center">
                    <button type="button" className="ug-btn ug-btn-primary ug-btn-lg" onClick={() => goTo('done')}>Continue</button>
                  </div>
                </>
              ) : canManageFacebook ? (
                <>
                  <p className="su-lead">Connect a Page to start publishing {activeOrg ? `${workspaceName}’s` : 'your'} content.</p>
                  <div className="su-actions su-actions-stack">
                    <button type="button" className="su-fb-btn" onClick={() => void connectFacebook()} disabled={facebook.isBusy}>
                      {facebook.isBusy && <span className="ug-spinner" aria-hidden="true" />}
                      Connect Facebook
                    </button>
                    <button type="button" className="ug-btn ug-btn-ghost" onClick={() => goTo('done')}>Skip for now</button>
                  </div>
                  <p className="su-hint su-center">You’ll be taken to Facebook and brought back here.</p>
                </>
              ) : (
                <>
                  <p className="su-lead">
                    Only officers and admins can connect {workspaceName}’s Page. You can still write drafts until they do.
                  </p>
                  <div className="su-actions su-actions-center">
                    <button type="button" className="ug-btn ug-btn-primary ug-btn-lg" onClick={() => goTo('done')}>Continue</button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 'done' && (
            <div className="su-done">
              <div className="su-done-icon" aria-hidden="true">
                <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 id="su-title" ref={headingRef} tabIndex={-1} className="su-title">You’re ready!</h1>
              <p className="su-lead">Your workspace is ready for your first post.</p>
              <dl className="su-summary">
                <div><dt>Workspace</dt><dd>{workspaceName}</dd></div>
                <div><dt>Facebook Page</dt><dd>{facebook.connected ? (facebook.pageName ?? 'Connected') : 'Not connected yet'}</dd></div>
              </dl>
              <div className="su-actions su-actions-stack">
                <button type="button" className="ug-btn ug-btn-primary ug-btn-lg" onClick={() => finish('/create')}>
                  Create Your First Post
                </button>
                <button type="button" className="ug-btn ug-btn-ghost" onClick={() => finish('/')}>Go to Dashboard</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
