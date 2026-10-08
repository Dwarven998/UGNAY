// features/media/components/BulkActionBar.tsx
import './bulkActionBar.css';

interface BulkActionBarProps {
  count: number;
  /** How many files are currently shown (after search / type filter). */
  visibleCount: number;
  allVisibleSelected: boolean;
  /** Why Caption / Create Post can't take this selection, or null when they can. */
  postProblem: string | null;
  deleting: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onCaption: () => void;
  onCreatePost: () => void;
  onDelete: () => void;
}

/** Appears once anything is selected. Each action applies its own limits, so selection itself never needs a mode. */
export default function BulkActionBar({
  count, visibleCount, allVisibleSelected, postProblem, deleting, onSelectAll, onClear, onCaption, onCreatePost, onDelete,
}: BulkActionBarProps) {
  return (
    <div className="bb-bar" role="region" aria-label="Selected files">
      <div className="bb-left">
        <span className="bb-count" aria-live="polite">{count} selected</span>
        {!allVisibleSelected && (
          <button type="button" className="bb-link" onClick={onSelectAll}>Select all ({visibleCount})</button>
        )}
        <button type="button" className="bb-link" onClick={onClear}>Clear</button>
      </div>
      <div className="bb-actions">
        {postProblem && <span className="bb-hint">{postProblem}</span>}
        <button type="button" className="bb-btn" onClick={onCaption} disabled={postProblem !== null} title={postProblem ?? undefined}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Caption
        </button>
        <button type="button" className="bb-btn" onClick={onCreatePost} disabled={postProblem !== null} title={postProblem ?? undefined}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Post
        </button>
        <button type="button" className="bb-btn bb-btn-danger" onClick={onDelete} disabled={deleting}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
