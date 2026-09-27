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

export function AuthProductPreview() {
  return (
    <div className="auth-preview" aria-hidden="true">
      <aside className="auth-preview__sidebar">
        <div className="auth-preview__brand">
          <img src="/ugnay_logo_ui.png" alt="" />
          <span />
        </div>
        <div className="auth-preview__nav auth-preview__nav--active"><i /></div>
        <div className="auth-preview__nav"><i /></div>
        <div className="auth-preview__nav"><i /></div>
        <div className="auth-preview__nav"><i /></div>
        <div className="auth-preview__nav"><i /></div>
      </aside>
      <div className="auth-preview__main">
        <div className="auth-preview__topline"><i /><i /><i /></div>
        <div className="auth-preview__stats">
          <div><span /><b /></div>
          <div><span /><b /></div>
          <div><span /><b /></div>
        </div>
        <div className="auth-preview__lower">
          <div className="auth-preview__chart">
            <span className="auth-preview__chart-line" />
            {[30, 48, 42, 66, 54, 78, 63, 88].map((height, barIndex) => (
              <i key={barIndex} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="auth-preview__sidecards">
            <div className="auth-preview__media-card">
              <span />
              <i /><i /><i />
            </div>
            <div className="auth-preview__schedule-card">
              <i /><i />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}