import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../../../api/axiosClient';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Missing token — show immediately, no need to hit the API
  const missingToken = !token;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await axiosClient.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: any) {
      const status = err.status || err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (status === 400 && message) {
        setError(message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-layout">

        {/* ── LEFT PANEL ── */}
        <div className="left-panel">
          <div className="logo-section">
            <div className="logo-icon">
              <img className="brand-mark" src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
            </div>
            <span className="logo-text">Ugnay</span>
          </div>
          <div className="glow-orb orb-1" />
          <div className="glow-orb orb-2" />
          <div className="glow-orb orb-3" />
          <div className="noise-overlay" />
          <div className="glass-card">
            <div className="hero-content">
              <div className="ai-badge">
                <span className="pulse-dot" />
                Account Recovery
              </div>
              <h2 className="hero-title">
                Create a<br /><span className="hero-accent">new password</span>
              </h2>
              <p className="hero-subtitle">
                Choose a strong password. It must be at least 6 characters long.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="right-panel">
          <div className="form-container">
            <div className="auth-card-brand">
              <img src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
              <span>Ugnay</span>
            </div>

            {missingToken ? (
              <div className="rp-state stagger-1">
                <div className="rp-state-icon error-icon" aria-hidden="true">
                  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 className="form-title">Invalid Link</h1>
                <p className="form-subtitle">This password reset link is missing or invalid. Please request a new one.</p>
                <Link to="/forgot-password" className="btn-primary modern-btn rp-action-btn">Request a New Link</Link>
              </div>
            ) : success ? (
              <div className="rp-state stagger-1">
                <div className="rp-state-icon success-icon" aria-hidden="true">
                  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="form-title">Password Reset!</h1>
                <p className="form-subtitle">Your password has been updated. You can now sign in with your new password.</p>
                <Link to="/login" className="btn-primary modern-btn rp-action-btn">Sign In</Link>
              </div>
            ) : (
              <>
                <div className="form-header stagger-1">
                  <h1 className="form-title">New password</h1>
                  <p className="form-subtitle">Enter and confirm your new password below</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form stagger-2">
                  {/* New password */}
                  <div className="input-group">
                    <label htmlFor="rp-new">New Password</label>
                    <div className="input-wrapper">
                      <div className="input-icon">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="rp-new"
                        type={showNew ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="modern-input"
                        autoFocus
                      />
                      <button type="button" className="show-password-btn" onClick={() => setShowNew(v => !v)} aria-label={showNew ? 'Hide password' : 'Show password'}>
                        {showNew
                          ? <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div className="input-group">
                    <label htmlFor="rp-confirm">Confirm New Password</label>
                    <div className="input-wrapper">
                      <div className="input-icon">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <input
                        id="rp-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        className="modern-input"
                      />
                      <button type="button" className="show-password-btn" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                        {showConfirm
                          ? <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
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

                  <button type="submit" disabled={loading} className="btn-primary modern-btn">
                    {loading ? (
                      <>
                        <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                          <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Resetting...
                      </>
                    ) : 'Reset Password'}
                  </button>
                </form>

                <p className="register-prompt stagger-3">
                  <Link to="/login" className="register-link">← Back to Sign In</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .login-layout { position: fixed; inset: 0; display: flex; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #ffffff; color: #0f172a; }
        .left-panel { width: 45%; position: relative; background: #020617; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 2rem; }
        .glow-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6; animation: float 10s ease-in-out infinite; }
        .orb-1 { width: 400px; height: 400px; background: #0C447C; top: -10%; left: -10%; animation-delay: 0s; }
        .orb-2 { width: 350px; height: 350px; background: #3b82f6; bottom: -10%; right: -10%; animation-delay: -3s; opacity: 0.4; }
        .orb-3 { width: 300px; height: 300px; background: #1e3a8a; top: 40%; left: 40%; animation-delay: -6s; opacity: 0.5; }
        .noise-overlay { position: absolute; inset: 0; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
        .glass-card { position: relative; z-index: 10; width: 100%; max-width: 520px; background: rgba(255,255,255,0.03); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 3rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); animation: slideUpFade 0.8s cubic-bezier(0.16,1,0.3,1); }
        .logo-section {
          position: relative;
          top: auto;
          left: auto;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: clamp(8px, 1vw, 12px);
          width: fit-content;
          max-width: min(100%, 20rem);
          margin: 0 0 1.5rem;
        }
        .logo-icon {
          width: clamp(32px, 2.1vw, 44px);
          height: clamp(32px, 2.1vw, 44px);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .brand-mark { width: 100%; height: 100%; object-fit: contain; }
        .logo-text { color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 0.05em; }
        .ai-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); padding: 8px 16px; border-radius: 30px; color: #e2e8f0; font-size: 13px; font-weight: 500; margin-bottom: 1.5rem; }
        .pulse-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite; }
        .hero-title { color: #ffffff; font-size: 2.25rem; font-weight: 600; line-height: 1.2; margin: 0 0 1.25rem; letter-spacing: -0.03em; }
        .hero-accent { background: linear-gradient(135deg, #60a5fa, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-subtitle { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin: 0; }
        .right-panel { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; background: #f8fafc; position: relative; overflow-y: auto; }
        .form-container { position: relative; z-index: 10; width: 100%; max-width: 480px; background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.6); padding: 3.5rem; border-radius: 24px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.05); }
        .auth-card-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 2rem; }
        .auth-card-brand img { width: 32px; height: 32px; object-fit: contain; }
        .auth-card-brand span { font-size: 18px; font-weight: 700; color: #0f172a; }
        .stagger-1 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s forwards; }
        .stagger-2 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s forwards; }
        .stagger-3 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s forwards; }
        .form-header { margin-bottom: 2.5rem; text-align: center; }
        .form-title { font-size: 2rem; font-weight: 700; color: #0f172a; margin: 0 0 8px; letter-spacing: -0.04em; }
        .form-subtitle { font-size: 1.05rem; color: #64748b; margin: 0; }
        .auth-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .input-group label { display: block; font-size: 0.9rem; font-weight: 600; color: #334155; margin-bottom: 8px; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 16px; color: #94a3b8; pointer-events: none; display: flex; }
        .modern-input { width: 100%; height: 56px; padding: 0 48px 0 46px; font-size: 1.05rem; color: #0f172a; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 14px; outline: none; transition: all 0.2s ease; box-sizing: border-box; }
        .modern-input::placeholder { color: #94a3b8; }
        .modern-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.15); }
        .show-password-btn { position: absolute; right: 14px; background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; padding: 4px; transition: color 0.2s; }
        .show-password-btn:hover { color: #475569; }
        .error-card { display: flex; align-items: flex-start; gap: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 16px; color: #b91c1c; font-size: 0.9rem; font-weight: 500; line-height: 1.5; }
        .error-card svg { flex-shrink: 0; margin-top: 2px; }
        .modern-btn { height: 56px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 14px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); border: none; text-decoration: none; }
        .btn-primary { background: #0C447C; color: #ffffff; box-shadow: 0 4px 14px rgba(12,68,124,0.25); margin-top: 0.5rem; }
        .btn-primary:hover:not(:disabled) { background: #0a3867; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(12,68,124,0.35); }
        .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
        .spinner { animation: spin 0.8s linear infinite; }
        .register-prompt { text-align: center; margin-top: 2rem; font-size: 1rem; color: #64748b; }
        .register-link { color: #2563eb; font-weight: 600; text-decoration: none; transition: color 0.2s; }
        .register-link:hover { color: #1d4ed8; text-decoration: underline; }
        /* State screens (success/error) */
        .rp-state { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .rp-state-icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .success-icon { background: #f0fdf4; border: 2px solid #bbf7d0; }
        .error-icon { background: #fef2f2; border: 2px solid #fecaca; }
        .rp-action-btn { margin-top: 1rem; }
        @keyframes float { 0% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(30px,-50px) rotate(120deg); } 66% { transform: translate(-20px,20px) rotate(240deg); } 100% { transform: translate(0,0) rotate(360deg); } }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); } 70% { box-shadow: 0 0 0 6px rgba(74,222,128,0); } 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) { .left-panel { width: 40%; } }
        @media (max-width: 768px) { .left-panel { display: none; } .right-panel { padding: 1.5rem; } .form-container { padding: 2rem; max-width: 100%; } }
      `}</style>
    </>
  );
}
