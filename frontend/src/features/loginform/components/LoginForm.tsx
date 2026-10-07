import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { ApiError } from '../../../api/axiosClient';
import { preloadGoogleIdentity, requestGoogleAccessToken } from '../api/googleIdentity';
import { FloatingParticles, FeatureShowcase, AuthenticationBackground } from './AuthVisuals';
import { useTurnstile } from '../hooks/useTurnstile';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Set when Google sign-in found no account for this email: we ask for an organization name before creating it.
  const [googleSignup, setGoogleSignup] = useState<{ accessToken: string; email: string } | null>(null);
  const [orgName, setOrgName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const { token: turnstileToken, isVerified: turnstileVerified, reset: resetTurnstile, containerRef: turnstileRef } = useTurnstile();

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    preloadGoogleIdentity();
  }, []);

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const accessToken = await requestGoogleAccessToken();
      const result = await loginWithGoogle(accessToken);
      if (result.needsOrgName) {
        setOrgName('');
        setGoogleSignup({ accessToken, email: result.email });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!googleSignup) return;
    setError('');
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle(googleSignup.accessToken, orgName.trim());
      navigate(result.newAccount ? '/setup' : '/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // The Google token expired while the form was open; send them through Google again.
        setGoogleSignup(null);
        setError('Your Google session expired. Please continue with Google again.');
      } else {
        setError(err instanceof Error && err.message ? err.message : 'Could not create your account. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Guard: Turnstile token must be present before allowing submission
    if (!turnstileVerified || !turnstileToken) {
      setError('Please complete the security verification before signing in.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password, turnstileToken);
      navigate('/');
    } catch (err: any) {
      // Always reset after a failed attempt — tokens are single-use
      resetTurnstile();

      const status = err.status || err.response?.status;
      const message = err.message || err.data?.message;

      if (status === 429) {
        setError('Too many login attempts from your IP. Please wait 1 minute before trying again.');
      } else if (status === 423) {
        setError('Account locked due to 5 consecutive failed attempts. Please try again in 15 minutes.');
      } else if (status === 401) {
        setError(message || 'Invalid email or password.');
      } else if (status === 400 && (message?.toLowerCase().includes('security') || message?.toLowerCase().includes('turnstile'))) {
        setError('Security verification failed. Please complete the verification again.');
      } else {
        setError(message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Prevent submit while Turnstile has not yet resolved
  const isSubmitDisabled = loading || !turnstileVerified;

  return (
    <>
      <div className="login-layout">
        
        {/* ── LEFT PANEL ───────────────────────── */}
        <div className="left-panel">
          <div className="logo-section">
            <div className="logo-icon">
              <img className="brand-mark" src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
            </div>
            <span className="logo-text">Ugnay</span>
          </div>

          {/* Animated Background Mesh/Glows */}
          <div className="glow-orb orb-1"></div>
          <div className="glow-orb orb-2"></div>
          <div className="glow-orb orb-3"></div>
          <div className="noise-overlay"></div>
          <FloatingParticles />

          {/* Content Glass Card */}
          <div className="glass-card">
            {/* Tagline + features */}
            <div className="hero-content">
              <div className="ai-badge">
                <span className="pulse-dot"></span>
                AI-powered workspace
              </div>

              <h2 className="hero-title">
                Your organization's<br /><span className="hero-accent">social media,</span><br />on autopilot.
              </h2>
              <p className="hero-subtitle">
                Generate intelligent captions, automate your Facebook scheduling, and unlock engagement insights from one unified dashboard.
              </p>

              <FeatureShowcase />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────── */}
        <div className="right-panel">
          {/* Ambient Right Background Effects */}
          <AuthenticationBackground />

          <div className="form-container">
            <div className="auth-card-brand">
              <img src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
              <span>Ugnay</span>
            </div>
            {googleSignup && (
              <>
                <div className="form-header stagger-1">
                  <h1 className="form-title">One last step</h1>
                  <p className="form-subtitle">
                    Name your organization to finish creating your account for <strong>{googleSignup.email}</strong>
                  </p>
                </div>

                <form onSubmit={handleGoogleSignup} className="auth-form stagger-2">
                  <div className="input-group">
                    <label htmlFor="google-org-name">Organization Name</label>
                    <div className="input-wrapper">
                      <div className="input-icon">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <input
                        id="google-org-name"
                        type="text"
                        placeholder="e.g. Computer Science Society"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        required
                        autoFocus
                        className="modern-input"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="error-card">
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={googleLoading || !orgName.trim()} className="btn-primary modern-btn">
                    {googleLoading ? (
                      <>
                        <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                          <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating account...
                      </>
                    ) : (
                      <>
                        Continue
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                <p className="register-prompt stagger-3">
                  Not you?{' '}
                  <button
                    type="button"
                    className="register-link link-button"
                    onClick={() => { setGoogleSignup(null); setError(''); }}
                  >
                    Back to sign in
                  </button>
                </p>
              </>
            )}

            {/* Hidden rather than unmounted during the Google step: the Turnstile widget only renders once per mount. */}
            <div hidden={googleSignup !== null}>
            <div className="form-header stagger-1">
              <h1 className="form-title">Welcome back</h1>
              <p className="form-subtitle">Sign in to your organization account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form stagger-2">
              
              {/* Email */}
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="modern-input"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="input-group">
                <div className="password-header">
                  <label>Password</label>
                  <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                </div>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="modern-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="toggle-password"
                  >
                    {showPassword ? (
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="error-card">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Cloudflare Turnstile Widget */}
              <div className="turnstile-wrapper">
                <div ref={turnstileRef} id="turnstile-login" />
                {!turnstileVerified && (
                  <p className="turnstile-hint">Complete the security check above to enable sign in.</p>
                )}
              </div>

              {/* Submit */}
              <button type="submit" disabled={isSubmitDisabled} className="btn-primary modern-btn">
                {loading ? (
                  <>
                    <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                      <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="modern-divider stagger-3">
              <div className="line"></div>
              <span>Or continue with</span>
              <div className="line"></div>
            </div>

            {/* Google SSO */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="btn-social modern-btn stagger-4"
            >
              {googleLoading ? (
                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3" />
                  <path fill="#4285F4" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 01-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0012 24z" />
                  <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 010-4.56V6.61H1.27a12 12 0 000 10.78l4.01-3.11z" />
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 001.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z" />
                </svg>
              )}
              Google
            </button>

            {/* Register link */}
            <p className="register-prompt stagger-5">
              Don't have an account?{' '}
              <Link to="/register" className="register-link">Create one now</Link>
            </p>
            </div>
          </div>
        </div>
      </div>
      <style>{`...styles (kept identical to original for visual parity)...`}</style>
    </>
  );
}

export default function LoginForm() {
  return <LoginFormContent />;
}