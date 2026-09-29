// pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useOrganization } from '../../context/useOrganization';
import OrgSwitcher from '../organizations/user/components/OrgSwitcher';
import '@flaticon/flaticon-uicons/css/regular/rounded.css';

const SIDEBAR_STORAGE_KEY = 'ugnay_sidebar_open';
const MOBILE_QUERY = '(max-width: 768px)';

function readInitialSidebarOpen(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches) return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

type TooltipState = { text: string; top: number; left: number } | null;

// Icons are Flaticon UIcons (regular / rounded) — the class name is the icon.
const NAV_ITEMS = [
  { to: '/posts',         icon: 'fi-rr-calendar',        label: 'Post Manager'     },
  { to: '/caption',       icon: 'fi-rr-sparkles',        label: 'Caption Studio'   },
  { to: '/media',         icon: 'fi-rr-folder',          label: 'Media Repository' },
  { to: '/analytics',     icon: 'fi-rr-chart-histogram', label: 'Analytics'        },
  { to: '/organizations', icon: 'fi-rr-building',        label: 'Organizations'    },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { activeOrg } = useOrganization();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(readInitialSidebarOpen);
  const [isMobile, setIsMobile] = useState<boolean>(() => window.matchMedia(MOBILE_QUERY).matches);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Close the overlay sidebar with Escape on small screens.
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile, sidebarOpen]);

  const setOpen = (open: boolean) => {
    setSidebarOpen(open);
    setTooltip(null);
    // The mobile overlay always starts closed, so only remember the desktop preference.
    if (isMobile) return;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    } catch {
      // Storage unavailable (private mode etc.) — the toggle still works for this session.
    }
  };

  // Tooltips are position: fixed so the sidebar can keep overflow: hidden for its glow orbs.
  const showTooltip = (text: string, force = false) =>
    (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      if (sidebarOpen && !force) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ text, top: rect.top + rect.height / 2, left: rect.right + 12 });
    };
  const hideTooltip = () => setTooltip(null);
  const tooltipProps = (text: string, force = false) => ({
    onMouseEnter: showTooltip(text, force),
    onFocus: showTooltip(text, force),
    onMouseLeave: hideTooltip,
    onBlur: hideTooltip,
  });

  const orgName = activeOrg ? activeOrg.orgName : (user?.orgName || 'Personal Workspace');

  return (
    <>
      <div className={`dash-layout ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}`}>
        {/* ── SIDEBAR ── */}
        <aside className="dash-sidebar" aria-label="Main navigation">
          {/* Ambient glow orbs */}
          <div className="sidebar-orb sidebar-orb-1"></div>
          <div className="sidebar-orb sidebar-orb-2"></div>

          {/* Logo */}
          {sidebarOpen ? (
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">
                <img className="brand-mark" src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
              </div>
              <span className="sidebar-logo-text">Ugnay</span>
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setOpen(false)}
                aria-label="Close sidebar"
                aria-expanded="true"
                {...tooltipProps('Close sidebar', true)}
              >
                <i className="fi fi-rr-sidebar" aria-hidden="true"></i>
              </button>
            </div>
          ) : (
            <div className="sidebar-logo sidebar-logo--collapsed">
              <button
                type="button"
                className="sidebar-logo-btn"
                onClick={() => setOpen(true)}
                aria-label="Open sidebar"
                aria-expanded="false"
                {...tooltipProps('Open sidebar')}
              >
                <img className="brand-mark" src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Org switcher (compact avatar when collapsed) */}
          {sidebarOpen ? (
            <OrgSwitcher />
          ) : (
            <button
              type="button"
              className="sidebar-org-compact"
              onClick={() => setOpen(true)}
              aria-label={`${orgName} — open sidebar to switch organization`}
              {...tooltipProps(orgName)}
            >
              {orgName.charAt(0).toUpperCase()}
            </button>
          )}

          {/* Divider */}
          <div className="sidebar-divider"></div>

          {/* Nav */}
          <nav className="sidebar-nav">
            <span className="sidebar-nav-label">MENU</span>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={sidebarOpen ? undefined : item.label}
                onClick={() => { hideTooltip(); if (isMobile) setOpen(false); }}
                className={({ isActive }: { isActive: boolean }) =>
                  `sidebar-nav-item ${isActive ? 'sidebar-nav-active' : ''}`
                }
                {...tooltipProps(item.label)}
              >
                <span className="sidebar-nav-icon"><i className={`fi ${item.icon}`} aria-hidden="true"></i></span>
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
          <button
            onClick={logout}
            className="sidebar-signout"
            aria-label={sidebarOpen ? undefined : 'Sign Out'}
            {...tooltipProps('Sign Out')}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="sidebar-signout-text">Sign Out</span>
          </button>
        </aside>

        {/* Backdrop for the overlay sidebar on small screens */}
        {isMobile && sidebarOpen && (
          <div className="dash-sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true"></div>
        )}

        {tooltip && (
          <div className="sidebar-tooltip" role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>
            {tooltip.text}
          </div>
        )}

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
          --sidebar-w: 260px;
          display: flex;
          height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #f8fafc;
          overflow: hidden;
        }

        /* ── SIDEBAR ── */
        .dash-layout.is-sidebar-collapsed { --sidebar-w: 72px; }

        .dash-sidebar {
          width: var(--sidebar-w);
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 40;
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
          background: transparent;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .brand-mark {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
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
          font-size: 17px;
          width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-nav-icon i { display: flex; line-height: 1; }
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
          width: calc(100% - var(--sidebar-w));
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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

        /* ── Sidebar toggle (expanded) ── */
        .sidebar-toggle {
          margin-left: auto;
          width: 34px; height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: #64748b;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .sidebar-toggle i { display: flex; line-height: 1; }
        .sidebar-toggle:hover,
        .sidebar-toggle:focus-visible {
          color: #e2e8f0;
          background: rgba(255,255,255,0.08);
          outline: none;
        }

        /* ── Collapsed rail ── */
        .sidebar-logo--collapsed { justify-content: center; padding: 0; }
        .sidebar-logo-btn {
          width: 48px; height: 48px;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .sidebar-logo-btn:hover,
        .sidebar-logo-btn:focus-visible {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.08);
          outline: none;
        }
        .sidebar-org-compact {
          width: 40px; height: 40px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #0C447C, #3b82f6);
          color: #fff;
          font-family: inherit;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          position: relative;
          z-index: 2;
          transition: box-shadow 0.15s;
        }
        .sidebar-org-compact:hover,
        .sidebar-org-compact:focus-visible {
          box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
          outline: none;
        }

        .is-sidebar-collapsed .dash-sidebar { padding: 28px 12px 20px; }
        .is-sidebar-collapsed .sidebar-nav-label,
        .is-sidebar-collapsed .sidebar-nav-text,
        .is-sidebar-collapsed .sidebar-signout-text { display: none; }
        .is-sidebar-collapsed .sidebar-nav { align-items: center; }
        .is-sidebar-collapsed .sidebar-nav-item {
          width: 48px;
          justify-content: center;
          padding: 12px;
        }
        .is-sidebar-collapsed .sidebar-nav-active::before { left: -12px; }
        .is-sidebar-collapsed .sidebar-signout {
          width: 48px;
          margin: 0 auto;
          justify-content: center;
          padding: 12px;
        }
        .is-sidebar-collapsed .sidebar-divider { margin: 8px 4px 16px; }

        /* ── Tooltip (fixed, so it escapes the sidebar's overflow clip) ── */
        .sidebar-tooltip {
          position: fixed;
          transform: translateY(-50%);
          z-index: 1100;
          padding: 6px 10px;
          border-radius: 8px;
          background: #1e293b;
          color: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 6px 18px rgba(2,6,23,0.25);
          animation: sidebarTooltipIn 0.12s ease-out;
        }
        @keyframes sidebarTooltipIn {
          from { opacity: 0; transform: translate(-4px, -50%); }
          to { opacity: 1; transform: translate(0, -50%); }
        }

        .dash-sidebar-backdrop { display: none; }

        /* ── Responsive: rail stays in place, expanded sidebar overlays content ── */
        @media (max-width: 768px) {
          .dash-sidebar {
            position: fixed;
            top: 0; left: 0; bottom: 0;
          }
          .is-sidebar-open .dash-sidebar { box-shadow: 12px 0 32px rgba(2,6,23,0.35); }
          .dash-main { margin-left: 72px; }
          .dash-main-pattern { width: calc(100% - 72px); }
          .dash-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 35;
            background: rgba(2,6,23,0.45);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dash-sidebar, .dash-main-pattern { transition: none; }
          .sidebar-tooltip { animation: none; }
        }
      `}</style>
    </>
  );
}