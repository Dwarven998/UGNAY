import { useEffect, useState } from 'react';
import './CopyableCode.css';

/** A join code / Join ID shown in monospace with a one-click copy button. */
export default function CopyableCode({ value, label }: Readonly<{ value: string; label: string }>) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; the code stays visible to copy by hand.
    }
  };

  return (
    <span className="oc-code">
      <code className="oc-code-value">{value}</code>
      <button
        type="button"
        className={`oc-code-copy ${copied ? 'is-copied' : ''}`}
        onClick={() => void copy()}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
      >
        <i className={`fi ${copied ? 'fi-rr-check' : 'fi-rr-copy-alt'}`} aria-hidden="true"></i>
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </span>
  );
}
