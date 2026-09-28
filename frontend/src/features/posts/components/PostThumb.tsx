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
