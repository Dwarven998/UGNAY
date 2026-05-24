import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/posts');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-layout">
        
        {/* ── LEFT PANEL ───────────────────────── */}
        <div className="left-panel">
          {/* Logo - Moved to absolute top left */}
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <span className="logo-text">UGNAY</span>
          </div>

          {/* Animated Background Mesh/Glows */}
          <div className="glow-orb orb-1"></div>
          <div className="glow-orb orb-2"></div>
          <div className="glow-orb orb-3"></div>
          <div className="noise-overlay"></div>

          {/* Content Glass Card */}
          <div className="glass-card">
            {/* Tagline + features */}
            <div className="hero-content">
              <div className="ai-badge">
                <span className="pulse-dot"></span>
                AI-powered workspace
              </div>

              <h2 className="hero-title">
                Your organization's social media,<br />on autopilot.
              </h2>
              <p className="hero-subtitle">
                Generate intelligent captions, automate your Facebook scheduling, and unlock engagement insights from one unified dashboard.
              </p>

              <div className="feature-list">
                {[
                  'AI caption generation from photos',
                  'Automated Facebook scheduling',
                  'Engagement insights and analytics',
                ].map((label, index) => (
                  <div key={label} className="feature-item" style={{ animationDelay: `${index * 0.15}s` }}>
                    <div className="feature-check">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────── */}
        <div className="right-panel">
          {/* Ambient Right Background Effects */}
          <div className="right-bg-pattern"></div>
          <div className="right-glow-orb right-orb-1"></div>
          <div className="right-glow-orb right-orb-2"></div>

          <div className="form-container">
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

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-primary modern-btn">
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

            {/* Facebook SSO */}
            <button type="button" className="btn-social modern-btn stagger-4">
              <svg width="20" height="20" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>

            {/* Register link */}
            <p className="register-prompt stagger-5">
              Don't have an account?{' '}
              <Link to="/register" className="register-link">Create one now</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        /* Core Reset & Animations */
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }

        .login-layout {
          position: fixed;
          inset: 0;
          display: flex;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #ffffff;
          color: #0f172a;
        }

        /* ── LEFT PANEL (Glassmorphism & Gradients) ── */
        .left-panel {
          width: 45%;
          position: relative;
          background: #020617;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        /* Animated Glowing Orbs */
        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          animation: float 10s ease-in-out infinite;
        }
        .orb-1 { width: 400px; height: 400px; background: #0C447C; top: -10%; left: -10%; animation-delay: 0s; }
        .orb-2 { width: 350px; height: 350px; background: #3b82f6; bottom: -10%; right: -10%; animation-delay: -3s; opacity: 0.4; }
        .orb-3 { width: 300px; height: 300px; background: #1e3a8a; top: 40%; left: 40%; animation-delay: -6s; opacity: 0.5; }

        .noise-overlay {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        /* Frosted Glass Card */
        .glass-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 520px;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 3rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .logo-section { 
          position: absolute;
          top: 2.5rem;
          left: 2.5rem;
          z-index: 20;
          display: flex; 
          align-items: center; 
          gap: 12px; 
        }
        .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
        .logo-text { color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 0.05em; }

        .ai-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 30px; color: #e2e8f0; font-size: 13px; font-weight: 500; margin-bottom: 1.5rem; }
        .pulse-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite; }

        .hero-title { color: #ffffff; font-size: 2.25rem; font-weight: 600; line-height: 1.2; margin: 0 0 1.25rem; letter-spacing: -0.03em; }
        .hero-subtitle { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin: 0 0 2.5rem; max-width: 95%; }

        .feature-list { display: flex; flex-direction: column; gap: 1rem; }
        .feature-item { display: flex; align-items: center; gap: 16px; opacity: 0; animation: slideUpFade 0.5s forwards ease-out; }
        .feature-check { width: 28px; height: 28px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #60a5fa; flex-shrink: 0; }
        .feature-item span { color: #cbd5e1; font-size: 15px; font-weight: 400; }

        /* ── RIGHT PANEL (Spacious Form & Light Effects) ── */
        .right-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: #f8fafc; /* Changed to slate-50 for depth */
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Ambient effects */
        .right-bg-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
          background-size: 32px 32px;
          opacity: 0.35;
          pointer-events: none;
        }
        .right-glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.6;
          pointer-events: none;
          animation: float 12s ease-in-out infinite;
        }
        .right-orb-1 { width: 450px; height: 450px; background: rgba(59, 130, 246, 0.08); top: -10%; right: -10%; }
        .right-orb-2 { width: 500px; height: 500px; background: rgba(14, 165, 233, 0.06); bottom: -20%; left: -10%; animation-delay: -5s; }

        .form-container { 
          position: relative;
          z-index: 10;
          width: 100%; 
          max-width: 480px; /* Widened */
          background: rgba(255, 255, 255, 0.85); /* Added glassmorphism */
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          padding: 3.5rem;
          border-radius: 24px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.05), 0 0 20px rgba(0, 0, 0, 0.02);
        }

        /* Staggered form animations */
        .stagger-1 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; }
        .stagger-2 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; }
        .stagger-3 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards; }
        .stagger-4 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards; }
        .stagger-5 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards; }

        .form-header { margin-bottom: 2.5rem; text-align: center; } /* Centered header for balance */
        .form-title { font-size: 2.2rem; font-weight: 700; color: #0f172a; margin: 0 0 8px; letter-spacing: -0.04em; }
        .form-subtitle { font-size: 1.05rem; color: #64748b; margin: 0; }

        .auth-form { display: flex; flex-direction: column; gap: 1.5rem; }
        
        .input-group label { display: block; font-size: 0.9rem; font-weight: 600; color: #334155; margin-bottom: 8px; }
        .password-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .password-header label { margin-bottom: 0; }
        .forgot-link { font-size: 0.875rem; color: #2563eb; text-decoration: none; font-weight: 600; transition: color 0.2s; }
        .forgot-link:hover { color: #1d4ed8; }

        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 16px; color: #94a3b8; pointer-events: none; display: flex; }
        
        /* Modern Inputs - Taller */
        .modern-input {
          width: 100%;
          height: 56px; /* Increased height */
          padding: 0 16px 0 46px;
          font-size: 1.05rem;
          color: #0f172a;
          background: #ffffff; /* Contrast against glass card */
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .modern-input::placeholder { color: #94a3b8; }
        .modern-input:hover { border-color: #cbd5e1; }
        .modern-input:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15), inset 0 2px 4px rgba(0,0,0,0.02);
        }

        .toggle-password {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          color: #94a3b8;
          display: flex;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .toggle-password:hover { color: #475569; background: #f1f5f9; }

        /* Error Card */
        .error-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 14px 16px;
          color: #b91c1c;
          font-size: 0.9rem;
          font-weight: 500;
          line-height: 1.5;
        }
        .error-card svg { flex-shrink: 0; margin-top: 2px; }

        /* Modern Buttons */
        .modern-btn {
          height: 56px; /* Taller */
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 14px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
        }
        
        .btn-primary {
          background: #0C447C;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(12, 68, 124, 0.25);
          margin-top: 0.5rem;
        }
        .btn-primary:hover:not(:disabled) {
          background: #0a3867;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(12, 68, 124, 0.35);
        }
        .btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 8px rgba(12, 68, 124, 0.25); }
        .btn-primary:disabled { background: #94a3b8; box-shadow: none; cursor: not-allowed; opacity: 0.8; }

        .spinner { animation: spin 0.8s linear infinite; }

        /* Dividers */
        .modern-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 2rem 0;
        }
        .modern-divider .line { flex: 1; height: 1px; background: #e2e8f0; }
        .modern-divider span { font-size: 0.875rem; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

        /* Social Button */
        .btn-social {
          background: #ffffff;
          border: 2px solid #e2e8f0;
          color: #334155;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .btn-social:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.04);
        }

        .register-prompt { text-align: center; margin-top: 2.5rem; font-size: 1rem; color: #64748b; }
        .register-link { color: #2563eb; font-weight: 600; text-decoration: none; transition: color 0.2s; }
        .register-link:hover { color: #1d4ed8; text-decoration: underline; }

        /* Responsive */
        @media (max-width: 1024px) {
          .left-panel { width: 40%; padding: 1.5rem; }
          .form-container { padding: 2.5rem; }
          .hero-title { font-size: 1.8rem; }
        }
        @media (max-width: 768px) {
          .left-panel { display: none; }
          .right-panel { padding: 1.5rem; }
          .form-container { padding: 2rem; max-width: 100%; }
        }
      `}</style>
    </>
  );
}

export default function LoginForm() {
  return <LoginFormContent />;
}