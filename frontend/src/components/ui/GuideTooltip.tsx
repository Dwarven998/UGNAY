import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import './guide-tooltip.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface GuideStep {
  /** Unique key for this step. */
  id: string;
  /** Title shown in the tooltip header. */
  title: string;
  /** Rich or plain-text description. */
  description: ReactNode;
  /** Where the tooltip anchors relative to the target element. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Whether to add a highlight ring around the target. */
  spotlight?: boolean;
}

interface GuideTooltipProps {
  /** All steps in this guide sequence. */
  steps: GuideStep[];
  /** Render prop: the child receives a ref-setter so the tooltip can anchor. */
  children: (
    /** Assign this to the DOM element you want the tooltip to point at. */
    setRef: (el: HTMLElement | null) => void,
    /** The step currently shown, or null when the guide is dismissed. */
    activeStep: GuideStep | null,
  ) => ReactNode;
  /** Storage key to persist "dismissed" state — unique per guide. */
  storageKey: string;
  /** Delay (ms) before the first tooltip fades in. @default 600 */
  delay?: number;
  /** Called when the guide finishes or is dismissed. */
  onComplete?: () => void;
}

/* ── Hook: tracks dismissed state in localStorage ──────────────────────── */

function useGuideDismissed(key: string): [boolean, () => void, () => void] {
  const storageKey = `ugnay_guide_${key}`;

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, '1'); } catch { /* noop */ }
  }, [storageKey]);

  const reset = useCallback(() => {
    setDismissed(false);
    try { localStorage.removeItem(storageKey); } catch { /* noop */ }
  }, [storageKey]);

  return [dismissed, dismiss, reset];
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function GuideTooltip({ steps, children, storageKey, delay = 600, onComplete }: GuideTooltipProps) {
  const [dismissed, dismiss] = useGuideDismissed(storageKey);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = steps[currentIndex] ?? null;
  const isLast = currentIndex >= steps.length - 1;

  // Delay initial appearance.
  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [dismissed, delay]);

  // Recalculate position on scroll / resize / step change.
  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip || !step) return;

    const rect = anchor.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const placement = step.placement ?? 'bottom';
    const GAP = 14;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = rect.bottom + GAP;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        break;
      case 'top':
        top = rect.top - tipRect.height - GAP;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.left - tipRect.width - GAP;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + GAP;
        break;
    }

    // Keep within viewport.
    const EDGE = 12;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - tipRect.width - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - tipRect.height - EDGE));

    setPosition({ top: `${top}px`, left: `${left}px` });
  }, [step]);

  useEffect(() => {
    if (!visible || dismissed) return;
    reposition();
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, dismissed, reposition, currentIndex]);

  // Reposition after a brief frame so the tooltip DOM is measured.
  useEffect(() => {
    if (visible && !dismissed) {
      requestAnimationFrame(reposition);
    }
  }, [visible, dismissed, currentIndex, reposition]);

  const handleNext = () => {
    if (isLast) {
      dismiss();
      onComplete?.();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleDismiss = () => {
    dismiss();
    onComplete?.();
  };

  const setRef = useCallback((el: HTMLElement | null) => { anchorRef.current = el; }, []);

  if (dismissed) {
    return <>{children(setRef, null)}</>;
  }

  const placement = step?.placement ?? 'bottom';

  return (
    <>
      {children(setRef, step)}

      {visible && step && (
        <>
          {/* Backdrop overlay */}
          <div className="gt-backdrop" onClick={handleDismiss} aria-hidden="true" />

          {/* Spotlight ring on anchor */}
          {step.spotlight !== false && anchorRef.current && (
            <SpotlightRing target={anchorRef.current} />
          )}

          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className={`gt-tooltip gt-tooltip--${placement} gt-tooltip--enter`}
            style={position}
            role="dialog"
            aria-label={step.title}
          >
            <div className="gt-arrow" />

            <div className="gt-header">
              {step.icon && <span className="gt-icon" aria-hidden="true">{step.icon}</span>}
              <span className="gt-title">{step.title}</span>
              <button type="button" className="gt-close" onClick={handleDismiss} aria-label="Close guide">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="gt-body">{step.description}</div>

            <div className="gt-footer">
              <span className="gt-progress">
                {steps.length > 1 && `${currentIndex + 1} of ${steps.length}`}
              </span>
              <div className="gt-actions">
                {currentIndex > 0 && (
                  <button type="button" className="gt-btn gt-btn-ghost" onClick={handleBack}>Back</button>
                )}
                <button type="button" className="gt-btn gt-btn-primary" onClick={handleNext}>
                  {isLast ? 'Got it!' : 'Next'}
                </button>
              </div>
            </div>

            {steps.length > 1 && (
              <div className="gt-dots">
                {steps.map((s, i) => (
                  <span key={s.id} className={`gt-dot${i === currentIndex ? ' is-active' : i < currentIndex ? ' is-done' : ''}`} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ── Spotlight ring ────────────────────────────────────────────────────── */

function SpotlightRing({ target }: { target: HTMLElement }) {
  const [rect, setRect] = useState(target.getBoundingClientRect());

  useEffect(() => {
    const update = () => setRect(target.getBoundingClientRect());
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [target]);

  const PAD = 8;

  return (
    <div
      className="gt-spotlight"
      style={{
        top: `${rect.top - PAD}px`,
        left: `${rect.left - PAD}px`,
        width: `${rect.width + PAD * 2}px`,
        height: `${rect.height + PAD * 2}px`,
        borderRadius: '14px',
      }}
      aria-hidden="true"
    />
  );
}

/* ── Multi-target guide: positions tooltips at different anchors per step */

export interface MultiGuideStep extends GuideStep {
  /** CSS selector or data-guide attribute value to find the anchor for this step. */
  anchor: string;
}

interface MultiGuideProps {
  steps: MultiGuideStep[];
  storageKey: string;
  delay?: number;
  onComplete?: () => void;
}

export function MultiStepGuide({ steps, storageKey, delay = 800, onComplete }: MultiGuideProps) {
  const [dismissed, dismiss] = useGuideDismissed(storageKey);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = steps[currentIndex] ?? null;
  const isLast = currentIndex >= steps.length - 1;

  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [dismissed, delay]);

  const findAnchor = useCallback((): HTMLElement | null => {
    if (!step) return null;
    return document.querySelector(`[data-guide="${step.anchor}"]`) ?? document.querySelector(step.anchor);
  }, [step]);

  const reposition = useCallback(() => {
    const anchor = findAnchor();
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip || !step) return;

    const rect = anchor.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const placement = step.placement ?? 'bottom';
    const GAP = 14;
    let top = 0, left = 0;

    switch (placement) {
      case 'bottom': top = rect.bottom + GAP; left = rect.left + rect.width / 2 - tipRect.width / 2; break;
      case 'top':    top = rect.top - tipRect.height - GAP; left = rect.left + rect.width / 2 - tipRect.width / 2; break;
      case 'left':   top = rect.top + rect.height / 2 - tipRect.height / 2; left = rect.left - tipRect.width - GAP; break;
      case 'right':  top = rect.top + rect.height / 2 - tipRect.height / 2; left = rect.right + GAP; break;
    }

    const EDGE = 12;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - tipRect.width - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - tipRect.height - EDGE));
    setPosition({ top: `${top}px`, left: `${left}px` });
  }, [findAnchor, step]);

  useEffect(() => {
    if (!visible || dismissed) return;
    reposition();
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, dismissed, reposition, currentIndex]);

  useEffect(() => {
    if (visible && !dismissed) requestAnimationFrame(reposition);
  }, [visible, dismissed, currentIndex, reposition]);

  if (dismissed || !visible || !step) return null;

  const anchor = findAnchor();
  const placement = step.placement ?? 'bottom';

  return (
    <>
      <div className="gt-backdrop" onClick={() => { dismiss(); onComplete?.(); }} aria-hidden="true" />
      {step.spotlight !== false && anchor && <SpotlightRing target={anchor} />}
      <div
        ref={tooltipRef}
        className={`gt-tooltip gt-tooltip--${placement} gt-tooltip--enter`}
        style={position}
        role="dialog"
        aria-label={step.title}
      >
        <div className="gt-arrow" />
        <div className="gt-header">
          {step.icon && <span className="gt-icon" aria-hidden="true">{step.icon}</span>}
          <span className="gt-title">{step.title}</span>
          <button type="button" className="gt-close" onClick={() => { dismiss(); onComplete?.(); }} aria-label="Close guide">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="gt-body">{step.description}</div>
        <div className="gt-footer">
          <span className="gt-progress">{steps.length > 1 && `${currentIndex + 1} of ${steps.length}`}</span>
          <div className="gt-actions">
            {currentIndex > 0 && <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setCurrentIndex(i => i - 1)}>Back</button>}
            <button type="button" className="gt-btn gt-btn-primary" onClick={() => {
              if (isLast) { dismiss(); onComplete?.(); }
              else setCurrentIndex(i => i + 1);
            }}>{isLast ? 'Got it!' : 'Next'}</button>
          </div>
        </div>
        {steps.length > 1 && (
          <div className="gt-dots">
            {steps.map((s, i) => (
              <span key={s.id} className={`gt-dot${i === currentIndex ? ' is-active' : i < currentIndex ? ' is-done' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Re-export the hook for external use ──────────────────────────────── */
export { useGuideDismissed };

