// features/media/components/useUploadQueue.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '../../../types';
import { mediaApi } from '../api/mediaApi.ts';
import { ACCEPTED_UPLOAD_TYPES } from './assetView';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  key: number;
  folderId: string;
  name: string;
  /** 0–100 */
  progress: number;
  status: UploadStatus;
  error?: string;
}

const CONCURRENCY = 3;

/**
 * Per-file upload queue with progress. Up to three files go up at once; a failed file can be retried
 * without re-picking it. `onUploaded` fires per finished file, `onSettled` once a batch is done.
 */
export function useUploadQueue(onUploaded: (folderId: string, asset: MediaAsset) => void, onSettled: (folderId: string) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const nextKey = useRef(1);
  const files = useRef(new Map<number, File>());
  const callbacks = useRef({ onUploaded, onSettled });
  useEffect(() => {
    callbacks.current = { onUploaded, onSettled };
  });

  const patch = useCallback((key: number, change: Partial<UploadItem>) => {
    setItems(prev => prev.map(item => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const run = useCallback((folderId: string, keys: number[]) => {
    let cursor = 0;
    const worker = async () => {
      while (cursor < keys.length) {
        const key = keys[cursor++];
        const file = files.current.get(key);
        if (!file) continue;
        patch(key, { status: 'uploading', progress: 0, error: undefined });
        let lastPercent = 0;
        try {
          const asset = await mediaApi.uploadAsset(folderId, file, fraction => {
            const percent = Math.round(fraction * 100);
            // Only re-render on whole-percent changes; progress events fire far more often.
            if (percent !== lastPercent) {
              lastPercent = percent;
              patch(key, { progress: percent });
            }
          });
          patch(key, { status: 'done', progress: 100 });
          files.current.delete(key);
          callbacks.current.onUploaded(folderId, asset);
        } catch (err) {
          patch(key, { status: 'error', error: err instanceof Error && err.message ? err.message : 'Upload failed.' });
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker))
      .then(() => callbacks.current.onSettled(folderId));
  }, [patch]);

  const enqueue = useCallback((folderId: string, picked: File[]) => {
    const added: UploadItem[] = [];
    const runnable: number[] = [];
    for (const file of picked) {
      const key = nextKey.current++;
      if (ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
        files.current.set(key, file);
        runnable.push(key);
        added.push({ key, folderId, name: file.name, progress: 0, status: 'queued' });
      } else {
        added.push({ key, folderId, name: file.name, progress: 0, status: 'error', error: 'Unsupported type — use JPG, PNG, WebP or MP4.' });
      }
    }
    setItems(prev => [...prev, ...added]);
    if (runnable.length > 0) run(folderId, runnable);
  }, [run]);

  const retry = useCallback((item: UploadItem) => {
    if (!files.current.has(item.key)) return;
    run(item.folderId, [item.key]);
  }, [run]);

  /** Clears finished and failed rows. */
  const dismissFinished = useCallback(() => {
    setItems(prev => prev.filter(i => i.status === 'queued' || i.status === 'uploading'));
  }, []);

  return { items, enqueue, retry, dismissFinished };
}
