import { useState } from 'react';

interface PostThumbProps {
  src?: string | null;
  /** Classes of the image box (shared by the image and the text fallback). */
  className: string;
  /** Extra class for the text-only fallback tile. */
  fallbackClassName: string;
}

/** A post's thumbnail; falls back to the text tile when there is no image or it fails to load. */
export default function PostThumb({ src, className, fallbackClassName }: Readonly<PostThumbProps>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <span className={`${className} ${fallbackClassName}`} aria-hidden="true">Aa</span>;
  }

  if (src.includes('.mp4')) {
    return (
      <div className={className} style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
        <video
          src={src}
          preload="metadata"
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setFailedSrc(src)}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 3,
            right: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            color: '#fff',
            fontSize: '9px',
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: '3px',
          }}
        >
          ▶
        </span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
