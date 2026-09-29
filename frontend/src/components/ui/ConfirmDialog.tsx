import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useDialog } from './useDialog';
import './dialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for destructive actions (red), "primary" for everything else. */
  tone?: 'danger' | 'primary';
  busy?: boolean;
  busyLabel?: string;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small confirmation dialog for destructive or outward-facing actions (delete, publish, discard). */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  busyLabel,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Destructive dialogs start on Cancel so a stray Enter never confirms them.
  const dialogRef = useDialog<HTMLDivElement>({
    open,
    onClose: onCancel,
    canClose: !busy,
    initialFocusRef: tone === 'danger' ? cancelRef : undefined,
  });

  if (!open) return null;

  return createPortal(
    <div className="ug-dialog-backdrop" onClick={() => !busy && onCancel()}>
      <div
        ref={dialogRef}
        className="ug-dialog ug-dialog-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="ug-dialog-body">
          <div className={`ug-dialog-icon ug-dialog-icon-${tone}`} aria-hidden="true">
            {tone === 'danger' ? (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="ug-dialog-copy">
            <h2 id={titleId} className="ug-dialog-title">{title}</h2>
            {description && <div id={descId} className="ug-dialog-text">{description}</div>}
          </div>
        </div>

        {error && (
          <div className="ug-dialog-error" role="alert">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="ug-dialog-actions">
          <button ref={cancelRef} type="button" className="ug-btn ug-btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ug-btn ${tone === 'danger' ? 'ug-btn-danger' : 'ug-btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="ug-spinner" aria-hidden="true" />}
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
