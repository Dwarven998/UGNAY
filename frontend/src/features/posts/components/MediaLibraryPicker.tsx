import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

import { mediaApi } from '../../media/api/mediaApi';
import type { MediaAsset, MediaFolder } from '../../../types';

export interface ComposerMedia { id: string; url: string }

export interface MediaLibraryPickerProps {
  orgId: string | null;
  /** False until the active workspace's Facebook Page is known — media is scoped to it. */
  ready: boolean;
  canCreateFolder: boolean;
  selected: ComposerMedia[];
  maxItems: number;
  /** "upload" highlights the upload action; "library" is plain browsing. */
  intent: 'upload' | 'library';
  onToggle: (asset: MediaAsset) => void;
  onUploaded: (assets: MediaAsset[]) => void;
}

const isImage = (asset: MediaAsset) => asset.fileType.startsWith('image');

/**
 * Media Repository browser used inside the post composer: pick a folder, select images, or upload new ones into
 * that folder — without leaving the post being written. Only images can be attached, since that is what
 * the Facebook publisher sends.
 */
export default function MediaLibraryPicker({
  orgId,
  ready,
  canCreateFolder,
  selected,
  maxItems,
  intent,
  onToggle,
  onUploaded,
}: MediaLibraryPickerProps) {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [foldersState, setFoldersState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [folder, setFolder] = useState<MediaFolder | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetsState, setAssetsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRequest = useRef(0);

  const openFolder = useCallback(async (next: MediaFolder) => {
    const request = ++folderRequest.current;
    setFolder(next);
    setAssets([]);
    setAssetsState('loading');
    setUploadError('');
    try {
      const data = await mediaApi.getAssets(next.id);
      if (request === folderRequest.current) {
        setAssets(data);
        setAssetsState('ready');
      }
    } catch (err) {
      console.error('Failed to load folder assets:', err);
      if (request === folderRequest.current) setAssetsState('error');
    }
  }, []);

  const [foldersReload, setFoldersReload] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    mediaApi.getFolders(orgId).then(
      data => {
        if (!current) return;
        setFolders(data);
        setFoldersState('ready');
        // With a single folder there is nothing to choose — open it straight away.
        if (data.length === 1) void openFolder(data[0]);
      },
      err => {
        console.error('Failed to load folders:', err);
        if (current) setFoldersState('error');
      },
    );
    return () => { current = false; };
  }, [ready, orgId, openFolder, foldersReload]);

  const retryFolders = () => {
    setFoldersState('loading');
    setFoldersReload(n => n + 1);
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    setFolderError('');
    try {
      const created = await mediaApi.createFolder(name, orgId);
      setFolders(prev => [...prev, created]);
      setNewFolderName('');
      void openFolder(created);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Could not create the folder.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!folder || files.length === 0) return;
    setUploading(true);
    setUploadError('');
    const uploaded: MediaAsset[] = [];
    try {
      for (const file of files) {
        const asset = await mediaApi.uploadAsset(folder.id, file);
        uploaded.push(asset);
        setAssets(prev => [...prev, asset]);
      }
    } catch (err) {
      setUploadError(
        `${uploaded.length > 0 ? `${uploaded.length} of ${files.length} uploaded. ` : ''}${err instanceof Error ? err.message : 'Upload failed.'}`,
      );
    } finally {
      setUploading(false);
      if (uploaded.length > 0) {
        onUploaded(uploaded.filter(isImage));
        setFolders(prev => prev.map(f => (f.id === folder.id ? { ...f, assetCount: f.assetCount + uploaded.length } : f)));
      }
    }
  };

  const isSelected = (asset: MediaAsset) =>
    selected.some(item => (item.id && item.id === asset.id) || (item.url && item.url === asset.fileUrl));
  const selectedIndex = (asset: MediaAsset) =>
    selected.findIndex(item => (item.id && item.id === asset.id) || (item.url && item.url === asset.fileUrl));
  const atLimit = selected.length >= maxItems;

  if (!ready || foldersState === 'loading') {
    return (
      <div className="cp-picker cp-picker-status" role="status">
        <span className="ug-spinner" aria-hidden="true" /> Loading your Media Library…
      </div>
    );
  }

  if (foldersState === 'error') {
    return (
      <div className="cp-picker cp-picker-status cp-picker-status-error" role="alert">
        <span>We couldn't load your Media Library.</span>
        <button type="button" className="ug-btn ug-btn-secondary ug-btn-sm" onClick={retryFolders}>Try again</button>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="cp-picker cp-picker-empty">
        <p className="cp-picker-empty-title">Your Media Library has no folders yet</p>
        {canCreateFolder ? (
          <>
            <p className="cp-picker-empty-text">Create a folder to upload your first images into.</p>
            <div className="cp-picker-newfolder">
              <label htmlFor="cp-new-folder" className="cp-sr-only">New folder name</label>
              <input
                id="cp-new-folder"
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void createFolder(); } }}
                placeholder="Folder name, e.g. Events"
                className="cp-input"
              />
              <button
                type="button"
                className="ug-btn ug-btn-primary"
                onClick={() => void createFolder()}
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder && <span className="ug-spinner" aria-hidden="true" />}
                {creatingFolder ? 'Creating…' : 'Create folder'}
              </button>
            </div>
            {folderError && <p className="cp-field-error" role="alert">{folderError}</p>}
          </>
        ) : (
          <p className="cp-picker-empty-text">
            An officer or admin needs to create a folder first. You can still continue with a text-only post.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`cp-picker${intent === 'upload' ? ' cp-picker-upload' : ''}`}>
      <div className="cp-picker-folders" role="list" aria-label="Folders">
        {folders.map(f => (
          <button
            key={f.id}
            type="button"
            role="listitem"
            className={`cp-picker-folder${folder?.id === f.id ? ' is-active' : ''}`}
            onClick={() => void openFolder(f)}
            aria-current={folder?.id === f.id ? 'true' : undefined}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="cp-picker-folder-name">{f.name}</span>
            <span className="cp-picker-folder-count">{f.assetCount}</span>
          </button>
        ))}
      </div>

      <div className="cp-picker-main">
        {!folder ? (
          <div className="cp-picker-hint">
            {intent === 'upload' ? 'Choose the folder to upload your images into.' : 'Choose a folder to browse its images.'}
          </div>
        ) : (
          <>
            <div className="cp-picker-toolbar">
              <span className="cp-picker-toolbar-title">{folder.name}</span>
              <button
                type="button"
                className={`ug-btn ${intent === 'upload' ? 'ug-btn-primary' : 'ug-btn-secondary'} ug-btn-sm`}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <span className="ug-spinner" aria-hidden="true" /> : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                {uploading ? 'Uploading…' : 'Upload images'}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpg,image/jpeg,image/png,image/webp"
                onChange={e => void handleUpload(e)}
                className="cp-sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            {uploadError && <p className="cp-field-error" role="alert">{uploadError}</p>}

            {assetsState === 'loading' && (
              <div className="cp-picker-hint" role="status"><span className="ug-spinner" aria-hidden="true" /> Loading images…</div>
            )}
            {assetsState === 'error' && (
              <div className="cp-picker-hint cp-picker-status-error" role="alert">
                Couldn't load this folder.
                <button type="button" className="ug-btn ug-btn-secondary ug-btn-sm" onClick={() => void openFolder(folder)}>Try again</button>
              </div>
            )}
            {assetsState === 'ready' && assets.length === 0 && (
              <div className="cp-picker-hint">This folder is empty — upload images to use them in your post.</div>
            )}
            {assetsState === 'ready' && assets.length > 0 && (
              <div className="cp-picker-grid">
                {assets.map(asset => {
                  const image = isImage(asset);
                  const chosen = isSelected(asset);
                  const disabled = !image || (!chosen && atLimit);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={`cp-picker-asset${chosen ? ' is-selected' : ''}`}
                      onClick={() => onToggle(asset)}
                      disabled={disabled}
                      aria-pressed={chosen}
                      aria-label={`${asset.fileName}${image ? '' : ' (video — not supported in posts)'}`}
                      title={image ? asset.fileName : 'Videos can’t be attached to posts yet'}
                    >
                      {image ? (
                        <img src={asset.fileUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="cp-picker-video">Video</span>
                      )}
                      {chosen && <span className="cp-picker-check" aria-hidden="true">{selectedIndex(asset) + 1}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {atLimit && (
              <p className="cp-picker-limit">You've reached the {maxItems}-image limit for one post.</p>
            )}
          </>
        )}
        <Link to="/media" target="_blank" rel="noopener" className="cp-picker-manage">
          Manage folders in Media Repository<span className="cp-sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
    </div>
  );
}
