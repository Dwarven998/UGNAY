// features/media/components/assetView.ts — view/sort options, preferences, sorting and formatting for AssetBrowser
import { useEffect, useState } from 'react';
import type { MediaAsset } from '../../../types';

export type ViewMode = 'xl' | 'large' | 'medium' | 'small' | 'list' | 'details';
export type SortKey = 'name' | 'date' | 'type' | 'size';
export type SortDir = 'asc' | 'desc';

export const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'xl', label: 'Extra large icons' },
  { value: 'large', label: 'Large icons' },
  { value: 'medium', label: 'Medium icons' },
  { value: 'small', label: 'Small icons' },
  { value: 'list', label: 'List' },
  { value: 'details', label: 'Details' },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date uploaded' },
  { value: 'type', label: 'Type' },
  { value: 'size', label: 'Size' },
];

/** Text sorts start A→Z; date and size start newest / largest first. */
export const defaultSortDir = (key: SortKey): SortDir => (key === 'date' || key === 'size' ? 'desc' : 'asc');

// ── Preferences (per browser; only a convenience, so storage failures fall back to defaults) ──

const PREFS_KEY = 'ugnay.media.viewPrefs';
const DEFAULT_PREFS = { view: 'large' as ViewMode, sortKey: 'date' as SortKey, sortDir: 'desc' as SortDir };

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<typeof DEFAULT_PREFS>;
    return {
      view: VIEW_OPTIONS.some(o => o.value === raw.view) ? raw.view! : DEFAULT_PREFS.view,
      sortKey: SORT_OPTIONS.some(o => o.value === raw.sortKey) ? raw.sortKey! : DEFAULT_PREFS.sortKey,
      sortDir: raw.sortDir === 'asc' || raw.sortDir === 'desc' ? raw.sortDir : DEFAULT_PREFS.sortDir,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useMediaViewPrefs() {
  const [prefs, setPrefs] = useState(readPrefs);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Private mode / blocked storage: the choice just won't be remembered.
    }
  }, [prefs]);
  return {
    ...prefs,
    setView: (view: ViewMode) => setPrefs(p => ({ ...p, view })),
    setSort: (sortKey: SortKey, sortDir: SortDir) => setPrefs(p => ({ ...p, sortKey, sortDir })),
  };
}

// ── Sorting & formatting ──

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const typeLabel = (a: MediaAsset) => a.fileType.split('/')[1]?.toUpperCase() ?? '';
const uploadedAt = (a: MediaAsset) => (a.createdAt ? Date.parse(a.createdAt) : Number.NaN);

/** Sorts a copy. Missing dates/sizes (older uploads) always go last; ties fall back to name. */
export function sortAssets(assets: MediaAsset[], key: SortKey, dir: SortDir): MediaAsset[] {
  const sign = dir === 'asc' ? 1 : -1;
  const byName = (a: MediaAsset, b: MediaAsset) => nameCollator.compare(a.fileName, b.fileName);
  const byNumber = (pick: (a: MediaAsset) => number) => (a: MediaAsset, b: MediaAsset) => {
    const x = pick(a);
    const y = pick(b);
    const xMissing = !Number.isFinite(x);
    const yMissing = !Number.isFinite(y);
    if (xMissing || yMissing) return xMissing === yMissing ? byName(a, b) : xMissing ? 1 : -1;
    return x === y ? byName(a, b) : (x - y) * sign;
  };
  const compare: Record<SortKey, (a: MediaAsset, b: MediaAsset) => number> = {
    name: (a, b) => byName(a, b) * sign,
    type: (a, b) => nameCollator.compare(typeLabel(a), typeLabel(b)) * sign || byName(a, b),
    date: byNumber(uploadedAt),
    size: byNumber(a => a.fileSize ?? Number.NaN),
  };
  return [...assets].sort(compare[key]);
}

export function formatBytes(bytes?: number | null) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export function formatDate(iso?: string | null) {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(time) ? dateFormat.format(time) : '—';
}

// ── Filtering & selection rules ──

export type TypeFilter = 'all' | 'image' | 'video';

export const isImageAsset = (a: Pick<MediaAsset, 'fileType'>) => a.fileType.startsWith('image');
export const isVideoAsset = (a: Pick<MediaAsset, 'fileType'>) => a.fileType.startsWith('video');

/** Case-insensitive file-name search plus the All / Images / Videos filter. */
export function filterAssets(assets: MediaAsset[], query: string, type: TypeFilter): MediaAsset[] {
  const q = query.trim().toLowerCase();
  return assets.filter(a =>
    (type === 'all' || (type === 'image' ? isImageAsset(a) : isVideoAsset(a)))
    && (!q || a.fileName.toLowerCase().includes(q)));
}

/** Caption Studio and the post composer take up to this many images (mirror GeminiClient.MAX_CAPTION_IMAGES). */
export const MAX_POST_IMAGES = 6;

/** Why the selection can't go to Caption Studio / Create Post, or null when it can. */
export function postSelectionProblem(selected: MediaAsset[]): string | null {
  if (selected.length === 0) return 'Select at least one image.';
  if (selected.some(a => !isImageAsset(a))) return 'Only images can be captioned or posted — deselect videos first.';
  if (selected.length > MAX_POST_IMAGES) return `Select up to ${MAX_POST_IMAGES} images for one post.`;
  return null;
}

/** Total bytes, or null when any file predates size tracking (a partial total would mislead). */
export function totalSize(assets: MediaAsset[]): number | null {
  let sum = 0;
  for (const a of assets) {
    if (a.fileSize == null) return null;
    sum += a.fileSize;
  }
  return sum;
}

/** Supabase serves a public object as an attachment when `?download=<name>` is added; other URLs download as-is. */
export function downloadHref(asset: MediaAsset): string {
  if (!asset.fileUrl.includes('/storage/v1/object/public/')) return asset.fileUrl;
  return `${asset.fileUrl}${asset.fileUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(asset.fileName)}`;
}

/** Files the upload picker and drag-and-drop accept. */
export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
