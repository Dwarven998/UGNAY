// pages/Dashboard.tsx
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/posts',     icon: '📅', label: 'Post Manager'       },
  { to: '/caption',  icon: '✨', label: 'Caption Studio'      },
  { to: '/media',    icon: '🗂️', label: 'Media Repository'   },
  { to: '/analytics',icon: '📊', label: 'Analytics'          },
  { to: '/settings', icon: '⚙️', label: 'Settings'          }
];

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <>
      <div className="dash-layout">
        {/* ── SIDEBAR ── */}
        <aside className="dash-sidebar">
          {/* Ambient glow orbs */}
          <div className="sidebar-orb sidebar-orb-1"></div>
          <div className="sidebar-orb sidebar-orb-2"></div>

          {/* Logo */}
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <span className="sidebar-logo-text">UGNAY</span>
          </div>

          {/* Org badge */}
          <div className="sidebar-org">
            <div className="sidebar-org-avatar">
              {user?.orgName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-org-info">
              <span className="sidebar-org-name">{user?.orgName}</span>
              <span className="sidebar-org-role">Organization</span>
            </div>
          </div>

          {/* Divider */}
          <div className="sidebar-divider"></div>

          {/* Nav */}
          <nav className="sidebar-nav">
            <span className="sidebar-nav-label">MENU</span>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }: { isActive: boolean }) =>
                  `sidebar-nav-item ${isActive ? 'sidebar-nav-active' : ''}`
                }
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-text">{item.label}</span>
                {/* Active indicator bar */}
              </NavLink>
            ))}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }}></div>

          {/* Divider */}
          <div className="sidebar-divider"></div>

          {/* Sign Out */}
          <button onClick={logout} className="sidebar-signout">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="dash-main">
          {/* Subtle background pattern */}
          <div className="dash-main-pattern"></div>
          <div className="dash-main-orb dash-main-orb-1"></div>
          <div className="dash-main-orb dash-main-orb-2"></div>
          <div className="dash-main-content">
            <Outlet />
          </div>
        </main>
      </div>

      <style>{`
        /* ── Dashboard Layout ── */
        .dash-layout {
          display: flex;
          height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #f8fafc;
          overflow: hidden;
        }

        /* ── SIDEBAR ── */
        .dash-sidebar {
          width: 260px;
          flex-shrink: 0;
          background: #020617;
          display: flex;
          flex-direction: column;
          padding: 28px 16px 20px;
          position: relative;
          overflow: hidden;
          border-right: 1px solid rgba(255,255,255,0.06);
        }

        /* Sidebar ambient orbs */
        .sidebar-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          animation: float 14s ease-in-out infinite;
        }
        .sidebar-orb-1 {
          width: 200px; height: 200px;
          background: #0C447C;
          top: -60px; left: -60px;
          opacity: 0.35;
        }
        .sidebar-orb-2 {
          width: 180px; height: 180px;
          background: #3b82f6;
          bottom: -40px; right: -60px;
          opacity: 0.2;
          animation-delay: -5s;
        }

        /* Logo */
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px;
          margin-bottom: 28px;
          position: relative;
          z-index: 2;
        }
        .sidebar-logo-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .sidebar-logo-text {
          color: #ffffff;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        /* Org badge */
        .sidebar-org {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          margin-bottom: 20px;
          position: relative;
          z-index: 2;
        }
        .sidebar-org-avatar {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }
        .sidebar-org-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .sidebar-org-name {
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-org-role {
          color: #64748b;
          font-size: 11px;
          font-weight: 500;
        }

        /* Divider */
        .sidebar-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 8px 8px 16px;
          position: relative;
          z-index: 2;
        }

        /* Nav */
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          position: relative;
          z-index: 2;
        }
        .sidebar-nav-label {
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0 12px;
          margin-bottom: 8px;
        }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 500;
          color: #94a3b8;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          border: 1px solid transparent;
        }
        .sidebar-nav-item:hover {
          color: #e2e8f0;
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.04);
        }
        .sidebar-nav-active {
          color: #ffffff !important;
          background: rgba(12, 68, 124, 0.5) !important;
          border-color: rgba(59, 130, 246, 0.2) !important;
          box-shadow: 0 0 20px rgba(12, 68, 124, 0.15);
        }
        .sidebar-nav-active::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 24px;
          background: linear-gradient(180deg, #3b82f6, #1d4ed8);
          border-radius: 0 3px 3px 0;
        }
        .sidebar-nav-icon {
          font-size: 16px;
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }
        .sidebar-nav-text {
          white-space: nowrap;
        }

        /* Sign Out */
        .sidebar-signout {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          z-index: 2;
          font-family: inherit;
          width: 100%;
          text-align: left;
        }
        .sidebar-signout:hover {
          color: #f87171;
          background: rgba(248, 113, 113, 0.08);
        }

        /* ── MAIN CONTENT ── */
        .dash-main {
          flex: 1;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          background: #f8fafc;
        }
        .dash-main-pattern {
          position: fixed;
          top: 0; right: 0;
          width: calc(100% - 260px);
          height: 100%;
          background-image: radial-gradient(#cbd5e1 0.8px, transparent 0.8px);
          background-size: 28px 28px;
          opacity: 0.25;
          pointer-events: none;
          z-index: 0;
        }
        .dash-main-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          animation: float 18s ease-in-out infinite;
          z-index: 0;
        }
        .dash-main-orb-1 {
          width: 500px; height: 500px;
          background: rgba(59, 130, 246, 0.06);
          top: -10%; right: -5%;
        }
        .dash-main-orb-2 {
          width: 400px; height: 400px;
          background: rgba(14, 165, 233, 0.04);
          bottom: -15%; left: 20%;
          animation-delay: -6s;
        }
        .dash-main-content {
          position: relative;
          z-index: 1;
          min-height: 100%;
        }

        /* ── SCROLLBAR for sidebar ── */
        .dash-sidebar::-webkit-scrollbar { width: 4px; }
        .dash-sidebar::-webkit-scrollbar-track { background: transparent; }
        .dash-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .dash-sidebar { width: 72px; padding: 20px 8px; }
          .sidebar-logo-text,
          .sidebar-org-info,
          .sidebar-nav-label,
          .sidebar-nav-text,
          .sidebar-signout span { display: none; }
          .sidebar-org { padding: 8px; justify-content: center; }
          .sidebar-nav-item { justify-content: center; padding: 12px; }
          .sidebar-signout { justify-content: center; }
          .sidebar-nav-active::before { display: none; }
          .dash-main-pattern { width: calc(100% - 72px); }
        }
      `}</style>
    </>
  );
}