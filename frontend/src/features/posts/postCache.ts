import type { Post } from '../../types';

/*
 * Last loaded data per workspace + Facebook Page (the FacebookConnectionContext scopeKey). Screens show it
 * immediately and refresh it in the background, so moving between Dashboard, Posts and Calendar — or
 * reloading the tab — doesn't sit on a loading skeleton while the same data is fetched again.
 *
 * Kept in memory and mirrored to sessionStorage (this tab only, gone when it closes, cleared on sign-out).
 * The server remains the source of truth: every screen still refetches on mount.
 */

const STORAGE_PREFIX = 'ugnay_cache_';
const memory = new Map<string, unknown>();

function read<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const value = JSON.parse(raw) as T;
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  memory.set(key, value);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the in-memory copy still helps within this visit.
  }
}

export const scopedCache = {
  get: <T>(kind: string, scopeKey: string) => read<T>(`${kind}:${scopeKey}`),
  set: (kind: string, scopeKey: string, value: unknown) => write(`${kind}:${scopeKey}`, value),
  /** Forget everything, e.g. on sign-out, so the next account never sees the previous one's data. */
  clear: () => {
    memory.clear();
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  },
};

export const postCache = {
  getPosts: (scopeKey: string) => scopedCache.get<Post[]>('posts', scopeKey),
  setPosts: (scopeKey: string, posts: Post[]) => scopedCache.set('posts', scopeKey, posts),
  getPictures: (scopeKey: string) => scopedCache.get<Record<string, string>>('pictures', scopeKey),
  setPictures: (scopeKey: string, pictures: Record<string, string>) => scopedCache.set('pictures', scopeKey, pictures),
};

/** The image to show for a post: its own media, else (once published) the picture Facebook has for it. */
export function postThumbnail(post: Post, pictures?: Record<string, string> | null): string | undefined {
  return post.mediaUrls?.[0] ?? post.mediaUrl ?? pictures?.[post.id] ?? undefined;
}
