import { useState, useEffect, useCallback } from 'react';

/* ──────────────────────────────────────────────────────────
   Feature-icon SVGs (unchanged originals, plus glow wrapper)
   ────────────────────────────────────────────────────────── */
export function AuthFeatureIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17M8 14h3v3H8z" />
      </svg>
    );
  }

  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V11h4v9M10 20V5h4v15M16 20v-7h4v7M3 20.5h18" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   Right-panel background (UNCHANGED)
   ────────────────────────────────────────────────────────── */
export function AuthenticationBackground() {
  return (
    <div className="auth-background" aria-hidden="true">
      <div className="auth-background__glow" />
      <div className="auth-background__shape auth-background__shape--upper"><span className="auth-background__highlight" /></div>
      <div className="auth-background__shape auth-background__shape--edge"><span className="auth-background__highlight" /></div>
      <div className="auth-background__shape auth-background__shape--lower"><span className="auth-background__highlight" /></div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Floating ambient particles (7 particles, very subtle)
   ────────────────────────────────────────────────────────── */
export function FloatingParticles() {
  const particles = [
    { size: 3, x: '12%', y: '18%', dur: '18s', delay: '0s', opacity: 0.18 },
    { size: 2, x: '78%', y: '25%', dur: '22s', delay: '-4s', opacity: 0.14 },
    { size: 4, x: '35%', y: '72%', dur: '20s', delay: '-8s', opacity: 0.12 },
    { size: 2, x: '62%', y: '55%', dur: '24s', delay: '-2s', opacity: 0.16 },
    { size: 3, x: '88%', y: '68%', dur: '19s', delay: '-6s', opacity: 0.13 },
    { size: 2, x: '22%', y: '42%', dur: '21s', delay: '-10s', opacity: 0.15 },
    { size: 3, x: '50%', y: '85%', dur: '23s', delay: '-3s', opacity: 0.11 },
  ];

  return (
    <div className="lp-particles" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="lp-particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.x,
            top: p.y,
            opacity: p.opacity,
            animationDuration: p.dur,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Automation Flow Connector (vertical: Photo→AI→Schedule→Publish→Insights)
   ────────────────────────────────────────────────────────── */
function AutomationFlow({ activeIndex }: { activeIndex: number }) {
  const icons = [
    // Camera
    <svg key="cam" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    // Sparkles
    <svg key="ai" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/></svg>,
    // Calendar
    <svg key="cal" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    // Send / Publish
    <svg key="pub" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>,
    // Bar chart
    <svg key="chart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  ];

  const steps = [
    { icon: icons[0], label: 'Photo' },
    { icon: icons[1], label: 'AI Caption' },
    { icon: icons[2], label: 'Schedule' },
    { icon: icons[3], label: 'Publish' },
    { icon: icons[4], label: 'Insights' },
  ];

  // Map feature index to active flow step range
  const activeStep = activeIndex === 0 ? 1 : activeIndex === 1 ? 2 : 4;

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
   Dashboard Preview — AI Caption Generation
   ────────────────────────────────────────────────────────── */
function PreviewAICaption({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card lp-preview-ai ${active ? 'lp-preview-card--active' : ''}`}>
      {/* Photo card */}
      <div className="lp-ai__photo">
        <div className="lp-ai__photo-placeholder">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
        <div className="lp-ai__sparkle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
            <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
          </svg>
        </div>
      </div>
      {/* Generation indicator */}
      <div className="lp-ai__gen">
        <span className="lp-ai__gen-dot" />
        <span className="lp-ai__gen-text">AI generating...</span>
      </div>
      {/* Typing caption */}
      <div className="lp-ai__caption">
        <span className="lp-ai__caption-text">Discover something extraordinary today</span>
      </div>
      {/* Checkmark */}
      <div className="lp-ai__done">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>Generated</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Dashboard Preview — Scheduling Calendar
   ────────────────────────────────────────────────────────── */
function PreviewSchedule({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card lp-preview-sched ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="lp-sched__header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>September 30</span>
      </div>
      <div className="lp-sched__slots">
        <div className="lp-sched__slot">
          <span className="lp-sched__time">10 AM</span>
          <div className="lp-sched__post lp-sched__post--scheduled">
            <span className="lp-sched__post-bar" />
            <span className="lp-sched__post-label">Post scheduled</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lp-sched__check">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        </div>
        <div className="lp-sched__slot">
          <span className="lp-sched__time">2 PM</span>
          <div className="lp-sched__post lp-sched__post--empty">
            <span className="lp-sched__post-bar lp-sched__post-bar--dim" />
          </div>
        </div>
        <div className="lp-sched__slot">
          <span className="lp-sched__time">5 PM</span>
          <div className="lp-sched__post lp-sched__post--empty">
            <span className="lp-sched__post-bar lp-sched__post-bar--dim" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Dashboard Preview — Engagement Analytics
   ────────────────────────────────────────────────────────── */
function PreviewAnalytics({ active }: { active: boolean }) {
  const bars = [28, 45, 38, 62, 52, 75, 58, 85];

  return (
    <div className={`lp-preview-card lp-preview-analytics ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="lp-analytics__header">
        <span className="lp-analytics__title">Engagement</span>
        <span className="lp-analytics__badge">+24.8%</span>
      </div>
      {/* Line graph */}
      <div className="lp-analytics__line-wrap">
        <svg className="lp-analytics__line" viewBox="0 0 200 50" preserveAspectRatio="none">
          <path
            d="M0 40 C20 35, 40 28, 60 30 S100 15, 120 18 S160 8, 180 12 L200 6"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2"
            className="lp-analytics__line-path"
          />
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {/* Bar chart */}
      <div className="lp-analytics__bars">
        {bars.map((h, i) => (
          <div
            key={i}
            className="lp-analytics__bar"
            style={{ '--bar-h': `${h}%`, '--bar-delay': `${i * 0.08}s` } as React.CSSProperties}
          />
        ))}
      </div>
      {/* Metrics */}
      <div className="lp-analytics__metrics">
        <div className="lp-analytics__metric">
          <span className="lp-analytics__metric-val">1.2K</span>
          <span className="lp-analytics__metric-label">Reach</span>
        </div>
        <div className="lp-analytics__metric">
          <span className="lp-analytics__metric-val">348</span>
          <span className="lp-analytics__metric-label">Likes</span>
        </div>
        <div className="lp-analytics__metric">
          <span className="lp-analytics__metric-val">89</span>
          <span className="lp-analytics__metric-label">Shares</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Feature Showcase (auto-cycling, with progress bar)
   ────────────────────────────────────────────────────────── */
const FEATURES = [
  { label: 'AI caption generation from photos' },
  { label: 'Automated Facebook scheduling' },
  { label: 'Engagement insights and analytics' },
] as const;

const CYCLE_MS = 4500;

export function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0); // forces CSS animation restart

  const advance = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % FEATURES.length);
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
        {FEATURES.map((f, i) => (
          <button
            key={i}
            type="button"
            className={`lp-feature ${i === activeIndex ? 'lp-feature--active' : ''}`}
            onClick={() => { setActiveIndex(i); setProgressKey(p => p + 1); }}
            aria-label={f.label}
          >
            <div className="lp-feature__icon">
              <AuthFeatureIcon index={i} />
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

      {/* Automation flow */}
      <AutomationFlow activeIndex={activeIndex} />

      {/* Animated dashboard previews */}
      <div className="lp-previews">
        <PreviewAICaption active={activeIndex === 0} />
        <PreviewSchedule active={activeIndex === 1} />
        <PreviewAnalytics active={activeIndex === 2} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration: Ambient Floating Particles
   (subtle upward motion & connection guides)
   ────────────────────────────────────────────────────────── */
export function RegistrationParticles() {
  const particles = [
    { size: 3, x: '14%', y: '80%', dur: '16s', delay: '0s', opacity: 0.16 },
    { size: 2, x: '82%', y: '72%', dur: '20s', delay: '-3s', opacity: 0.14 },
    { size: 4, x: '25%', y: '60%', dur: '18s', delay: '-6s', opacity: 0.13 },
    { size: 2, x: '68%', y: '42%', dur: '22s', delay: '-2s', opacity: 0.15 },
    { size: 3, x: '88%', y: '28%', dur: '17s', delay: '-5s', opacity: 0.12 },
    { size: 2, x: '18%', y: '24%', dur: '19s', delay: '-9s', opacity: 0.14 },
    { size: 3, x: '52%', y: '88%', dur: '21s', delay: '-4s', opacity: 0.13 },
  ];

  return (
    <div className="lp-particles reg-particles" aria-hidden="true">
      <svg className="reg-connect-lines" viewBox="0 0 400 600" preserveAspectRatio="none">
        <line x1="90" y1="0" x2="90" y2="600" stroke="rgba(96, 165, 250, 0.05)" strokeDasharray="4 8" />
        <line x1="310" y1="0" x2="310" y2="600" stroke="rgba(129, 140, 248, 0.05)" strokeDasharray="4 8" />
        <path d="M90 220 C 150 280, 250 230, 310 320" stroke="rgba(96, 165, 250, 0.06)" fill="none" strokeDasharray="3 6" />
      </svg>
      {particles.map((p, i) => (
        <span
          key={i}
          className="lp-particle reg-particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.x,
            top: p.y,
            opacity: p.opacity,
            animationDuration: p.dur,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Flow Connector
   Organization → Workspace → AI Content → Social Connect
   ────────────────────────────────────────────────────────── */
function RegistrationFlow({ activeIndex }: { activeIndex: number }) {
  const steps = [
    {
      label: 'Organization',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 11h2M9 15h2M13 11h2M13 15h2" />
        </svg>
      ),
    },
    {
      label: 'Workspace',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      label: 'AI Content',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
          <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
        </svg>
      ),
    },
    {
      label: 'Social Connect',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
  ];

  // Feature 0: Org + Workspace lit
  // Feature 1: Org + Workspace + AI Content lit
  // Feature 2: All 4 lit
  const maxLitStep = activeIndex === 0 ? 1 : activeIndex === 1 ? 2 : 3;

  return (
    <div className="lp-flow reg-flow" aria-hidden="true">
      {steps.map((step, i) => (
        <div key={i} className="lp-flow__step-wrap">
          <div className={`lp-flow__step ${i <= maxLitStep ? 'lp-flow__step--lit' : ''}`}>
            <span className="lp-flow__icon">{step.icon}</span>
            <span className="lp-flow__label">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`lp-flow__connector ${i < maxLitStep ? 'lp-flow__connector--lit' : ''}`}>
              <span className="lp-flow__dot" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Preview 1 — Unified Workspace Setup
   ────────────────────────────────────────────────────────── */
function PreviewWorkspaceSetup({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card reg-preview-workspace ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="reg-ws__header">
        <div className="reg-ws__header-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span>UGNAY WORKSPACE</span>
        </div>
        <div className="reg-ws__status-badge">
          <span className="reg-ws__status-dot" />
          <span>Ready</span>
        </div>
      </div>

      <div className="reg-ws__body">
        <div className="reg-ws__org-card">
          <div className="reg-ws__org-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 11h2M9 15h2M13 11h2M13 15h2" />
            </svg>
          </div>
          <div className="reg-ws__org-info">
            <span className="reg-ws__org-name">Campus Student Org</span>
            <span className="reg-ws__org-meta">Primary Organization</span>
          </div>
          <div className="reg-ws__avatars">
            <span className="reg-ws__avatar" style={{ background: 'rgba(59, 130, 246, 0.35)' }}>SC</span>
            <span className="reg-ws__avatar" style={{ background: 'rgba(139, 92, 246, 0.35)' }}>VP</span>
            <span className="reg-ws__avatar" style={{ background: 'rgba(16, 185, 129, 0.35)' }}>PR</span>
          </div>
        </div>

        <div className="reg-ws__modules">
          <div className="reg-ws__module">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>Team Roles Configured</span>
          </div>
          <div className="reg-ws__module">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>Centralized Workspace</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Preview 2 — AI Caption Suggestions
   ────────────────────────────────────────────────────────── */
function PreviewAICaptionReg({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card reg-preview-ai ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="reg-ai__header">
        <div className="reg-ai__header-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
            <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
          </svg>
          <span>AI CAPTION STUDIO</span>
        </div>
        <div className="reg-ai__badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
          </svg>
          <span>Draft Ready</span>
        </div>
      </div>

      <div className="reg-ai__content-row">
        <div className="reg-ai__photo-card">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span className="reg-ai__photo-name">Campus_TechWeek.jpg</span>
        </div>
        <div className="reg-ai__status-pill">
          <span className="reg-ai__dot" />
          <span>Instant suggestions</span>
        </div>
      </div>

      <div className="reg-ai__caption-box">
        <p className="reg-ai__caption-text">
          "Join us this Friday for Campus Tech Week 2026! Discover workshops, keynote talks, and hands-on demos. See you there!"
        </p>
      </div>

      <div className="reg-ai__footer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>Tailored caption generated in seconds</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Preview 3 — Facebook Integration
   ────────────────────────────────────────────────────────── */
function PreviewFacebookIntegration({ active }: { active: boolean }) {
  return (
    <div className={`lp-preview-card reg-preview-fb ${active ? 'lp-preview-card--active' : ''}`}>
      <div className="reg-fb__header">
        <div className="reg-fb__header-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
          <span>FACEBOOK INTEGRATION</span>
        </div>
        <div className="reg-fb__status-pill">
          <span className="reg-fb__pulse-dot" />
          <span>Connected</span>
        </div>
      </div>

      <div className="reg-fb__connect-row">
        <div className="reg-fb__node reg-fb__node--ugnay">
          <img src="/ugnay_logo_ui.png" alt="" className="reg-fb__node-logo" />
          <span>UGNAY</span>
        </div>
        <div className="reg-fb__line">
          <span className="reg-fb__signal" />
        </div>
        <div className="reg-fb__node reg-fb__node--fb">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#60a5fa">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
          <span>Org Page</span>
        </div>
      </div>

      <div className="reg-fb__details">
        <div className="reg-fb__meta-row">
          <span className="reg-fb__meta-label">Channel</span>
          <span className="reg-fb__meta-value">@CollegeOrgOfficial</span>
        </div>
        <div className="reg-fb__features">
          <div className="reg-fb__feature-tag">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>Automated Publishing</span>
          </div>
          <div className="reg-fb__feature-tag">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>Sync Live Posts</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Registration Showcase (auto-cycling through registration features)
   ────────────────────────────────────────────────────────── */
const REG_FEATURES = [
  {
    label: 'Unified workspace for your team',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'AI-driven caption suggestions',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </svg>
    ),
  },
  {
    label: 'Seamless Facebook integration',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
] as const;

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
    <div className="lp-showcase reg-showcase">
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
              {f.icon}
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

      {/* Registration-specific Automation flow */}
      <RegistrationFlow activeIndex={activeIndex} />

      {/* Animated dashboard previews */}
      <div className="lp-previews reg-previews">
        <PreviewWorkspaceSetup active={activeIndex === 0} />
        <PreviewAICaptionReg active={activeIndex === 1} />
        <PreviewFacebookIntegration active={activeIndex === 2} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Deprecated: old AuthProductPreview kept for backward compat
   (LoginForm.tsx has been updated to use FeatureShowcase instead)
   ────────────────────────────────────────────────────────── */
export function AuthProductPreview() {
  return null; // Replaced by FeatureShowcase
}