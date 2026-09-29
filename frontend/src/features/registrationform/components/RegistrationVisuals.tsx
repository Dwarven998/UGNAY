import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

/* ──────────────────────────────────────────────────────────
   Registration-specific feature icons (Workspace, AI, Facebook)
   ────────────────────────────────────────────────────────── */
function RegFeatureIcon({ index }: { index: number }) {
  if (index === 0) {
    // Workspace / Users
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    );
  }

  if (index === 1) {
    // Sparkles / AI
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </svg>
    );
  }

  // Share / Social connection
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Automation Flow
   Organization → Workspace → AI Content → Social Connection
   ────────────────────────────────────────────────────────── */
function RegistrationFlow({ activeIndex }: { activeIndex: number }) {
  const icons: ReactNode[] = [
    // Building / Organization
    <svg key="org" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" /></svg>,
    // Layout / Workspace
    <svg key="ws" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>,
    // Sparkles / AI Content
    <svg key="ai" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /></svg>,
    // Share / Social Connection
    <svg key="soc" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>,
  ];

  const steps = [
    { icon: icons[0], label: 'Organization' },
    { icon: icons[1], label: 'Workspace' },
    { icon: icons[2], label: 'AI Content' },
    { icon: icons[3], label: 'Connected' },
  ];

  const activeStep = activeIndex === 0 ? 1 : activeIndex === 1 ? 2 : 3;

  return (
    <div className="lp-flow" aria-hidden="true">
      {steps.map((step, i) => (
        <div key={i} className="lp-flow__step-wrap">
          <div className={`lp-flow__step ${i <= activeStep ? 'lp-flow__step--lit' : ''}`}>
            <span className="lp-flow__icon">{step.icon}</span>
            <span className="lp-flow__label">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`lp-flow__connector ${i < activeStep ? 'lp-flow__connector--lit' : ''}`}>
              <span className="lp-flow__dot" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Preview: Unified Workspace Setup
   ────────────────────────────────────────────────────────── */
function PreviewWorkspace({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card lp-preview-workspace ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="lp-ws__header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span>UGNAY Workspace</span>
      </div>

      {/* Org card */}
      <div className="lp-ws__org">
        <div className="lp-ws__org-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        </div>
        <div className="lp-ws__org-info">
          <span className="lp-ws__org-name">Your Organization</span>
          <span className="lp-ws__org-role">Admin</span>
        </div>
      </div>

      {/* Workspace cards appearing */}
      <div className="lp-ws__cards">
        <div className="lp-ws__card">
          <span className="lp-ws__card-icon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span className="lp-ws__card-label">Posts</span>
        </div>
        <div className="lp-ws__card">
          <span className="lp-ws__card-icon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          </span>
          <span className="lp-ws__card-label">Calendar</span>
        </div>
        <div className="lp-ws__card">
          <span className="lp-ws__card-icon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
          </span>
          <span className="lp-ws__card-label">Insights</span>
        </div>
      </div>

      {/* Ready indicator */}
      <div className="lp-ws__ready">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>Workspace ready</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Preview: AI-Driven Caption Suggestions
   ────────────────────────────────────────────────────────── */
function PreviewAISuggestion({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card lp-preview-ai-reg ${active ? 'lp-preview-card--active' : ''}`}>
      {/* Content card */}
      <div className="lp-air__content">
        <div className="lp-air__content-thumb">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
        <div className="lp-air__sparkle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
          </svg>
        </div>
      </div>

      {/* Processing */}
      <div className="lp-air__processing">
        <span className="lp-air__proc-dot" />
        <span className="lp-air__proc-text">Generating suggestions...</span>
      </div>

      {/* Suggestion chips */}
      <div className="lp-air__suggestions">
        <div className="lp-air__chip lp-air__chip--1">
          <span className="lp-air__chip-text">Engage your audience with...</span>
        </div>
        <div className="lp-air__chip lp-air__chip--2">
          <span className="lp-air__chip-text">Join us this semester for...</span>
        </div>
      </div>

      {/* Done */}
      <div className="lp-air__done">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>2 suggestions ready</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Preview: Seamless Facebook Integration
   ────────────────────────────────────────────────────────── */
function PreviewSocialConnect({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card lp-preview-social ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="lp-soc__header">
        <span className="lp-soc__title">Social Connections</span>
      </div>

      {/* Connection card */}
      <div className="lp-soc__connection">
        <div className="lp-soc__platform">
          <div className="lp-soc__platform-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#60a5fa">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
            </svg>
          </div>
          <div className="lp-soc__platform-info">
            <span className="lp-soc__platform-name">Facebook Page</span>
            <span className="lp-soc__platform-status">Connected</span>
          </div>
          <div className="lp-soc__check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        </div>

        {/* Connection line */}
        <div className="lp-soc__line-wrap">
          <svg className="lp-soc__line" viewBox="0 0 200 20" preserveAspectRatio="none">
            <path d="M0 10 C50 10, 50 4, 100 4 S150 10, 200 10" fill="none" stroke="url(#socLineGrad)" strokeWidth="2" className="lp-soc__line-path" />
            <defs>
              <linearGradient id="socLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Publish card */}
        <div className="lp-soc__publish">
          <span className="lp-soc__publish-bar" />
          <span className="lp-soc__publish-text">Ready to publish</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Feature Showcase (auto-cycling)
   ────────────────────────────────────────────────────────── */
const REG_FEATURES = [
  { label: 'Unified workspace for your team' },
  { label: 'AI-driven caption suggestions' },
  { label: 'Seamless Facebook integration' },
] as const;

const CYCLE_MS = 4500;

export function RegistrationShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  const advance = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % REG_FEATURES.length);
    setProgressKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    const timer = setInterval(advance, CYCLE_MS);
    return () => clearInterval(timer);
  }, [advance]);

  return (
    <div className="lp-showcase">
      {/* Feature list with progress indicators */}
      <div className="lp-features">
        {REG_FEATURES.map((f, i) => (
          <button
            key={i}
            type="button"
            className={`lp-feature ${i === activeIndex ? 'lp-feature--active' : ''}`}
            onClick={() => { setActiveIndex(i); setProgressKey(p => p + 1); }}
            aria-label={f.label}
          >
            <div className="lp-feature__icon">
              <RegFeatureIcon index={i} />
            </div>
            <span className="lp-feature__label">{f.label}</span>
            {i === activeIndex && (
              <div className="lp-feature__progress" key={progressKey}>
                <span className="lp-feature__progress-bar" style={{ animationDuration: `${CYCLE_MS}ms` }} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Registration-specific automation flow */}
      <RegistrationFlow activeIndex={activeIndex} />

      {/* Animated previews */}
      <div className="lp-previews">
        <PreviewWorkspace active={activeIndex === 0} />
        <PreviewAISuggestion active={activeIndex === 1} />
        <PreviewSocialConnect active={activeIndex === 2} />
      </div>
    </div>
  );
}
