import { useState } from 'react';

/**
 * A Facebook Page's (or workspace's) profile picture. Falls back to the name's first letter when there is no
 * picture or it fails to load (Facebook picture URLs are signed and expire after a while).
 */
export default function PageAvatar({
  src,
  name,
  className,
}: Readonly<{
  src: string | null | undefined;
  name: string;
  className?: string;
}>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  const initial = (name.trim().charAt(0) || '?').toUpperCase();

  return (
    <span className={className} aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      ) : (
        initial
      )}
    </span>
  );
}
