// features/media/pages/MediaRepository.tsx
import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { mediaApi } from '../api/mediaApi.ts';
import type { MediaFolder, MediaAsset } from '../../../types';

export default function MediaRepository() {
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
    <div className="p-6 flex gap-6 h-full">
      {/* Left: Folder list */}
      <div className="w-64 flex-shrink-0 space-y-3">
        <h2 className="font-bold text-lg">Event Folders</h2>

        {/* Create folder */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New folder name..."
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFolder()}
            className="flex-1 border rounded px-3 py-1.5 text-sm"
          />
          <button onClick={createFolder}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
            +
          </button>
        </div>

        {/* Folder list */}
        <div className="space-y-1">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => loadAssets(folder)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between
                ${selectedFolder?.id === folder.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100'}`}
            >
              <span>📁 {folder.name}</span>
              <span className="opacity-60">{folder.assetCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Asset grid */}
      <div className="flex-1 space-y-4">
        {selectedFolder ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{selectedFolder.name}</h2>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                {isUploading ? 'Uploading...' : '⬆️ Upload Media'}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpg,image/jpeg,image/png,image/webp,video/mp4"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              {assets.map(asset => (
                <div key={asset.id}
                  className="border rounded-xl overflow-hidden group relative cursor-pointer">
                  {asset.fileType.startsWith('image') ? (
                    <img src={asset.fileUrl} alt={asset.fileName}
                      className="w-full h-36 object-cover" />
                  ) : (
                    <video src={asset.fileUrl}
                      className="w-full h-36 object-cover" />
                  )}
                  <div className="p-2">
                    <p className="text-xs text-gray-600 truncate">{asset.fileName}</p>
                  </div>
                  {/* Copy URL button */}
                  <button
                    onClick={() => navigator.clipboard.writeText(asset.fileUrl)}
                    className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    Copy URL
                  </button>
                </div>
              ))}
              {assets.length === 0 && (
                <div className="col-span-4 text-center py-16 text-gray-400">
                  No media yet. Upload files to get started.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a folder to view media assets
          </div>
        )}
      </div>
    </div>
  );
}