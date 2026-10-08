// features/media/pages/MediaRepository.tsx
import { useState, useEffect, useRef, useCallback, useId, useMemo } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { mediaApi } from '../api/mediaApi.ts';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useDialog } from '../../../components/ui/useDialog';
import { AssetCollection, AssetToolbar } from '../components/AssetBrowser';
import AssetPreview from '../components/AssetPreview';
import BulkActionBar from '../components/BulkActionBar';
import UploadPanel from '../components/UploadPanel';
import ActionMenu from '../components/ActionMenu';
import { useUploadQueue } from '../components/useUploadQueue';
import {
  ACCEPTED_UPLOAD_TYPES, filterAssets, formatBytes, isImageAsset, isVideoAsset, postSelectionProblem, sortAssets, totalSize,
  useMediaViewPrefs,
} from '../components/assetView';
import type { TypeFilter } from '../components/assetView';
import { writeComposerPrefill } from '../../posts/composerHandoff';
import { useOrganization } from '../../../context/useOrganization';
import { useFacebookConnection } from '../../posts/hooks/useFacebookConnection';
import type { MediaFolder, MediaAsset, MediaRecommendation } from '../../../types';

type SearchMode = 'name' | 'ai';
interface Notice { tone: 'error' | 'info'; text: string; details?: string[] }

/**
 * The Media Repository belongs to one Facebook Page. Keying the screen by workspace + Page remounts it whenever the
 * Page changes, which discards every folder, asset, selection and in-flight result of the previous Page at once.
 */
export default function MediaRepository() {
  const { scopeKey } = useFacebookConnection();
  return <MediaRepositoryContent key={scopeKey} />;
}

function MediaRepositoryContent() {
  const navigate = useNavigate();
  const { activeOrgId, activeOrg } = useOrganization();
  const { resolved: pageResolved, pageName } = useFacebookConnection();
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [folderError, setFolderError] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<MediaFolder | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search: plain file-name filter, or the AI "best match" ranking.
  const [searchMode, setSearchMode] = useState<SearchMode>('name');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResults, setAiResults] = useState<MediaRecommendation[] | null>(null);

  // Selection drives the bulk bar; once anything is selected, clicking a file toggles it instead of opening it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggledRef = useRef<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Drag-and-drop upload target (fixed overlay sized to the content pane).
  const contentRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);

  // View & sort apply to every folder and are remembered in this browser.
  const { view, sortKey, sortDir, setView, setSort } = useMediaViewPrefs();
  const sortedAssets = useMemo(() => sortAssets(assets, sortKey, sortDir), [assets, sortKey, sortDir]);

  // AI results keep their ranking; otherwise the sorted folder, narrowed by search and type.
  const annotations = useMemo(
    () => (aiResults ? new Map(aiResults.map(r => [r.id, { badge: `${r.score}% match`, note: r.reason }])) : undefined),
    [aiResults],
  );
  const visibleAssets = useMemo(() => {
    if (aiResults) {
      const byId = new Map(assets.map(a => [a.id, a]));
      return aiResults.map(r => byId.get(r.id) ?? { id: r.id, fileName: r.fileName, fileUrl: r.fileUrl, fileType: r.fileType });
    }
    return filterAssets(sortedAssets, searchMode === 'name' ? query : '', typeFilter);
  }, [aiResults, assets, sortedAssets, searchMode, query, typeFilter]);
  const typeCounts = useMemo(() => ({
    all: assets.length,
    image: assets.filter(isImageAsset).length,
    video: assets.filter(isVideoAsset).length,
  }), [assets]);
  const selectedAssets = useMemo(() => sortedAssets.filter(a => selectedIds.has(a.id)), [sortedAssets, selectedIds]);
  const isFiltering = !aiResults && ((searchMode === 'name' && query.trim() !== '') || typeFilter !== 'all');
  const previewIndex = previewId ? visibleAssets.findIndex(a => a.id === previewId) : -1;
  const folderBytes = totalSize(assets);

  // Only officers/admins may create (or rename / delete) directories inside an org's shared Media Repository.
  const canCreateFolder = !activeOrgId || activeOrg?.role === 'ADMIN' || activeOrg?.role === 'OFFICER';

  // This screen is remounted per workspace + Facebook Page (see MediaRepository above), so a folder list
  // loaded here can only ever belong to the Page that is currently connected.
  const loadFolders = useCallback(async () => {
    try {
      setFolders(await mediaApi.getFolders(activeOrgId));
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (!pageResolved) return;
    void loadFolders();
  }, [pageResolved, loadFolders]);

  // Uploads keep going if you switch folders; only files for the open folder are added to the grid.
  const openFolderIdRef = useRef<string | null>(null);
  useEffect(() => {
    openFolderIdRef.current = selectedFolder?.id ?? null;
  }, [selectedFolder]);
  const uploads = useUploadQueue(
    (folderId, asset) => {
      if (openFolderIdRef.current === folderId) setAssets(prev => [...prev, asset]);
    },
    () => void loadFolders(), // refresh asset counts
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastToggledRef.current = null;
  }, []);

  // Escape clears the selection, unless a dialog or menu is handling it.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      clearSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedIds.size, clearSelection]);

  const resetFolderView = () => {
    setAiResults(null);
    setAiDescription('');
    setAiError('');
    setQuery('');
    setTypeFilter('all');
    setPreviewId(null);
    clearSelection();
    setNotice(null);
  };

  const loadAssets = async (folder: MediaFolder) => {
    setSelectedFolder(folder);
    resetFolderView();
    setAssets([]);
    setAssetsLoading(true);
    try {
      const data = await mediaApi.getAssets(folder.id);
      setAssets(data);
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error && err.message ? `Couldn't load this folder: ${err.message}` : "Couldn't load this folder." });
    } finally {
      setAssetsLoading(false);
    }
  };

  const runRecommendation = async () => {
    if (!selectedFolder || !aiDescription.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const results = await mediaApi.recommend(selectedFolder.id, aiDescription.trim());
      if (results.length === 0) {
        setAiError('No images to score in this folder yet — upload some first.');
        setAiResults(null);
      } else {
        setAiResults(results);
      }
    } catch {
      setAiError('AI recommendation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const clearRecommendation = () => {
    setAiResults(null);
    setAiDescription('');
    setAiError('');
  };

  const changeSearchMode = (mode: SearchMode) => {
    setSearchMode(mode);
    if (mode === 'name') clearRecommendation();
    else setQuery('');
  };

  // Folder create/delete run one at a time. The ref blocks a second click in the same tick
  // (state updates are async, so `busyMessage` alone can't stop rapid double-clicks).
  const folderActionRef = useRef(false);

  const runFolderAction = async (message: string, action: () => Promise<void>) => {
    if (folderActionRef.current) return;
    folderActionRef.current = true;
    setBusyMessage(message);
    setFolderError('');
    try {
      await action();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      folderActionRef.current = false;
      setBusyMessage(null);
    }
  };

  const openCreateFolder = () => {
    setCreateFolderError('');
    setCreateFolderOpen(true);
  };

  // Errors stay inside the dialog so the typed name isn't lost and can be corrected.
  const createFolder = async (rawName: string, openAfter: boolean) => {
    const name = rawName.trim();
    if (!canCreateFolder || folderActionRef.current) return;
    if (!name) {
      setCreateFolderError('Enter a folder name.');
      return;
    }
    folderActionRef.current = true;
    setCreatingFolder(true);
    setCreateFolderError('');
    try {
      const folder = await mediaApi.createFolder(name, activeOrgId);
      setFolders(prev => [...prev, folder]);
      setCreateFolderOpen(false);
      if (openAfter) void loadAssets(folder);
    } catch (err) {
      setCreateFolderError(err instanceof Error && err.message ? err.message : 'Could not create the folder. Please try again.');
    } finally {
      folderActionRef.current = false;
      setCreatingFolder(false);
    }
  };

  const renameFolder = async (rawName: string) => {
    const folder = selectedFolder;
    const name = rawName.trim();
    if (!folder || !canCreateFolder || folderActionRef.current || !name) return;
    folderActionRef.current = true;
    setRenaming(true);
    setRenameError('');
    try {
      const updated = await mediaApi.renameFolder(folder.id, name);
      setFolders(prev => prev.map(f => (f.id === folder.id ? { ...f, name: updated.name } : f)));
      setSelectedFolder(prev => (prev?.id === folder.id ? { ...prev, name: updated.name } : prev));
      setRenameOpen(false);
    } catch (err) {
      setRenameError(err instanceof Error && err.message ? err.message : 'Could not rename the folder. Please try again.');
    } finally {
      folderActionRef.current = false;
      setRenaming(false);
    }
  };

  const deleteFolder = () => {
    const folder = folderToDelete;
    if (!folder) return;
    setFolderToDelete(null);
    return runFolderAction('Deleting folder...', async () => {
      await mediaApi.deleteFolder(folder.id);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(null);
        setAssets([]);
        resetFolderView();
      }
    });
  };

  /** Drops deleted files everywhere they appear, and moves the preview on (or closes it) if it showed one. */
  const removeAssets = (ids: Set<string>) => {
    if (previewId && ids.has(previewId)) {
      const after = visibleAssets.slice(previewIndex + 1).find(a => !ids.has(a.id))
        ?? visibleAssets.slice(0, previewIndex).reverse().find(a => !ids.has(a.id));
      setPreviewId(after?.id ?? null);
    }
    setAssets(prev => prev.filter(a => !ids.has(a.id)));
    setAiResults(prev => (prev ? prev.filter(r => !ids.has(r.id)) : prev));
    setSelectedIds(prev => {
      if (![...ids].some(id => prev.has(id))) return prev;
      return new Set([...prev].filter(id => !ids.has(id)));
    });
  };

  const handleDeleteAsset = async () => {
    const asset = assetToDelete;
    if (!asset || deletingAsset) return;
    setDeletingAsset(true);
    setNotice(null);
    try {
      await mediaApi.deleteAsset(asset.id);
      removeAssets(new Set([asset.id]));
      setAssetToDelete(null);
      void loadFolders(); // refresh asset count
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error && err.message ? err.message : 'Could not delete the file.' });
      setAssetToDelete(null);
    } finally {
      setDeletingAsset(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selectedAssets.map(a => a.id);
    if (ids.length === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    setNotice(null);
    try {
      const result = await mediaApi.deleteAssets(ids);
      removeAssets(new Set(result.deleted));
      const deletedCount = result.deleted.length;
      const deletedText = `Deleted ${deletedCount} file${deletedCount !== 1 ? 's' : ''}.`;
      if (result.skipped.length > 0) {
        // Leave the skipped files selected so it's clear which ones remain.
        setSelectedIds(new Set(result.skipped.map(s => s.id)));
        setNotice({
          tone: deletedCount > 0 ? 'info' : 'error',
          text: `${deletedCount > 0 ? `${deletedText} ` : ''}${result.skipped.length} couldn't be deleted:`,
          details: result.skipped.map(s => `${s.fileName} — ${s.reason}`),
        });
      } else {
        setNotice({ tone: 'info', text: deletedText });
      }
      setBulkDeleteOpen(false);
      if (deletedCount > 0) void loadFolders();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error && err.message ? err.message : 'Could not delete the files.' });
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolder || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    e.target.value = '';
    uploads.enqueue(selectedFolder.id, files);
  };

  // ── Drag-and-drop upload ──
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!selectedFolder || !isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    if (dragDepth.current === 1 && contentRef.current) setDropRect(contentRef.current.getBoundingClientRect());
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!selectedFolder || !isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!selectedFolder || !isFileDrag(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropRect(null);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!selectedFolder || !isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropRect(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploads.enqueue(selectedFolder.id, files);
  };

  // ── Selection ──
  const toggleSelect = (asset: MediaAsset, range: boolean) => {
    const anchor = lastToggledRef.current;
    lastToggledRef.current = asset.id;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (range && anchor && anchor !== asset.id) {
        const ids = visibleAssets.map(a => a.id);
        const from = ids.indexOf(anchor);
        const to = ids.indexOf(asset.id);
        if (from >= 0 && to >= 0) {
          ids.slice(Math.min(from, to), Math.max(from, to) + 1).forEach(id => next.add(id));
          return next;
        }
      }
      if (next.has(asset.id)) next.delete(asset.id);
      else next.add(asset.id);
      return next;
    });
  };

  const allVisibleSelected = visibleAssets.length > 0 && visibleAssets.every(a => selectedIds.has(a.id));
  const selectAllVisible = () => setSelectedIds(prev => new Set([...prev, ...visibleAssets.map(a => a.id)]));
  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(visibleAssets.map(a => a.id));
      setSelectedIds(prev => new Set([...prev].filter(id => !visible.has(id))));
    } else {
      selectAllVisible();
    }
  };

  /** Opens the post composer with these images already attached. */
  const startPostWith = (items: { id: string; fileUrl: string }[]) => {
    if (items.length === 0) return;
    writeComposerPrefill({ media: items.map(a => ({ id: a.id, url: a.fileUrl })), step: 1, source: 'media' });
    navigate('/create');
  };

  const openCaptionStudio = (asset: MediaAsset) =>
    navigate(`/caption/select-tone?imageUrl=${encodeURIComponent(asset.fileUrl)}&assetId=${asset.id}`);

  const proceedToCaptionStudio = (selected: MediaAsset[]) => {
    if (selected.length === 0) return;
    sessionStorage.setItem('caption_image_urls', JSON.stringify(selected.map(a => a.fileUrl)));
    sessionStorage.setItem('caption_asset_ids', JSON.stringify(selected.map(a => a.id)));
    // Clear any stale single-image flow so CaptionToneSelection picks up the multi-select.
    sessionStorage.removeItem('caption_image_url');
    sessionStorage.removeItem('caption_asset_id');
    navigate('/caption/select-tone');
  };

  const searchValue = searchMode === 'ai' ? aiDescription : query;
  const searchBox = (
    <div className="mr-search-wrap">
      <div className={`mr-search ${searchMode === 'ai' ? 'mr-search-ai' : ''}`}>
        <div className="mr-search-modes" role="radiogroup" aria-label="Search mode">
          <button type="button" role="radio" aria-checked={searchMode === 'name'} className="mr-search-mode" onClick={() => changeSearchMode('name')}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            Name
          </button>
          <button type="button" role="radio" aria-checked={searchMode === 'ai'} className="mr-search-mode" onClick={() => changeSearchMode('ai')}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            AI match
          </button>
        </div>
        <input
          type="search"
          className="mr-search-input"
          aria-label={searchMode === 'ai' ? 'Describe the image you need' : 'Search files by name'}
          placeholder={searchMode === 'ai' ? 'Describe the image you need, e.g. "students at the registration booth"' : 'Search files…'}
          value={searchValue}
          onChange={e => (searchMode === 'ai' ? setAiDescription(e.target.value) : setQuery(e.target.value))}
          onKeyDown={e => {
            if (e.key === 'Enter' && searchMode === 'ai') void runRecommendation();
            if (e.key === 'Escape' && searchValue) { e.preventDefault(); e.stopPropagation(); if (searchMode === 'ai') clearRecommendation(); else setQuery(''); }
          }}
        />
        {searchMode === 'ai' && (
          <button type="button" onClick={() => void runRecommendation()} disabled={aiLoading || !aiDescription.trim()} className="mr-search-go">
            {aiLoading ? 'Thinking…' : 'Find best match'}
          </button>
        )}
      </div>
      {aiError && <p className="mr-ai-error">{aiError}</p>}
    </div>
  );

  return (
    <>
      <div className="mr-layout">
        {/* ── Left: Folder sidebar ── */}
        <div className="mr-sidebar">
          <div className="mr-sidebar-header">
            <div className="mr-sidebar-title-row">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Folders</span>
            </div>
          </div>

          {/* Create folder — org directories are officer/admin only */}
          {canCreateFolder ? (
            <div className="mr-create-folder">
              <span className="mr-create-folder-label">Create New Folder</span>
              <button
                type="button"
                onClick={openCreateFolder}
                disabled={busyMessage !== null || creatingFolder}
                className="mr-folder-add-btn"
                aria-label="Create new folder"
                aria-haspopup="dialog"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          ) : (
            <p className="mr-folder-restricted-hint">Only officers/admins can create new directories in {activeOrg?.orgName}.</p>
          )}

          {folderError && <p className="mr-folder-error" role="alert">{folderError}</p>}

          {/* Folder list */}
          <div className="mr-folder-list">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => loadAssets(folder)}
                className={`mr-folder-item ${selectedFolder?.id === folder.id ? 'mr-folder-active' : ''}`}
              >
                <div className="mr-folder-item-left">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="mr-folder-name">{folder.name}</span>
                </div>
                <span className="mr-folder-count">{folder.assetCount}</span>
              </button>
            ))}
            {folders.length === 0 && (
              <div className="mr-no-folders">
                <p>No folders yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: folder contents (also the drop target for uploads) ── */}
        <div
          ref={contentRef}
          className="mr-content"
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {selectedFolder ? (
            <>
              <div className="mr-content-header" style={{ animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                <div className="mr-content-heading">
                  <h2 className="mr-content-title">{selectedFolder.name}</h2>
                  <p className="mr-content-subtitle">
                    {assets.length} item{assets.length !== 1 ? 's' : ''}
                    {folderBytes !== null && assets.length > 0 && <> · {formatBytes(folderBytes)}</>}
                  </p>
                </div>
                <div className="mr-content-header-actions">
                  {canCreateFolder && (
                    <ActionMenu
                      label="Folder options"
                      items={[
                        {
                          label: 'Rename folder',
                          disabled: busyMessage !== null,
                          onSelect: () => { setRenameError(''); setRenameOpen(true); },
                          icon: (
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 8 18l1.464-4.536z" />
                            </svg>
                          ),
                        },
                        {
                          label: 'Delete folder',
                          danger: true,
                          disabled: busyMessage !== null,
                          onSelect: () => setFolderToDelete(selectedFolder),
                          icon: (
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          ),
                        },
                      ]}
                    />
                  )}
                  <button type="button" onClick={() => fileRef.current?.click()} className="mr-btn-upload">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Media
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_UPLOAD_TYPES.join(',')}
                  onChange={handleFilePick}
                  style={{ display: 'none' }}
                />
              </div>

              {(assets.length > 0 || aiResults) && (
                <AssetToolbar
                  search={searchBox}
                  arrange={!aiResults}
                  view={view}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  typeFilter={typeFilter}
                  typeCounts={typeCounts}
                  onViewChange={setView}
                  onSortChange={setSort}
                  onTypeFilterChange={setTypeFilter}
                />
              )}

              {aiResults && (
                <div className="mr-results-line">
                  <span>Best matches for <strong>“{aiDescription.trim()}”</strong>, ranked by AI</span>
                  <button type="button" className="mr-link-btn" onClick={clearRecommendation}>Clear results</button>
                </div>
              )}
              {isFiltering && (
                <div className="mr-results-line">
                  <span>Showing {visibleAssets.length} of {assets.length}</span>
                  <button type="button" className="mr-link-btn" onClick={() => { setQuery(''); setTypeFilter('all'); }}>Clear filters</button>
                </div>
              )}

              {notice && (
                <div className={`mr-asset-error ${notice.tone === 'info' ? 'mr-notice-info' : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
                  <div>
                    <span>{notice.text}</span>
                    {notice.details && (
                      <ul className="mr-notice-list">
                        {notice.details.map(d => <li key={d}>{d}</li>)}
                      </ul>
                    )}
                  </div>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
                </div>
              )}

              {visibleAssets.length > 0 && (
                <AssetCollection
                  assets={visibleAssets}
                  view={aiResults ? 'large' : view}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSortChange={aiResults ? undefined : setSort}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAllVisible}
                  onOpen={asset => setPreviewId(asset.id)}
                  annotations={annotations}
                  onCaption={openCaptionStudio}
                  onUseInPost={asset => startPostWith([asset])}
                  onDelete={setAssetToDelete}
                />
              )}

              {assetsLoading && (
                <div className="mr-assets-empty" role="status">
                  <p className="mr-assets-empty-text">Loading media…</p>
                </div>
              )}
              {!assetsLoading && assets.length > 0 && visibleAssets.length === 0 && !aiResults && (
                <div className="mr-assets-empty">
                  <p className="mr-assets-empty-title">No files match</p>
                  <p className="mr-assets-empty-text">Try a different name or file type.</p>
                </div>
              )}
              {!assetsLoading && assets.length === 0 && (
                <button type="button" className="mr-assets-empty mr-dropzone" onClick={() => fileRef.current?.click()}>
                  <span className="mr-assets-empty-icon">
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </span>
                  <span className="mr-assets-empty-title">No media yet</span>
                  <span className="mr-assets-empty-text">Drag files here, or click to upload (JPG, PNG, WebP, MP4)</span>
                </button>
              )}

              {selectedIds.size > 0 && (
                <BulkActionBar
                  count={selectedIds.size}
                  visibleCount={visibleAssets.length}
                  allVisibleSelected={allVisibleSelected}
                  postProblem={postSelectionProblem(selectedAssets)}
                  deleting={bulkDeleting}
                  onSelectAll={selectAllVisible}
                  onClear={clearSelection}
                  onCaption={() => proceedToCaptionStudio(selectedAssets)}
                  onCreatePost={() => startPostWith(selectedAssets)}
                  onDelete={() => setBulkDeleteOpen(true)}
                />
              )}
            </>
          ) : (
            <div className="mr-no-selection">
              <div className="mr-no-selection-icon">
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="mr-no-selection-title">Select a folder</h3>
              <p className="mr-no-selection-text">Choose a folder from the sidebar to view media assets</p>
            </div>
          )}
        </div>
      </div>

      {/* Portaled to <body> so they sit above the dashboard sidebar's own stacking context */}
      {createPortal(
        <>
        {/* Blocking loader: keeps the page unclickable while a folder is being deleted */}
        {busyMessage && (
          <div className="mr-busy-overlay" role="status" aria-live="polite">
            <div className="mr-busy-box">
              <svg className="mr-busy-spinner" width="44" height="44" viewBox="0 0 24 24" fill="none">
                <circle className="mr-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                <path className="mr-spinner-fill" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span>{busyMessage}</span>
            </div>
          </div>
        )}
        {dropRect && selectedFolder && (
          <div
            className="mr-drop-overlay"
            style={{ top: dropRect.top, left: dropRect.left, width: dropRect.width, height: dropRect.height }}
            aria-hidden="true"
          >
            <div className="mr-drop-box">
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Drop to upload to <strong>{selectedFolder.name}</strong></span>
            </div>
          </div>
        )}
        <UploadPanel
          items={uploads.items}
          folderNames={new Map(folders.map(f => [f.id, f.name]))}
          onRetry={uploads.retry}
          onDismiss={uploads.dismissFinished}
          raised={selectedIds.size > 0}
        />
        </>,
        document.body
      )}

      {previewIndex >= 0 && (
        <AssetPreview
          assets={visibleAssets}
          index={previewIndex}
          onNavigate={i => setPreviewId(visibleAssets[i]?.id ?? null)}
          onClose={() => setPreviewId(null)}
          onCaption={openCaptionStudio}
          onUseInPost={asset => startPostWith([asset])}
          onDelete={setAssetToDelete}
        />
      )}

      <FolderNameDialog
        open={createFolderOpen}
        mode="create"
        busy={creatingFolder}
        error={createFolderError}
        existingNames={folders.map(f => f.name)}
        destination={[activeOrg?.orgName ?? 'Personal workspace', pageName].filter(Boolean).join(' · ')}
        onCancel={() => { if (!creatingFolder) setCreateFolderOpen(false); }}
        onSubmit={(name, openAfter) => void createFolder(name, openAfter)}
      />

      <FolderNameDialog
        open={renameOpen && selectedFolder !== null}
        mode="rename"
        initialName={selectedFolder?.name ?? ''}
        busy={renaming}
        error={renameError}
        existingNames={folders.filter(f => f.id !== selectedFolder?.id).map(f => f.name)}
        destination={[activeOrg?.orgName ?? 'Personal workspace', pageName].filter(Boolean).join(' · ')}
        onCancel={() => { if (!renaming) setRenameOpen(false); }}
        onSubmit={name => void renameFolder(name)}
      />

      {/* Delete-folder confirmation */}
      <ConfirmDialog
        open={folderToDelete !== null}
        tone="danger"
        title={`Delete “${folderToDelete?.name ?? ''}”?`}
        description={folderToDelete && folderToDelete.assetCount > 0
          ? `This permanently deletes the folder and its ${folderToDelete.assetCount} file${folderToDelete.assetCount !== 1 ? 's' : ''}. This can't be undone.`
          : "This folder is empty. This can't be undone."}
        confirmLabel="Delete Folder"
        onCancel={() => setFolderToDelete(null)}
        onConfirm={() => void deleteFolder()}
      />

      <ConfirmDialog
        open={assetToDelete !== null}
        tone="danger"
        title={`Delete “${assetToDelete?.fileName ?? 'this file'}”?`}
        description="The file is permanently removed from your Media Repository. Files used by a draft or scheduled post can't be deleted until that post is published or changed. This can’t be undone."
        confirmLabel="Delete File"
        busyLabel="Deleting…"
        busy={deletingAsset}
        onCancel={() => { if (!deletingAsset) setAssetToDelete(null); }}
        onConfirm={() => void handleDeleteAsset()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        tone="danger"
        title={`Delete ${selectedAssets.length} file${selectedAssets.length !== 1 ? 's' : ''}?`}
        description="These files are permanently removed from your Media Repository. Any that are used by a draft or scheduled post — or that you don't have permission to delete — will be skipped. This can’t be undone."
        confirmLabel={`Delete ${selectedAssets.length} file${selectedAssets.length !== 1 ? 's' : ''}`}
        busyLabel="Deleting…"
        busy={bulkDeleting}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteOpen(false); }}
        onConfirm={() => void handleBulkDelete()}
      />

      <style>{`
        .mr-layout {
          display: flex;
          height: 100%;
          min-height: calc(100vh - 0px);
        }

        /* ── Sidebar ── */
        .mr-sidebar {
          width: 280px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          overflow-y: auto;
        }
        .mr-sidebar-header {
          margin-bottom: 16px;
        }
        .mr-sidebar-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #0C447C;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0 8px;
        }

        /* Create folder */
        .mr-create-folder {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 20px;
          padding-left: 8px;
        }
        .mr-create-folder-label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
        .mr-folder-input {
          width: 100%;
          height: 40px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.15s;
          font-family: inherit;
          background: #f8fafc;
          box-sizing: border-box;
        }
        .mr-folder-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
          background: #ffffff;
        }
        .mr-folder-input::placeholder { color: #94a3b8; }
        .mr-folder-input-invalid,
        .mr-folder-input-invalid:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.12);
        }

        /* Create-folder dialog */
        .mr-cf-copy { flex: 1; }
        .mr-cf-destination {
          margin: 4px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: #64748b;
          overflow-wrap: anywhere;
        }
        .mr-cf-destination strong { color: #334155; font-weight: 600; }
        .mr-cf-close {
          width: 32px; height: 32px;
          margin: -4px -6px 0 0;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s;
        }
        .mr-cf-close:hover:not(:disabled) { background: #f1f5f9; color: #334155; }
        .mr-cf-close:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
        .mr-cf-field { margin-top: 20px; }
        .mr-cf-label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
        .mr-cf-meta {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          min-height: 18px;
          margin-top: 6px;
          font-size: 12px;
        }
        .mr-cf-warning {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #b45309;
          font-weight: 500;
        }
        .mr-cf-counter { color: #94a3b8; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .mr-cf-counter-near { color: #b45309; font-weight: 600; }
        .mr-cf-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }
        .mr-cf-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
          cursor: pointer;
          user-select: none;
        }
        .mr-cf-check input { width: 16px; height: 16px; accent-color: #0C447C; cursor: pointer; }
        .mr-cf-actions { display: flex; gap: 10px; margin-left: auto; }
        .mr-folder-add-btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
        .mr-folder-add-btn {
          width: 38px; height: 38px;
          border: none;
          background: #0C447C;
          color: #fff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .mr-folder-add-btn:hover:not(:disabled) { background: #0a3867; }
        .mr-folder-add-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .mr-folder-error {
          font-size: 12px;
          color: #b91c1c;
          line-height: 1.5;
          margin: -8px 0 16px;
          padding: 0 8px;
        }

        /* Blocking loader */
        .mr-busy-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(2,6,23,0.45);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: wait;
        }
        .mr-busy-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 28px 36px;
          background: #ffffff;
          color: #0C447C;
          font-size: 14px;
          font-weight: 600;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.25);
        }
        .mr-busy-spinner { animation: spin 0.8s linear infinite; }
        .mr-folder-restricted-hint {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.5;
          padding: 8px;
          margin: 0 0 20px;
        }

        /* Folder list */
        .mr-folder-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .mr-folder-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          text-align: left;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
        }
        .mr-folder-item:hover {
          background: #f8fafc;
          border-color: #f1f5f9;
          color: #0f172a;
        }
        .mr-folder-active {
          background: rgba(12,68,124,0.06) !important;
          border-color: rgba(12,68,124,0.1) !important;
          color: #0C447C !important;
          font-weight: 600 !important;
        }
        .mr-folder-item-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .mr-folder-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mr-folder-count {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 10px;
          flex-shrink: 0;
        }
        .mr-folder-active .mr-folder-count {
          background: rgba(12,68,124,0.1);
          color: #0C447C;
        }
        .mr-no-folders {
          text-align: center;
          padding: 24px 8px;
          color: #94a3b8;
          font-size: 13px;
        }

        /* ── Content area ── */
        .mr-content {
          flex: 1;
          padding: 28px 32px;
          overflow-y: auto;
        }
        .mr-content-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .mr-content-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .mr-content-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }
        .mr-content-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .mr-asset-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px 16px;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          border-radius: 12px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
          font-weight: 500;
        }
        .mr-asset-error button {
          width: 28px; height: 28px;
          flex-shrink: 0;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: inherit;
          font-size: 18px;
          cursor: pointer;
        }
        .mr-asset-error button:hover { background: rgba(239,68,68,0.1); }
        .mr-asset-error.mr-notice-info {
          border-color: #bfdbfe;
          border-left-color: #3b82f6;
          background: #eff6ff;
          color: #1e3a8a;
        }
        .mr-asset-error.mr-notice-info button:hover { background: rgba(59,130,246,0.12); }
        .mr-notice-list { margin: 6px 0 0; padding-left: 18px; font-weight: 400; line-height: 1.6; }
        .mr-ai-error { margin: 6px 0 0; font-size: 12px; color: #b91c1c; }

        /* Search: file name or AI match */
        .mr-search {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 3px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .mr-search:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .mr-search-ai { border-color: rgba(12,68,124,0.25); background: linear-gradient(135deg, rgba(12,68,124,0.03), rgba(59,130,246,0.04)); }
        .mr-search-modes { display: inline-flex; flex-shrink: 0; padding: 2px; border-radius: 8px; background: #f1f5f9; }
        .mr-search-mode {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 26px;
          padding: 0 9px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
        }
        .mr-search-mode[aria-checked="true"] { background: #ffffff; color: #0C447C; box-shadow: 0 1px 3px rgba(15,23,42,0.1); }
        .mr-search-mode:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
        .mr-search-input {
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 0 6px;
          border: none;
          outline: none;
          background: transparent;
          color: #0f172a;
          font-size: 13px;
          font-family: inherit;
        }
        .mr-search-input::placeholder { color: #94a3b8; }
        .mr-search-go {
          height: 30px;
          flex-shrink: 0;
          padding: 0 14px;
          border: none;
          border-radius: 8px;
          background: #0C447C;
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          white-space: nowrap;
          cursor: pointer;
        }
        .mr-search-go:hover:not(:disabled) { background: #0a3867; }
        .mr-search-go:disabled { opacity: 0.5; cursor: not-allowed; }

        .mr-results-line {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: -4px 0 14px;
          font-size: 13px;
          color: #64748b;
        }
        .mr-results-line strong { color: #0f172a; font-weight: 600; }
        .mr-link-btn {
          padding: 0;
          border: none;
          background: none;
          color: #0C447C;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }
        .mr-link-btn:hover { text-decoration: underline; }

        /* Drag-and-drop upload */
        .mr-drop-overlay {
          position: fixed;
          z-index: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          pointer-events: none;
          background: rgba(12,68,124,0.08);
          animation: fadeIn 0.12s ease-out;
        }
        .mr-drop-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 100%;
          border: 2px dashed #0C447C;
          border-radius: 18px;
          background: rgba(255,255,255,0.88);
          color: #0C447C;
          font-size: 15px;
        }
        .mr-dropzone {
          width: 100%;
          margin-top: 8px;
          border: 2px dashed #cbd5e1;
          border-radius: 18px;
          background: #ffffff;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .mr-dropzone:hover { border-color: #0C447C; background: rgba(12,68,124,0.02); }
        .mr-dropzone:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
        .mr-ai-score-badge {
          position: absolute;
          top: 10px; left: 10px;
          background: rgba(12,68,124,0.85);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          z-index: 1;
        }
        .mr-asset-card-ranked { border-color: rgba(12,68,124,0.18); }
        .mr-asset-info-reason { flex-direction: column; align-items: flex-start; gap: 4px; }
        .mr-ai-reason {
          font-size: 11px;
          color: #64748b;
          margin: 0;
          line-height: 1.4;
        }

        .mr-btn-upload {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #059669;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(5,150,105,0.2);
          font-family: inherit;
          flex-shrink: 0;
        }
        .mr-btn-upload:hover:not(:disabled) { background: #047857; }
        .mr-btn-upload:disabled { opacity: 0.7; cursor: not-allowed; }
        .mr-spinner { animation: spin 0.8s linear infinite; }
        .mr-spinner-track { opacity: 0.25; }
        .mr-spinner-fill { opacity: 0.75; }

        /* Asset grid */
        .mr-assets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .mr-asset-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) backwards;
        }
        .mr-asset-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .mr-asset-preview {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          overflow: hidden;
          background: #f1f5f9;
        }
        .mr-asset-preview img,
        .mr-asset-preview video {
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
        .mr-asset-card:hover .mr-asset-preview img,
        .mr-asset-card:hover .mr-asset-preview video {
          transform: scale(1.05);
        }
        .mr-asset-info {
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .mr-asset-name {
          font-size: 12px;
          font-weight: 500;
          color: #334155;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .mr-asset-type {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
          flex-shrink: 0;
          letter-spacing: 0.04em;
        }

        /* Empty states */
        .mr-assets-empty {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 64px 24px;
          text-align: center;
        }
        .mr-assets-empty-icon {
          width: 64px; height: 64px;
          background: linear-gradient(135deg, rgba(12,68,124,0.06), rgba(59,130,246,0.06));
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 16px;
        }
        .mr-assets-empty-title {
          font-size: 16px;
          font-weight: 700;
          color: #334155;
          margin: 0 0 6px;
        }
        .mr-assets-empty-text {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .mr-no-selection {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .mr-no-selection-icon {
          width: 80px; height: 80px;
          background: linear-gradient(135deg, rgba(12,68,124,0.04), rgba(59,130,246,0.06));
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
          margin-bottom: 20px;
        }
        .mr-no-selection-title {
          font-size: 18px;
          font-weight: 700;
          color: #334155;
          margin: 0 0 8px;
        }
        .mr-no-selection-text {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }

        @media (max-width: 768px) {
          .mr-layout { flex-direction: column; }
          .mr-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #e2e8f0; max-height: 300px; }
          .mr-content { padding: 20px; }
          .mr-assets-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        }
      `}</style>
    </>
  );
}

const FOLDER_NAME_MAX = 100;

interface FolderNameDialogProps {
  open: boolean;
  mode: 'create' | 'rename';
  /** Rename only: the folder's current name, pre-filled. */
  initialName?: string;
  busy: boolean;
  error: string;
  /** Names already used in this repository (excluding the folder being renamed), for the live duplicate check. */
  existingNames: string[];
  /** Where the folder lives, e.g. "CS Society · CS Society Page". */
  destination: string;
  onCancel: () => void;
  onSubmit: (name: string, openAfter: boolean) => void;
}

/** Create / rename folder popup: labelled name field, live validation, and a confirm / Cancel pair. */
function FolderNameDialog({ open, ...props }: FolderNameDialogProps) {
  // Mounted only while open, so each opening starts from a fresh name.
  return open ? <FolderNameDialogContent {...props} /> : null;
}

function FolderNameDialogContent({
  mode, initialName = '', busy, error, existingNames, destination, onCancel, onSubmit,
}: Omit<FolderNameDialogProps, 'open'>) {
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [openAfter, setOpenAfter] = useState(true);
  const dialogRef = useDialog<HTMLDivElement>({ open: true, onClose: onCancel, canClose: !busy, initialFocusRef: inputRef });
  const isRename = mode === 'rename';

  const trimmed = name.trim();
  const isDuplicate = trimmed !== '' && existingNames.some(n => n.trim().toLowerCase() === trimmed.toLowerCase());
  const nearLimit = name.length >= FOLDER_NAME_MAX - 10;
  const unchanged = isRename && trimmed === initialName.trim();
  const canSubmit = !busy && trimmed !== '' && !isDuplicate && !unchanged;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit(name, openAfter);
  };

  return createPortal(
    <div className="ug-dialog-backdrop" onClick={() => !busy && onCancel()}>
      <div
        ref={dialogRef}
        className="ug-dialog ug-dialog-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="ug-dialog-body">
            <div className="ug-dialog-icon ug-dialog-icon-primary" aria-hidden="true">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ug-dialog-copy mr-cf-copy">
              <h2 id={titleId} className="ug-dialog-title">{isRename ? 'Rename Folder' : 'Create New Folder'}</h2>
              <p id={descId} className="mr-cf-destination">
                {isRename ? <>In <strong>{destination}</strong></> : <>Add a folder to <strong>{destination}</strong></>}
              </p>
            </div>
            <button type="button" className="mr-cf-close" onClick={onCancel} disabled={busy} aria-label="Close">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mr-cf-field">
            <label htmlFor={inputId} className="mr-cf-label">Folder name</label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              placeholder="e.g. Orientation 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={busy}
              maxLength={FOLDER_NAME_MAX}
              autoComplete="off"
              className={`mr-folder-input ${isDuplicate ? 'mr-folder-input-invalid' : ''}`}
              aria-invalid={isDuplicate || Boolean(error) || undefined}
              aria-describedby={hintId}
            />
            <div id={hintId} className="mr-cf-meta">
              <span className="mr-cf-warning" aria-live="polite">
                {isDuplicate && (
                  <>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    A folder with this name already exists
                  </>
                )}
              </span>
              <span className={`mr-cf-counter ${nearLimit ? 'mr-cf-counter-near' : ''}`}>
                {name.length}/{FOLDER_NAME_MAX}
              </span>
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

          <div className="mr-cf-footer">
            {!isRename && (
              <label className="mr-cf-check">
                <input
                  type="checkbox"
                  checked={openAfter}
                  onChange={e => setOpenAfter(e.target.checked)}
                  disabled={busy}
                />
                <span>Open folder after creating</span>
              </label>
            )}
            <div className="mr-cf-actions">
              <button type="button" className="ug-btn ug-btn-secondary" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="ug-btn ug-btn-primary" disabled={!canSubmit}>
                {busy && <span className="ug-spinner" aria-hidden="true" />}
                {busy && (isRename ? 'Renaming…' : 'Creating…')}
                {!busy && (isRename ? 'Rename' : 'Create')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
