import type { PostConflict } from '../../../types';

export default function ConflictAlertBanner({ conflict }: { conflict: PostConflict }) {
  return (
    <div className="upe-conflict-banner" role="alert">
      <div className="upe-conflict-icon">!</div>
      <div>
        <div className="upe-conflict-title">Schedule conflict detected</div>
        <div className="upe-conflict-body">
          Another scheduled post already exists at {new Date(conflict.scheduledAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}.
        </div>
      </div>
    </div>
  );
}