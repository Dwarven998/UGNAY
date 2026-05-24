import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <style>{`
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
          background: #f8fafc;
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
          max-width: 480px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          padding: 3.5rem;
          border-radius: 24px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.05), 0 0 20px rgba(0, 0, 0, 0.02);
        }

        .stagger-1 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; }
        .stagger-2 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; }
        .stagger-3 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards; }
        .stagger-4 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards; }
        .stagger-5 { opacity: 0; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards; }

        .form-header { margin-bottom: 2.5rem; text-align: center; }
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

        .modern-input {
          width: 100%;
          height: 56px;
          padding: 0 16px 0 46px;
          font-size: 1.05rem;
          color: #0f172a;
          background: #ffffff;
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

        .error-card { display: flex; align-items: flex-start; gap: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 16px; color: #b91c1c; font-size: 0.9rem; font-weight: 500; line-height: 1.5; }
        .error-card svg { flex-shrink: 0; margin-top: 2px; }

        .modern-btn { height: 56px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 14px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: none; }
        .btn-primary { background: #0C447C; color: #ffffff; box-shadow: 0 4px 14px rgba(12, 68, 124, 0.25); margin-top: 0.5rem; }
        .btn-primary:hover:not(:disabled) { background: #0a3867; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(12, 68, 124, 0.35); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 8px rgba(12, 68, 124, 0.25); }
        .btn-primary:disabled { background: #94a3b8; box-shadow: none; cursor: not-allowed; opacity: 0.8; }

        .spinner { animation: spin 0.8s linear infinite; }

        .modern-divider { display: flex; align-items: center; gap: 16px; margin: 2rem 0; }
        .modern-divider .line { flex: 1; height: 1px; background: #e2e8f0; }
        .modern-divider span { font-size: 0.875rem; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

        .btn-social { background: #ffffff; border: 2px solid #e2e8f0; color: #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .btn-social:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.04); }

        .register-prompt { text-align: center; margin-top: 2.5rem; font-size: 1rem; color: #64748b; }
        .register-link { color: #2563eb; font-weight: 600; text-decoration: none; transition: color 0.2s; }
        .register-link:hover { color: #1d4ed8; text-decoration: underline; }

        @keyframes float { 0% { transform: translate(0, 0) rotate(0deg); } 33% { transform: translate(30px, -50px) rotate(120deg); } 66% { transform: translate(-20px, 20px) rotate(240deg); } 100% { transform: translate(0, 0) rotate(360deg); } }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); } 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) { .left-panel { width: 40%; padding: 1.5rem; } .form-container { padding: 2.5rem; } .hero-title { font-size: 1.8rem; } }
        @media (max-width: 768px) { .left-panel { display: none; } .right-panel { padding: 1.5rem; } .form-container { padding: 2rem; max-width: 100%; } }
      `}</style>
    </>
  );
}