// features/media/components/UploadPanel.tsx
import { useState } from 'react';
import type { UploadItem } from './useUploadQueue';
import './uploadPanel.css';

interface UploadPanelProps {
  items: UploadItem[];
  /** Folder names by id, so uploads into a folder you've navigated away from still say where they went. */
  folderNames: Map<string, string>;
  onRetry: (item: UploadItem) => void;
  onDismiss: () => void;
  /** Lift the panel above the selection bar while that bar is showing. */
  raised: boolean;
}

/** Floating per-file upload progress, bottom-right. */
export default function UploadPanel({ items, folderNames, onRetry, onDismiss, raised }: UploadPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const active = items.filter(i => i.status === 'queued' || i.status === 'uploading').length;
  const done = items.filter(i => i.status === 'done').length;
  const failed = items.filter(i => i.status === 'error').length;

  let title = `Uploading… ${done} of ${items.length} done`;
  if (active === 0) {
    title = failed > 0 ? `${done} uploaded, ${failed} failed` : `${done} upload${done !== 1 ? 's' : ''} complete`;
  }

  return (
    <section className={`up-panel ${raised ? 'up-panel-raised' : ''}`} aria-label="Uploads">
      <div className="up-head">
        <span className="up-title" aria-live="polite">{title}</span>
        <button
          type="button"
          className="up-icon-btn"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show uploads' : 'Hide uploads'}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        </button>
        <button
          type="button"
          className="up-icon-btn"
          onClick={onDismiss}
          disabled={active > 0}
          aria-label="Close uploads"
          title={active > 0 ? 'Available when uploads finish' : undefined}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <ul className="up-list">
          {items.map(item => (
            <li key={item.key} className={`up-item up-item-${item.status}`}>
              <div className="up-item-row">
                <span className="up-name" title={item.name}>{item.name}</span>
                <span className="up-status">
                  {item.status === 'queued' && 'Waiting…'}
                  {item.status === 'uploading' && (item.progress >= 100 ? 'Saving…' : `${item.progress}%`)}
                  {item.status === 'done' && (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-label="Uploaded">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {item.status === 'error' && (
                    <button type="button" className="up-retry" onClick={() => onRetry(item)}>Retry</button>
                  )}
                </span>
              </div>
              {(item.status === 'uploading' || item.status === 'queued') && (
                <div className="up-bar" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} aria-label={item.name}>
                  <div className="up-bar-fill" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.status === 'error' && <p className="up-error">{item.error}</p>}
              {item.status === 'done' && folderNames.get(item.folderId) && (
                <p className="up-folder">in {folderNames.get(item.folderId)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
