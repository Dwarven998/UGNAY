import type { Post, Tone } from '../../types';
import { isTone } from '../caption/toneOptions';

/** Something other screens hand to the post composer (Duplicate, "Use in post", Caption Studio). */
export interface ComposerPrefill {
  media: { id: string; url: string }[];
  caption: string;
  hashtags: string[];
  tone: Tone;
  /** Wizard step to open on: 0 Content, 1 Caption, 2 Preview, 3 Publish. */
  step: number;
  scheduledAt: Date | null;
  source: 'caption-studio' | 'duplicate' | 'media' | null;
}

const PREFILL_KEY = 'composer_prefill';
/** Written by Caption Studio ("Use in New Post"); kept under its original key for compatibility. */
const CAPTION_DRAFT_KEY = 'caption_draft';

/** Hashtags are stored with their leading "#" — the publisher joins them into the message as-is. */
export function normalizeHashtags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const cleaned = raw.trim().replace(/^#+/, '').replace(/\s+/g, '');
    if (!cleaned) continue;
    const tag = `#${cleaned}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export function writeComposerPrefill(prefill: Partial<Omit<ComposerPrefill, 'scheduledAt'>> & { scheduledAt?: string | null }) {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    // Storage unavailable — the composer simply opens empty.
  }
}

/** Prefill for re-using an existing post (Duplicate): same content, no schedule. */
export function prefillFromPost(post: Post) {
  const urls = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : (post.mediaUrl ? [post.mediaUrl] : []);
  const ids = post.mediaAssetIds ?? [];
  const count = Math.max(urls.length, ids.length);
  const media = Array.from({ length: count }, (_, i) => ({ id: ids[i] ?? '', url: urls[i] ?? '' }))
    .filter(item => item.id || item.url);
  writeComposerPrefill({
    media,
    caption: post.caption,
    hashtags: post.hashtags ?? [],
    tone: isTone(post.tone) ? post.tone : 'FORMAL',
    step: 1,
    source: 'duplicate',
  });
}

function parse<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Reads (without clearing) whatever was handed to the composer. Call `clearComposerPrefill` once consumed. */
export function readComposerPrefill(dateParam: string | null): ComposerPrefill {
  const base: ComposerPrefill = {
    media: [], caption: '', hashtags: [], tone: 'FORMAL', step: 0, scheduledAt: null, source: null,
  };

  const fromDate = dateParam ? new Date(dateParam) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) base.scheduledAt = fromDate;

  const captionDraft = parse<{
    caption?: string; hashtags?: string[]; tone?: string;
    imageUrl?: string; imageUrls?: string[]; assetId?: string; assetIds?: string[];
  }>(CAPTION_DRAFT_KEY);
  if (captionDraft) {
    const urls = captionDraft.imageUrls?.length ? captionDraft.imageUrls : (captionDraft.imageUrl ? [captionDraft.imageUrl] : []);
    const ids = captionDraft.assetIds?.length ? captionDraft.assetIds : (captionDraft.assetId ? [captionDraft.assetId] : []);
    const count = Math.max(urls.length, ids.length);
    return {
      ...base,
      media: Array.from({ length: count }, (_, i) => ({ id: ids[i] ?? '', url: urls[i] ?? '' })).filter(m => m.id || m.url),
      caption: captionDraft.caption ?? '',
      hashtags: normalizeHashtags(captionDraft.hashtags ?? []),
      tone: isTone(captionDraft.tone) ? captionDraft.tone : 'FORMAL',
      // The caption was already written in Caption Studio — pick up at the preview.
      step: 2,
      source: 'caption-studio',
    };
  }

  const prefill = parse<Partial<Omit<ComposerPrefill, 'scheduledAt'>> & { scheduledAt?: string | null }>(PREFILL_KEY);
  if (prefill) {
    return {
      ...base,
      media: (prefill.media ?? []).filter(m => m && (m.id || m.url)),
      caption: prefill.caption ?? '',
      hashtags: normalizeHashtags(prefill.hashtags ?? []),
      tone: isTone(prefill.tone) ? prefill.tone : 'FORMAL',
      step: typeof prefill.step === 'number' ? Math.min(Math.max(prefill.step, 0), 3) : 0,
      source: prefill.source ?? null,
    };
  }

  return base;
}

export function clearComposerPrefill() {
  try {
    sessionStorage.removeItem(PREFILL_KEY);
    sessionStorage.removeItem(CAPTION_DRAFT_KEY);
  } catch {
    // ignore
  }
}
