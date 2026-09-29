// App shell: sidebar navigation, mobile top bar / bottom navigation, and the routed page.
import { useState, useEffect, useRef } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useOrganization } from '../../context/useOrganization';
import OrgSwitcher from '../organizations/user/components/OrgSwitcher';
import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import '../../components/ui/dialog.css';
import './shell.css';

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
type NavItem = { to: string; icon: string; label: string; end?: boolean };

// Icons are Flaticon UIcons (regular / rounded) — the class name is the icon.
// Grouped by task: day-to-day content work first, administration last.
const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [{ to: '/', icon: 'fi-rr-apps', label: 'Dashboard', end: true }],
  },
  {
    label: 'Content',
    items: [
      { to: '/posts',    icon: 'fi-rr-document', label: 'Posts'          },
      { to: '/calendar', icon: 'fi-rr-calendar', label: 'Calendar'       },
      { to: '/media',    icon: 'fi-rr-folder',   label: 'Media'          },
      { to: '/caption',  icon: 'fi-rr-sparkles', label: 'Caption Studio' },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/analytics', icon: 'fi-rr-chart-histogram', label: 'Analytics' }],
  },
  {
    label: 'Organization',
    items: [{ to: '/organizations', icon: 'fi-rr-building', label: 'Organizations' }],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { to: '/',          icon: 'fi-rr-home',            label: 'Home', end: true },
  { to: '/posts',     icon: 'fi-rr-document',        label: 'Posts' },
  { to: '/create',    icon: 'fi-rr-plus',            label: 'Create' },
  { to: '/media',     icon: 'fi-rr-folder',          label: 'Media' },
  { to: '/analytics', icon: 'fi-rr-chart-histogram', label: 'Stats' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { activeOrg } = useOrganization();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(readInitialSidebarOpen);
  const [isMobile, setIsMobile] = useState<boolean>(() => window.matchMedia(MOBILE_QUERY).matches);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Mobile drawer: Escape closes it and focus returns to the menu button; opening moves focus inside.
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile, sidebarOpen]);

  const setOpen = (open: boolean) => {
    setSidebarOpen(open);
    setTooltip(null);
    // The mobile drawer always starts closed, so only remember the desktop preference.
    if (isMobile) {
      if (!open) menuButtonRef.current?.focus();
      return;
    }
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    } catch {
      // Storage unavailable (private mode etc.) — the toggle still works for this session.
    }
  };

  // Tooltips are position: fixed so the sidebar can keep overflow: hidden for its glow orbs.
  const showTooltip = (text: string, force = false) =>
    (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      if ((sidebarOpen || isMobile) && !force) return;
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
  const onNavigate = () => { hideTooltip(); if (isMobile) setOpen(false); };
  // The composer has its own sticky action bar; the bottom tabs would cover it.
  const showBottomNav = isMobile && !location.pathname.startsWith('/create');

  return (
    <>
      <a href="#main-content" className="dash-skip">Skip to main content</a>
      <div className={`dash-layout ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}${showBottomNav ? ' has-bottomnav' : ''}`}>
        {/* ── SIDEBAR ── */}
        <aside
          id="app-sidebar"
          className="dash-sidebar"
          aria-label="Main navigation"
          aria-hidden={isMobile && !sidebarOpen ? true : undefined}
        >
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
                ref={closeButtonRef}
                type="button"
                className="sidebar-toggle"
                onClick={() => setOpen(false)}
                aria-label={isMobile ? 'Close menu' : 'Close sidebar'}
                aria-expanded="true"
                aria-controls="app-sidebar"
                {...tooltipProps(isMobile ? 'Close menu' : 'Close sidebar', !isMobile)}
              >
                <i className={`fi ${isMobile ? 'fi-rr-cross-small' : 'fi-rr-sidebar'}`} aria-hidden="true"></i>
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
                aria-controls="app-sidebar"
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

          {/* Primary action */}
          <NavLink
            to="/create"
            className={({ isActive }: { isActive: boolean }) => `sidebar-create${isActive ? ' is-active' : ''}`}
            aria-label={sidebarOpen ? undefined : 'Create Post'}
            onClick={onNavigate}
            {...tooltipProps('Create Post')}
          >
            <i className="fi fi-rr-plus" aria-hidden="true"></i>
            <span className="sidebar-create-text">Create Post</span>
          </NavLink>

          {/* Nav */}
          <div className="sidebar-scroll">
            {NAV_SECTIONS.map(section => (
              <nav key={section.label} className="sidebar-nav" aria-label={section.label}>
                <span className="sidebar-nav-label" aria-hidden="true">{section.label}</span>
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    aria-label={sidebarOpen ? undefined : item.label}
                    onClick={onNavigate}
                    className={({ isActive }: { isActive: boolean }) =>
                      `sidebar-nav-item ${isActive ? 'sidebar-nav-active' : ''}`
                    }
                    {...tooltipProps(item.label)}
                  >
                    <span className="sidebar-nav-icon"><i className={`fi ${item.icon}`} aria-hidden="true"></i></span>
                    <span className="sidebar-nav-text">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            ))}
          </div>

          {/* Divider */}
          <div className="sidebar-divider"></div>

          {/* Sign Out */}
          <button
            type="button"
            onClick={logout}
            className="sidebar-signout"
            aria-label={sidebarOpen ? undefined : 'Sign Out'}
            {...tooltipProps('Sign Out')}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="sidebar-signout-text">Sign Out</span>
          </button>
        </aside>

        {/* Backdrop for the drawer on small screens */}
        {isMobile && sidebarOpen && (
          <div className="dash-sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true"></div>
        )}

        {tooltip && (
          <div className="sidebar-tooltip" role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>
            {tooltip.text}
          </div>
        )}

        <div className="dash-body">
          {/* ── Mobile top bar ── */}
          {isMobile && (
            <header className="dash-topbar">
              <button
                ref={menuButtonRef}
                type="button"
                className="dash-topbar-menu"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-expanded={sidebarOpen}
                aria-controls="app-sidebar"
              >
                <i className="fi fi-rr-menu-burger" aria-hidden="true"></i>
              </button>
              <Link to="/" className="dash-topbar-brand" aria-label="Ugnay — Dashboard">
                <img src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
                <span>Ugnay</span>
              </Link>
              <button
                type="button"
                className="dash-topbar-org"
                onClick={() => setOpen(true)}
                aria-label={`Workspace: ${orgName}. Open menu to switch.`}
              >
                <span className="dash-topbar-org-avatar" aria-hidden="true">{orgName.charAt(0).toUpperCase()}</span>
                <span className="dash-topbar-org-name">{orgName}</span>
              </button>
            </header>
          )}

          {/* ── MAIN CONTENT ── */}
          <main id="main-content" className="dash-main" tabIndex={-1}>
            {/* Subtle background pattern */}
            <div className="dash-main-pattern"></div>
            <div className="dash-main-orb dash-main-orb-1"></div>
            <div className="dash-main-orb dash-main-orb-2"></div>
            <div className="dash-main-content">
              <Outlet />
            </div>
          </main>
        </div>

        {/* ── Mobile bottom navigation ── */}
        {showBottomNav && (
          <nav className="dash-bottomnav" aria-label="Quick navigation">
            {BOTTOM_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }: { isActive: boolean }) =>
                  `dash-bottomnav-item${item.to === '/create' ? ' dash-bottomnav-create' : ''}${isActive ? ' is-active' : ''}`
                }
              >
                {item.to === '/create' ? (
                  <span className="dash-bottomnav-fab"><i className={`fi ${item.icon}`} aria-hidden="true"></i></span>
                ) : (
                  <i className={`fi ${item.icon}`} aria-hidden="true"></i>
                )}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
