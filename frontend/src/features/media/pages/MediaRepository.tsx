// features/media/pages/MediaRepository.tsx
import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { mediaApi } from '../api/mediaApi.ts';
import type { MediaFolder, MediaAsset } from '../../../types';

export default function MediaRepository() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFolders = async () => {
    const data = await mediaApi.getFolders();
    setFolders(data);
  };

  useEffect(() => { loadFolders(); }, []);

  const loadAssets = async (folder: MediaFolder) => {
    setSelectedFolder(folder);
    const data = await mediaApi.getAssets(folder.id);
    setAssets(data);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder = await mediaApi.createFolder(newFolderName.trim());
    setFolders(prev => [...prev, folder]);
    setNewFolderName('');
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolder || !e.target.files?.length) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const asset = await mediaApi.uploadAsset(selectedFolder.id, file);
        setAssets(prev => [...prev, asset]);
      }
      loadFolders(); // refresh asset count
    } finally {
      setIsUploading(false);
    }
  };

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

          {/* Create folder */}
          <div className="mr-create-folder">
            <input
              type="text"
              placeholder="New folder name..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              className="mr-folder-input"
            />
            <button onClick={createFolder} className="mr-folder-add-btn" aria-label="Create folder">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

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

        {/* ── Right: Asset grid ── */}
        <div className="mr-content">
          {selectedFolder ? (
            <>
              <div className="mr-content-header" style={{ animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                <div>
                  <div className="mr-content-breadcrumb">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>{selectedFolder.name}</span>
                  </div>
                  <h2 className="mr-content-title">{selectedFolder.name}</h2>
                  <p className="mr-content-subtitle">{assets.length} asset{assets.length !== 1 ? 's' : ''} in this folder</p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={isUploading}
                  className="mr-btn-upload"
                >
                  {isUploading ? (
                    <>
                      <svg className="mr-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle className="mr-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path className="mr-spinner-fill" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Media
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/jpg,image/jpeg,image/png,image/webp,video/mp4"
                  onChange={handleUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="mr-assets-grid">
                {assets.map((asset, i) => (
                  <div key={asset.id} className="mr-asset-card" style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className="mr-asset-preview">
                      {asset.fileType.startsWith('image') ? (
                        <img src={asset.fileUrl} alt={asset.fileName} />
                      ) : (
                        <video src={asset.fileUrl} aria-label={asset.fileName}>
                          <track kind="captions" label="Preview captions" srcLang="en" src="" />
                        </video>
                      )}
                      {/* Hover overlay */}
                      <div className="mr-asset-overlay">
                        <button
                          onClick={() => navigator.clipboard.writeText(asset.fileUrl)}
                          className="mr-overlay-btn"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          Copy URL
                        </button>
                        <button
                          onClick={() => navigate(`/caption/select-tone?imageUrl=${encodeURIComponent(asset.fileUrl)}`)}
                          className="mr-overlay-btn mr-overlay-btn-primary"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          Caption Studio
                        </button>
                      </div>
                    </div>
                    <div className="mr-asset-info">
                      <p className="mr-asset-name">{asset.fileName}</p>
                      <span className="mr-asset-type">{asset.fileType.split('/')[1]?.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
                {assets.length === 0 && (
                  <div className="mr-assets-empty">
                    <div className="mr-assets-empty-icon">
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="mr-assets-empty-title">No media yet</p>
                    <p className="mr-assets-empty-text">Upload files to get started</p>
                  </div>
                )}
              </div>
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
          gap: 8px;
          margin-bottom: 20px;
        }
        .mr-folder-input {
          flex: 1;
          height: 38px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 13px;
          color: #0f172a;
          outline: none;
          transition: all 0.15s;
          font-family: inherit;
          background: #f8fafc;
        }
        .mr-folder-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
          background: #ffffff;
        }
        .mr-folder-input::placeholder { color: #94a3b8; }
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
        .mr-folder-add-btn:hover { background: #0a3867; }

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
          margin-bottom: 28px;
        }
        .mr-content-breadcrumb {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #0C447C;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 6px;
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
        .mr-asset-overlay {
          position: absolute;
          inset: 0;
          background: rgba(2,6,23,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .mr-asset-card:hover .mr-asset-overlay { opacity: 1; }
        .mr-overlay-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          backdrop-filter: blur(8px);
        }
        .mr-overlay-btn:hover { background: rgba(255,255,255,0.2); }
        .mr-overlay-btn-primary {
          background: rgba(12,68,124,0.7);
          border-color: rgba(59,130,246,0.3);
        }
        .mr-overlay-btn-primary:hover {
          background: rgba(12,68,124,0.9);
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