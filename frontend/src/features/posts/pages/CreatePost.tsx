import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/axiosClient';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useOrganization } from '../../../context/useOrganization';
import type { MediaAsset, Post, PostConflict, Tone } from '../../../types';
import { captionApi } from '../../caption/api/captionApi';
import { TONE_OPTIONS } from '../../caption/toneOptions';
import { mediaApi } from '../../media/api/mediaApi';
import { postApi, type PostUpsertPayload } from '../api/postApi';
import ConflictAlertBanner from '../components/ConflictAlertBanner';
import DateTimePickerPanel from '../components/DateTimePickerPanel';
import MediaLibraryPicker, { type ComposerMedia } from '../components/MediaLibraryPicker';
import { clearComposerPrefill, normalizeHashtags, readComposerPrefill } from '../composerHandoff';
import { useFacebookConnection } from '../hooks/useFacebookConnection';
import '../../../components/ui/dialog.css';
import '../posts.css';
import './createPost.css';

const STEPS = [
  { key: 'content', label: 'Content' },
  { key: 'caption', label: 'Caption' },
  { key: 'preview', label: 'Preview' },
  { key: 'publish', label: 'Publish' },
] as const;

const MAX_MEDIA = 10;
/** Mirrors GeminiClient.MAX_CAPTION_IMAGES — the AI looks at up to this many images at once. */
const MAX_AI_IMAGES = 6;

type When = 'now' | 'schedule' | 'draft';
type ResultKind = 'published' | 'scheduled' | 'pending' | 'draft' | 'failed';
interface Result { kind: ResultKind; post: Post; message?: string }
type AiBusy = null | 'generate' | 'rewrite' | 'hashtags' | number;

function getSuggestedTime() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(19, 0, 0, 0);
  return next;
}

const formatLongDate = (value: Date) =>
  value.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const formatTime = (value: Date) => value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** A scheduled time must leave the backend at least a minute to queue the post. */
const isTooSoon = (value: Date) => value.getTime() < Date.now() + 60_000;
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export default function CreatePost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeOrgId, activeOrg } = useOrganization();
  const facebook = useFacebookConnection();

  const [initial] = useState(() => readComposerPrefill(searchParams.get('date')));
  useEffect(() => { clearComposerPrefill(); }, []);

  const canModerate = activeOrg?.role === 'ADMIN' || activeOrg?.role === 'OFFICER';
  // Personal workspace, or officer/admin of the org: publish directly. Members' posts go through approval.
  const canPublishDirectly = !activeOrgId || canModerate;
  const canManageFacebook = !activeOrgId || canModerate;
  const workspaceName = activeOrg?.orgName ?? 'Personal Workspace';
  const pageName = facebook.pageName ?? 'your Facebook Page';

  const suggestedTime = useMemo(() => getSuggestedTime(), []);
  const [today] = useState(() => new Date());
  const [step, setStep] = useState(initial.step);
  const [media, setMedia] = useState<ComposerMedia[]>(initial.media);
  const [pickerIntent, setPickerIntent] = useState<null | 'upload' | 'library'>(null);
  const [caption, setCaption] = useState(initial.caption);
  const [hashtags, setHashtags] = useState<string[]>(initial.hashtags);
  const [hashtagInput, setHashtagInput] = useState('');
  const [tone, setTone] = useState<Tone>(initial.tone);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<AiBusy>(null);
  const [aiError, setAiError] = useState('');
  const [when, setWhen] = useState<When>(() => {
    if (initial.scheduledAt) return 'schedule';
    return canPublishDirectly ? 'now' : 'schedule';
  });
  const [scheduledAt, setScheduledAt] = useState<Date | null>(initial.scheduledAt ?? suggestedTime);
  const [scheduleError, setScheduleError] = useState('');
  const [captionError, setCaptionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [conflict, setConflict] = useState<PostConflict | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [confirmExit, setConfirmExit] = useState<null | 'exit' | 'connect'>(null);
  const [notice, setNotice] = useState('');
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Media belongs to one workspace's Media Library. Switching workspace mid-post drops it
  // (adjusted during render, so the previous workspace's images are never shown for the new one).
  const [composeOrgId, setComposeOrgId] = useState(activeOrgId);
  if (composeOrgId !== activeOrgId) {
    setComposeOrgId(activeOrgId);
    if (media.length > 0) {
      setMedia([]);
      setSuggestions([]);
      setNotice(`You switched to ${workspaceName}. Images from the previous workspace were removed from this post.`);
    }
    setPickerIntent(null);
    if (!(!activeOrgId || canModerate) && when === 'now') setWhen('schedule');
  }

  // Members can't publish directly; Facebook-less workspaces can only save drafts.
  const effectiveWhen: When = !facebook.connected ? 'draft' : (!canPublishDirectly && when === 'now' ? 'schedule' : when);

  const dirty = !result && (media.length > 0 || caption.trim().length > 0 || hashtags.length > 0);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Keyboard and screen-reader users land on the new step's heading.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    document.querySelector('.dash-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, result]);

  const attachableMedia = media.filter(item => item.id);
  const unattachedCount = media.length - attachableMedia.length;
  const imageUrls = media.map(item => item.url).filter(Boolean);

  /* ── Media ── */
  const toggleAsset = (asset: MediaAsset) => {
    setNotice('');
    setMedia(prev => {
      const exists = prev.some(item => (item.id && item.id === asset.id) || (item.url && item.url === asset.fileUrl));
      if (exists) return prev.filter(item => !(item.id === asset.id || item.url === asset.fileUrl));
      if (prev.length >= MAX_MEDIA) return prev;
      return [...prev, { id: asset.id, url: asset.fileUrl }];
    });
    setConflict(null);
  };

  const addUploaded = (assets: MediaAsset[]) => {
    setMedia(prev => {
      const next = [...prev];
      for (const asset of assets) {
        if (next.length >= MAX_MEDIA) break;
        if (!next.some(item => item.id === asset.id)) next.push({ id: asset.id, url: asset.fileUrl });
      }
      return next;
    });
  };

  const removeMediaAt = (index: number) => setMedia(prev => prev.filter((_, i) => i !== index));
  const moveMedia = (index: number, delta: number) => setMedia(prev => {
    const target = index + delta;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  /* ── Hashtags ── */
  const addHashtag = (value: string) => {
    const next = normalizeHashtags([...hashtags, ...value.split(/[\s,]+/)]);
    setHashtags(next);
    setHashtagInput('');
  };
  const onHashtagKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && hashtagInput.trim()) {
      event.preventDefault();
      addHashtag(hashtagInput);
    } else if (event.key === 'Backspace' && !hashtagInput && hashtags.length > 0) {
      setHashtags(prev => prev.slice(0, -1));
    }
  };

  /* ── AI assistant ── */
  const canGenerate = imageUrls.length > 0 && (imageUrls.length === 1 || attachableMedia.length > 1);

  const runAi = async (busy: AiBusy, action: () => Promise<void>, fallback: string) => {
    setAiBusy(busy);
    setAiError('');
    try {
      await action();
    } catch (err) {
      setAiError(errorMessage(err, fallback));
    } finally {
      setAiBusy(null);
    }
  };

  /* The AI takes several seconds to answer, so suggestions for the chosen image(s) and tone are requested in the
     background as soon as the Caption step is shown; "Generate" then picks up that request, often already done.
     Requests are keyed by tone + images, so changing either never shows suggestions for something else. */
  const multiImage = attachableMedia.length > 1;
  const captionRequestKey = multiImage
    ? `ids:${attachableMedia.slice(0, MAX_AI_IMAGES).map(item => item.id).join(',')}`
    : `url:${imageUrls[0] ?? ''}`;
  const captionRequests = useRef(new Map<string, Promise<string[]>>());
  const requestCaptions = (forTone: Tone) => {
    const key = `${forTone}|${captionRequestKey}`;
    const existing = captionRequests.current.get(key);
    if (existing) return existing;
    const request = multiImage
      ? mediaApi.generateCaptionFromAssets(attachableMedia.slice(0, MAX_AI_IMAGES).map(item => item.id), forTone)
      : captionApi.generate(imageUrls[0], forTone);
    captionRequests.current.set(key, request);
    request.catch(() => captionRequests.current.delete(key));
    return request;
  };
  const requestCaptionsRef = useRef(requestCaptions);
  useEffect(() => { requestCaptionsRef.current = requestCaptions; });

  const wantsPrefetch = step === 1 && canGenerate && suggestions.length === 0;
  useEffect(() => {
    if (!wantsPrefetch) return;
    // A short pause, so skimming through tones doesn't start a request for each one.
    const timer = window.setTimeout(() => { requestCaptionsRef.current(tone).catch(() => {}); }, 600);
    return () => window.clearTimeout(timer);
  }, [wantsPrefetch, tone, captionRequestKey]);

  const generateCaptions = () => runAi('generate', async () => {
    const key = `${tone}|${captionRequestKey}`;
    try {
      const captions = await requestCaptions(tone);
      setSuggestions(captions.filter(Boolean));
      if (captions.length === 0) setAiError('The AI returned no suggestions. Try again or pick a different tone.');
    } finally {
      // Used up: "Generate new captions" asks again for fresh ones.
      captionRequests.current.delete(key);
    }
  }, 'Caption generation failed. Please try again.');

  const rewriteCaption = () => runAi('rewrite', async () => {
    setCaption(await captionApi.rewrite(caption, tone));
  }, 'Could not rewrite the caption. Please try again.');

  const rewriteSuggestion = (index: number) => runAi(index, async () => {
    const rewritten = await captionApi.rewrite(suggestions[index], tone);
    setSuggestions(prev => prev.map((item, i) => (i === index ? rewritten : item)));
  }, 'Could not rewrite that suggestion. Please try again.');

  const suggestHashtags = () => runAi('hashtags', async () => {
    const tags = await captionApi.hashtags(caption);
    setHashtags(prev => normalizeHashtags([...prev, ...tags]));
  }, 'Could not generate hashtags. Please try again.');

  const applySuggestion = (text: string) => {
    setCaption(text);
    setCaptionError('');
  };

  /* ── Navigation ── */
  const goTo = (target: number) => {
    if (target > step && !validateUpTo(target)) return;
    setStep(target);
  };

  const validateUpTo = (target: number) => {
    if (target >= 2 && !caption.trim() && media.length === 0) {
      setStep(1);
      setCaptionError('Write a caption or add at least one image before continuing.');
      return false;
    }
    return true;
  };

  const leave = () => {
    const state = window.history.state as { idx?: number } | null;
    if (state?.idx && state.idx > 0) navigate(-1);
    else navigate('/');
  };

  const requestExit = () => {
    if (dirty) setConfirmExit('exit');
    else leave();
  };

  const connectFacebook = () => {
    if (dirty) setConfirmExit('connect');
    else void facebook.connect();
  };

  /* ── Submit ── */
  const submit = async () => {
    if (submittingRef.current) return;
    if (!validateUpTo(3)) return;
    if (effectiveWhen === 'schedule') {
      if (!scheduledAt) {
        setScheduleError('Choose a date and time for this post.');
        return;
      }
      if (isTooSoon(scheduledAt)) {
        setScheduleError('Pick a time at least a minute from now — or choose “Publish now”.');
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setConflict(null);

    const ids = attachableMedia.map(item => item.id);
    const payload: PostUpsertPayload = {
      caption: caption.trim(),
      hashtags,
      tone,
      mediaAssetId: ids[0],
      mediaAssetIds: ids.length > 0 ? ids : undefined,
      scheduledAt: effectiveWhen === 'schedule' && scheduledAt ? scheduledAt.toISOString() : undefined,
    };

    try {
      const created = await postApi.create(payload, activeOrgId);
      if (effectiveWhen === 'now' && canPublishDirectly && created.status === 'DRAFT') {
        try {
          const published = await postApi.publish(created.id);
          setResult(published.status === 'PUBLISHED'
            ? { kind: 'published', post: published }
            : { kind: 'failed', post: published, message: 'Facebook did not accept the post. It is saved in Posts, marked Failed, so you can try again.' });
        } catch (err) {
          setResult({
            kind: 'failed',
            post: created,
            message: `${errorMessage(err, 'Publishing failed.')} Your post was saved as a draft.`,
          });
        }
      } else {
        const kind: ResultKind = created.status === 'PENDING_REVIEW'
          ? 'pending'
          : created.status === 'SCHEDULED' ? 'scheduled' : 'draft';
        setResult({ kind, post: created });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(err.data as PostConflict);
      } else {
        setSubmitError(errorMessage(err, 'Could not save your post. Please try again.'));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const retryPublish = async () => {
    if (!result || retrying) return;
    setRetrying(true);
    try {
      const published = await postApi.publish(result.post.id);
      setResult(published.status === 'PUBLISHED'
        ? { kind: 'published', post: published }
        : { kind: 'failed', post: published, message: 'Facebook still did not accept the post. Check the Page connection and try again from Posts.' });
    } catch (err) {
      setResult({ ...result, message: errorMessage(err, 'Publishing failed again.') });
    } finally {
      setRetrying(false);
    }
  };

  const startOver = () => {
    setResult(null);
    setStep(0);
    setMedia([]);
    setCaption('');
    setHashtags([]);
    setHashtagInput('');
    setSuggestions([]);
    setAiError('');
    setCaptionError('');
    setSubmitError('');
    setScheduleError('');
    setConflict(null);
    setScheduledAt(suggestedTime);
    setWhen(canPublishDirectly ? 'now' : 'schedule');
    setPickerIntent(null);
    setNotice('');
  };

  if (result) {
    return (
      <div className="cp-page">
        <Confirmation
          result={result}
          headingRef={headingRef}
          pageName={pageName}
          workspaceName={workspaceName}
          canRetry={canPublishDirectly}
          retrying={retrying}
          onRetry={() => void retryPublish()}
          onCreateAnother={startOver}
        />
      </div>
    );
  }

  const submitLabel = !canPublishDirectly
    ? 'Submit for Approval'
    : effectiveWhen === 'now' ? 'Publish Now' : effectiveWhen === 'schedule' ? 'Schedule Post' : 'Save Draft';
  const submittingLabel = effectiveWhen === 'now' ? 'Publishing…' : effectiveWhen === 'schedule' ? 'Scheduling…' : 'Saving…';

  return (
    <div className="cp-page">
      <header className="cp-header">
        <div className="cp-header-text">
          <div className="cp-kicker">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Post
          </div>
          <p className="cp-context">
            Posting to <strong>{facebook.connected ? pageName : 'no Facebook Page yet'}</strong>
            <span aria-hidden="true"> · </span>
            <span>{workspaceName}</span>
          </p>
        </div>
        <button type="button" className="ug-btn ug-btn-ghost" onClick={requestExit}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit
        </button>
      </header>

      <nav className="cp-steps" aria-label="Post creation progress">
        <ol>
          {STEPS.map((item, index) => {
            const state = index === step ? 'current' : index < step ? 'done' : 'upcoming';
            return (
              <li key={item.key} className={`cp-step is-${state}`}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={state === 'current' ? 'step' : undefined}
                  disabled={index > step + 1}
                >
                  <span className="cp-step-num" aria-hidden="true">
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span className="cp-step-label">{item.label}</span>
                  <span className="cp-sr-only">{state === 'done' ? ' (completed)' : ''}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="cp-steps-mobile" aria-hidden="true">
          Step {step + 1} of {STEPS.length} · {STEPS[step].label}
          <span className="cp-steps-bar"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></span>
        </div>
      </nav>

      {notice && (
        <div className="cp-banner cp-banner-info" role="status">
          <span>{notice}</span>
          <button type="button" className="cp-banner-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button>
        </div>
      )}

      <section className="cp-card" aria-labelledby="cp-step-title">
        {step === 0 && (
          <>
            <StepHeading headingRef={headingRef} title="What do you want to publish?" subtitle="Add images from your device or your Media Library. You can also continue with a text-only post." />
            <div className="cp-source-grid">
              <button
                type="button"
                className={`cp-source${pickerIntent === 'upload' ? ' is-active' : ''}`}
                onClick={() => setPickerIntent(prev => (prev === 'upload' ? null : 'upload'))}
                aria-expanded={pickerIntent === 'upload'}
                aria-controls="cp-picker-region"
              >
                <span className="cp-source-icon" aria-hidden="true">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </span>
                <span className="cp-source-text">
                  <span className="cp-source-title">Upload Media</span>
                  <span className="cp-source-desc">From your device, saved into a Media Library folder</span>
                </span>
              </button>
              <button
                type="button"
                className={`cp-source${pickerIntent === 'library' ? ' is-active' : ''}`}
                onClick={() => setPickerIntent(prev => (prev === 'library' ? null : 'library'))}
                aria-expanded={pickerIntent === 'library'}
                aria-controls="cp-picker-region"
              >
                <span className="cp-source-icon" aria-hidden="true">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="cp-source-text">
                  <span className="cp-source-title">Choose from Media Library</span>
                  <span className="cp-source-desc">Reuse images already in your workspace</span>
                </span>
              </button>
            </div>

            <div id="cp-picker-region">
              {pickerIntent && (
                <MediaLibraryPicker
                  key={facebook.scopeKey}
                  orgId={activeOrgId}
                  ready={facebook.resolved}
                  canCreateFolder={canModerate || !activeOrgId}
                  selected={media}
                  maxItems={MAX_MEDIA}
                  intent={pickerIntent}
                  onToggle={toggleAsset}
                  onUploaded={addUploaded}
                />
              )}
            </div>

            <div className="cp-selected">
              <div className="cp-selected-head">
                <h3 className="cp-subheading">Selected media</h3>
                <span className="cp-selected-count">
                  {media.length === 0 ? 'None yet' : `${media.length} image${media.length === 1 ? '' : 's'}${media.length > 1 ? ' · carousel post' : ''}`}
                </span>
              </div>
              {media.length === 0 ? (
                <p className="cp-muted">No images selected. Your post will be text-only unless you add some.</p>
              ) : (
                <ul className="cp-thumbs">
                  {media.map((item, index) => (
                    <li key={`${item.id || item.url}-${index}`} className={`cp-thumb${item.id ? '' : ' is-unattached'}`}>
                      {item.url ? <img src={item.url} alt={`Selected image ${index + 1}`} /> : <span className="cp-thumb-missing">Image</span>}
                      <span className="cp-thumb-num" aria-hidden="true">{index + 1}</span>
                      <div className="cp-thumb-actions">
                        {media.length > 1 && (
                          <>
                            <button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0} aria-label={`Move image ${index + 1} earlier`}>‹</button>
                            <button type="button" onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1} aria-label={`Move image ${index + 1} later`}>›</button>
                          </>
                        )}
                        <button type="button" onClick={() => removeMediaAt(index)} aria-label={`Remove image ${index + 1}`}>×</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {unattachedCount > 0 && (
                <p className="cp-warning" role="note">
                  {unattachedCount} image{unattachedCount === 1 ? ' isn’t' : 's aren’t'} in your Media Library, so {unattachedCount === 1 ? 'it' : 'they'} can’t be attached to the post.
                  Upload {unattachedCount === 1 ? 'it' : 'them'} or choose from the library instead.
                </p>
              )}
            </div>

            <StepFooter
              onBack={requestExit}
              backLabel="Cancel"
              onNext={() => goTo(1)}
              nextLabel={media.length === 0 ? 'Continue without media' : 'Continue'}
            />
          </>
        )}

        {step === 1 && (
          <>
            <StepHeading headingRef={headingRef} title="Write your caption" subtitle="Write it yourself, or let the AI assistant draft options you can use and edit." />
            <div className="cp-caption-layout">
              <div className="cp-caption-main">
                <div className="cp-field">
                  <div className="cp-label-row">
                    <label htmlFor="cp-caption" className="cp-label">Caption</label>
                    <span className="cp-counter" aria-live="off">{caption.length.toLocaleString()} characters</span>
                  </div>
                  <textarea
                    id="cp-caption"
                    className={`cp-textarea${captionError ? ' is-invalid' : ''}`}
                    value={caption}
                    onChange={e => { setCaption(e.target.value); setCaptionError(''); }}
                    rows={8}
                    placeholder="Your caption here…"
                    aria-invalid={captionError ? true : undefined}
                    aria-describedby={captionError ? 'cp-caption-error' : undefined}
                    disabled={aiBusy === 'rewrite'}
                  />
                  {captionError && <p id="cp-caption-error" className="cp-field-error" role="alert">{captionError}</p>}
                </div>

                <div className="cp-field">
                  <label htmlFor="cp-hashtag-input" className="cp-label">Hashtags</label>
                  <div className="cp-chip-shell">
                    {hashtags.map(tag => (
                      <span key={tag} className="cp-chip">
                        {tag}
                        <button type="button" onClick={() => setHashtags(prev => prev.filter(t => t !== tag))} aria-label={`Remove ${tag}`}>×</button>
                      </span>
                    ))}
                    <input
                      id="cp-hashtag-input"
                      value={hashtagInput}
                      onChange={e => setHashtagInput(e.target.value)}
                      onKeyDown={onHashtagKeyDown}
                      onBlur={() => hashtagInput.trim() && addHashtag(hashtagInput)}
                      placeholder={hashtags.length === 0 ? 'Type a hashtag and press Enter' : 'Add another…'}
                      aria-describedby="cp-hashtag-hint"
                    />
                  </div>
                  <p id="cp-hashtag-hint" className="cp-hint">Press Enter or comma to add. Backspace removes the last one.</p>
                </div>
              </div>

              <aside className="cp-ai" aria-labelledby="cp-ai-title">
                <div className="cp-ai-head">
                  <span className="cp-ai-badge" aria-hidden="true">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </span>
                  <h3 id="cp-ai-title" className="cp-ai-title">AI Assistant</h3>
                </div>

                <div className="cp-field">
                  <span className="cp-label" id="cp-tone-label">Tone</span>
                  <div className="cp-tones" role="radiogroup" aria-labelledby="cp-tone-label">
                    {TONE_OPTIONS.map(option => (
                      <button
                        key={option.tone}
                        type="button"
                        role="radio"
                        aria-checked={tone === option.tone}
                        className={`cp-tone${tone === option.tone ? ' is-active' : ''}`}
                        onClick={() => setTone(option.tone)}
                        title={option.description}
                        disabled={aiBusy !== null}
                      >
                        <span aria-hidden="true">{option.icon}</span> {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="ug-btn ug-btn-primary cp-ai-generate"
                  onClick={() => void generateCaptions()}
                  disabled={!canGenerate || aiBusy !== null}
                  aria-describedby="cp-ai-generate-hint"
                >
                  {aiBusy === 'generate' ? <span className="ug-spinner" aria-hidden="true" /> : (
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  )}
                  {aiBusy === 'generate' ? 'Generating…' : suggestions.length > 0 ? 'Generate new captions' : 'Generate Caption'}
                </button>
                <p id="cp-ai-generate-hint" className="cp-hint">
                  {imageUrls.length === 0
                    ? 'Add an image in step 1 so the AI can write about it.'
                    : !canGenerate
                      ? 'Choose images from your Media Library to generate a caption for several at once.'
                      : attachableMedia.length > MAX_AI_IMAGES
                        ? `Captions are based on your first ${MAX_AI_IMAGES} images.`
                        : `Suggestions are based on your ${imageUrls.length > 1 ? `${imageUrls.length} images` : 'image'}.`}
                </p>

                <div className="cp-ai-secondary">
                  <button
                    type="button"
                    className="ug-btn ug-btn-secondary ug-btn-sm"
                    onClick={() => void rewriteCaption()}
                    disabled={!caption.trim() || aiBusy !== null}
                  >
                    {aiBusy === 'rewrite' && <span className="ug-spinner" aria-hidden="true" />}
                    {aiBusy === 'rewrite' ? 'Rewriting…' : 'Rewrite my caption'}
                  </button>
                  <button
                    type="button"
                    className="ug-btn ug-btn-secondary ug-btn-sm"
                    onClick={() => void suggestHashtags()}
                    disabled={!caption.trim() || aiBusy !== null}
                  >
                    {aiBusy === 'hashtags' && <span className="ug-spinner" aria-hidden="true" />}
                    {aiBusy === 'hashtags' ? 'Generating…' : 'Suggest hashtags'}
                  </button>
                </div>

                {aiError && <p className="cp-field-error" role="alert">{aiError}</p>}
                <div aria-live="polite" className="cp-sr-only">
                  {aiBusy === null && suggestions.length > 0 ? `${suggestions.length} caption suggestions ready.` : ''}
                </div>
              </aside>
            </div>

            {suggestions.length > 0 && (
              <div className="cp-suggestions">
                <h3 className="cp-subheading">AI Suggestions</h3>
                <ul className="cp-suggestion-list">
                  {suggestions.map((text, index) => {
                    const inUse = caption.trim() === text.trim();
                    return (
                      <li key={`${index}-${text.slice(0, 24)}`} className={`cp-suggestion${inUse ? ' is-used' : ''}`}>
                        <p className="cp-suggestion-text">{text}</p>
                        <div className="cp-suggestion-actions">
                          <button
                            type="button"
                            className={`ug-btn ${inUse ? 'ug-btn-secondary' : 'ug-btn-primary'} ug-btn-sm`}
                            onClick={() => applySuggestion(text)}
                            disabled={aiBusy !== null}
                          >
                            {inUse ? '✓ In use' : 'Use Caption'}
                          </button>
                          <button
                            type="button"
                            className="ug-btn ug-btn-ghost ug-btn-sm"
                            onClick={() => void rewriteSuggestion(index)}
                            disabled={aiBusy !== null}
                          >
                            {aiBusy === index && <span className="ug-spinner" aria-hidden="true" />}
                            {aiBusy === index ? 'Rewriting…' : 'Rewrite'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <StepFooter onBack={() => setStep(0)} onNext={() => goTo(2)} nextLabel="Preview" nextDisabled={aiBusy !== null} />
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading headingRef={headingRef} title="Preview" subtitle="This is how your post will look on Facebook." />
            <div className="cp-preview-layout">
              <FacebookPreview
                pageName={facebook.connected ? pageName : 'Your Facebook Page'}
                pictureUrl={facebook.pagePictureUrl}
                caption={caption.trim()}
                hashtags={hashtags}
                images={media.filter(item => item.id && item.url).map(item => item.url)}
              />

              <div className="cp-review">
                <h3 className="cp-subheading">Before you publish</h3>
                <dl className="cp-review-list">
                  <div>
                    <dt>Facebook Page</dt>
                    <dd>
                      {facebook.connected
                        ? pageName
                        : <span className="cp-review-warn">Not connected</span>}
                    </dd>
                  </div>
                  <div><dt>Workspace</dt><dd>{workspaceName}</dd></div>
                  <div>
                    <dt>Media</dt>
                    <dd>
                      {attachableMedia.length === 0 ? 'Text only' : `${attachableMedia.length} image${attachableMedia.length === 1 ? '' : 's'}`}
                      <button type="button" className="cp-link" onClick={() => setStep(0)}>Edit</button>
                    </dd>
                  </div>
                  <div>
                    <dt>Caption</dt>
                    <dd>
                      {caption.trim() ? `${caption.trim().length.toLocaleString()} characters` : <span className="cp-review-warn">Empty</span>}
                      <button type="button" className="cp-link" onClick={() => setStep(1)}>Edit</button>
                    </dd>
                  </div>
                  <div><dt>Hashtags</dt><dd>{hashtags.length || 'None'}</dd></div>
                  <div><dt>Tone</dt><dd>{TONE_OPTIONS.find(option => option.tone === tone)?.label ?? tone}</dd></div>
                </dl>
                {unattachedCount > 0 && (
                  <p className="cp-warning">{unattachedCount} image{unattachedCount === 1 ? '' : 's'} outside your Media Library won’t be attached.</p>
                )}
                {!caption.trim() && media.length > 0 && (
                  <p className="cp-hint">Posting an image without a caption is allowed, but a short caption usually performs better.</p>
                )}
              </div>
            </div>
            <StepFooter onBack={() => setStep(1)} onNext={() => goTo(3)} nextLabel="Continue" />
          </>
        )}

        {step === 3 && (
          <>
            <StepHeading headingRef={headingRef} title="When should this be published?" subtitle={`On ${facebook.connected ? pageName : 'your Facebook Page'} · ${workspaceName}`} />

            {!facebook.connected && (
              <div className="cp-banner cp-banner-warn" role="note">
                <div>
                  <strong>No Facebook Page is connected.</strong>{' '}
                  {canManageFacebook
                    ? 'Connect one to publish or schedule. You can still save this post as a draft.'
                    : `An officer or admin needs to connect ${workspaceName}’s Facebook Page. You can still save this post as a draft.`}
                </div>
                {canManageFacebook && (
                  <button type="button" className="upe-fb-connect-btn" onClick={connectFacebook} disabled={facebook.isBusy}>
                    Connect Facebook
                  </button>
                )}
              </div>
            )}

            {!canPublishDirectly && (
              <div className="cp-banner cp-banner-info" role="note">
                Posts from members of {workspaceName} are reviewed by an officer or admin before they go live.
              </div>
            )}

            <fieldset className="cp-when">
              <legend className="cp-sr-only">Publishing time</legend>
              {canPublishDirectly && (
                <WhenOption
                  value="now"
                  current={effectiveWhen}
                  disabled={!facebook.connected}
                  onSelect={setWhen}
                  title="Publish now"
                  description={`Goes live on ${pageName} right away.`}
                />
              )}
              <WhenOption
                value="schedule"
                current={effectiveWhen}
                disabled={!facebook.connected}
                onSelect={value => { setWhen(value); setScheduleError(''); }}
                title="Schedule for later"
                description={canPublishDirectly ? 'UGNAY publishes it automatically at the time you pick.' : 'Published at this time once it is approved.'}
              >
                {effectiveWhen === 'schedule' && (
                  <div className="cp-when-detail">
                    <label htmlFor="cp-schedule-input" className="cp-label">Date and time</label>
                    <DateTimePickerPanel
                      inputId="cp-schedule-input"
                      value={scheduledAt}
                      onChange={value => { setScheduledAt(value); setScheduleError(''); setConflict(null); }}
                      suggestedValue={suggestedTime}
                      minDate={today}
                      invalid={Boolean(scheduleError)}
                      describedBy={scheduleError ? 'cp-schedule-error' : undefined}
                    />
                    {scheduleError && <p id="cp-schedule-error" className="cp-field-error" role="alert">{scheduleError}</p>}
                  </div>
                )}
              </WhenOption>
              <WhenOption
                value="draft"
                current={effectiveWhen}
                onSelect={setWhen}
                title="Save as draft"
                description={canPublishDirectly ? 'Keep it in Posts and finish it later.' : 'Saved without a date and sent for review.'}
              />
            </fieldset>

            {conflict && <ConflictAlertBanner conflict={conflict} />}
            {conflict && <p className="cp-hint">Pick a different time to continue.</p>}
            {submitError && (
              <div className="cp-banner cp-banner-error" role="alert">{submitError}</div>
            )}

            <StepFooter
              onBack={() => setStep(2)}
              onNext={() => void submit()}
              nextLabel={submitting ? submittingLabel : submitLabel}
              nextBusy={submitting}
              nextDisabled={submitting || Boolean(conflict)}
              backDisabled={submitting}
              primary
            />
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmExit !== null}
        title={confirmExit === 'connect' ? 'Leave to connect Facebook?' : 'Discard this post?'}
        description={confirmExit === 'connect'
          ? 'Connecting opens Facebook in this tab, and the post you are writing will be lost. Save it as a draft first if you want to keep it.'
          : 'Your media selection, caption and hashtags will be lost.'}
        confirmLabel={confirmExit === 'connect' ? 'Leave and connect' : 'Discard post'}
        cancelLabel="Keep editing"
        tone="danger"
        onCancel={() => setConfirmExit(null)}
        onConfirm={() => {
          const action = confirmExit;
          setConfirmExit(null);
          if (action === 'connect') void facebook.connect();
          else leave();
        }}
      />
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function StepHeading({ headingRef, title, subtitle }: Readonly<{
  headingRef: RefObject<HTMLHeadingElement | null>;
  title: string;
  subtitle?: string;
}>) {
  return (
    <div className="cp-step-head">
      <h1 id="cp-step-title" ref={headingRef} tabIndex={-1} className="cp-title">{title}</h1>
      {subtitle && <p className="cp-subtitle">{subtitle}</p>}
    </div>
  );
}

function StepFooter({
  onBack,
  backLabel = 'Back',
  backDisabled = false,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextBusy = false,
  primary = false,
}: Readonly<{
  onBack: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextBusy?: boolean;
  primary?: boolean;
}>) {
  return (
    <div className="cp-footer">
      <button type="button" className="ug-btn ug-btn-secondary" onClick={onBack} disabled={backDisabled}>
        {backLabel === 'Back' && <span aria-hidden="true">←</span>} {backLabel}
      </button>
      <button
        type="button"
        className={`ug-btn ug-btn-primary${primary ? ' ug-btn-lg' : ''}`}
        onClick={onNext}
        disabled={nextDisabled}
        aria-busy={nextBusy || undefined}
      >
        {nextBusy && <span className="ug-spinner" aria-hidden="true" />}
        {nextLabel}
        {!nextBusy && !primary && <span aria-hidden="true">→</span>}
      </button>
    </div>
  );
}

function WhenOption({
  value,
  current,
  disabled = false,
  onSelect,
  title,
  description,
  children,
}: Readonly<{
  value: When;
  current: When;
  disabled?: boolean;
  onSelect: (value: When) => void;
  title: string;
  description: string;
  children?: ReactNode;
}>) {
  const id = `cp-when-${value}`;
  const checked = current === value;
  return (
    <div className={`cp-when-option${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}>
      <label htmlFor={id} className="cp-when-label">
        <input
          id={id}
          type="radio"
          name="cp-when"
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onSelect(value)}
        />
        <span className="cp-when-text">
          <span className="cp-when-title">{title}</span>
          <span className="cp-when-desc">{description}</span>
        </span>
      </label>
      {children}
    </div>
  );
}

function FacebookPreview({ pageName, pictureUrl, caption, hashtags, images }: Readonly<{
  pageName: string;
  pictureUrl: string | null;
  caption: string;
  hashtags: string[];
  images: string[];
}>) {
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  return (
    <article className="cp-fb" aria-label="Facebook post preview">
      <header className="cp-fb-head">
        {pictureUrl
          ? <img className="cp-fb-avatar" src={pictureUrl} alt="" />
          : <span className="cp-fb-avatar cp-fb-avatar-fallback" aria-hidden="true">{pageName.charAt(0).toUpperCase()}</span>}
        <div>
          <div className="cp-fb-name">{pageName}</div>
          <div className="cp-fb-meta">Just now · <span aria-label="Public">🌐</span></div>
        </div>
      </header>
      {(caption || hashtags.length > 0) && (
        <div className="cp-fb-text">
          {caption}
          {hashtags.length > 0 && (
            <>
              {caption && '\n\n'}
              {hashtags.map((tag, i) => (
                <span key={tag}>
                  <span className="cp-fb-tag">{tag}</span>{i < hashtags.length - 1 ? ' ' : ''}
                </span>
              ))}
            </>
          )}
        </div>
      )}
      {shown.length > 0 && (
        <div className={`cp-fb-media cp-fb-media-${Math.min(shown.length, 4)}`}>
          {shown.map((url, i) => (
            <div key={`${url}-${i}`} className="cp-fb-media-cell">
              <img src={url} alt={`Post image ${i + 1}`} />
              {i === shown.length - 1 && extra > 0 && <span className="cp-fb-more">+{extra}</span>}
            </div>
          ))}
        </div>
      )}
      {!caption && hashtags.length === 0 && shown.length === 0 && (
        <p className="cp-fb-empty">Your post is empty.</p>
      )}
      <footer className="cp-fb-actions" aria-hidden="true">
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </footer>
    </article>
  );
}

const RESULT_COPY: Record<ResultKind, { title: string; icon: 'ok' | 'wait' | 'fail' }> = {
  published: { title: 'Post Published!', icon: 'ok' },
  scheduled: { title: 'Post Scheduled!', icon: 'ok' },
  pending: { title: 'Submitted for Approval', icon: 'wait' },
  draft: { title: 'Draft Saved', icon: 'ok' },
  failed: { title: 'Publishing Failed', icon: 'fail' },
};

const TAB_FOR_RESULT: Record<ResultKind, string> = {
  published: 'PUBLISHED',
  scheduled: 'SCHEDULED',
  pending: 'PENDING_REVIEW',
  draft: 'DRAFT',
  failed: 'FAILED',
};

function Confirmation({
  result,
  headingRef,
  pageName,
  workspaceName,
  canRetry,
  retrying,
  onRetry,
  onCreateAnother,
}: Readonly<{
  result: Result;
  headingRef: RefObject<HTMLHeadingElement | null>;
  pageName: string;
  workspaceName: string;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
  onCreateAnother: () => void;
}>) {
  const { kind, post } = result;
  const copy = RESULT_COPY[kind];
  const scheduled = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const tab = post.status === 'FAILED' ? 'FAILED' : TAB_FOR_RESULT[kind];
  const viewPostHref = `/posts?status=${tab}&highlight=${encodeURIComponent(post.id)}`;

  return (
    <section className={`cp-card cp-done cp-done-${copy.icon}`} aria-labelledby="cp-done-title">
      <div className="cp-done-icon" aria-hidden="true">
        {copy.icon === 'ok' && (
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        )}
        {copy.icon === 'wait' && (
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
        {copy.icon === 'fail' && (
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        )}
      </div>
      <h1 id="cp-done-title" ref={headingRef} tabIndex={-1} className="cp-done-title">
        {copy.title}
      </h1>

      {kind === 'published' && <p className="cp-done-lead">Your post is live on Facebook.</p>}
      {kind === 'scheduled' && <p className="cp-done-lead">Your post is scheduled for:</p>}
      {kind === 'pending' && (
        <p className="cp-done-lead">
          An officer or admin of {workspaceName} will review it{scheduled ? ' before it is scheduled for:' : '.'}
        </p>
      )}
      {kind === 'draft' && <p className="cp-done-lead">Your post is saved in Posts. Finish and publish it whenever you’re ready.</p>}
      {kind === 'failed' && <p className="cp-done-lead">{result.message}</p>}

      {scheduled && (kind === 'scheduled' || kind === 'pending') && (
        <div className="cp-done-when">
          <span className="cp-done-date">{formatLongDate(scheduled)}</span>
          <span className="cp-done-time">{formatTime(scheduled)}</span>
        </div>
      )}

      <dl className="cp-done-meta">
        <div><dt>Facebook Page</dt><dd>{pageName}</dd></div>
        <div><dt>Workspace</dt><dd>{workspaceName}</dd></div>
      </dl>

      <div className="cp-done-actions">
        {kind === 'failed' && canRetry && (
          <button type="button" className="ug-btn ug-btn-primary ug-btn-lg" onClick={onRetry} disabled={retrying}>
            {retrying && <span className="ug-spinner" aria-hidden="true" />}
            {retrying ? 'Publishing…' : 'Try Again'}
          </button>
        )}
        {kind === 'published' && post.fbPostId && (
          <Link to={`/analytics/posts/${encodeURIComponent(post.fbPostId)}`} className="ug-btn ug-btn-primary ug-btn-lg">View Insights</Link>
        )}
        <Link to={viewPostHref} className={`ug-btn ${kind === 'published' || kind === 'failed' ? 'ug-btn-secondary' : 'ug-btn-primary'} ug-btn-lg`}>
          {kind === 'failed' ? 'View in Posts' : 'View Post'}
        </Link>
        {kind === 'scheduled' && <Link to="/calendar" className="ug-btn ug-btn-secondary ug-btn-lg">View Calendar</Link>}
      </div>
      <div className="cp-done-links">
        <button type="button" className="cp-link" onClick={onCreateAnother}>Create another post</button>
        <span aria-hidden="true">·</span>
        <Link to="/" className="cp-link">Back to Dashboard</Link>
      </div>
    </section>
  );
}
