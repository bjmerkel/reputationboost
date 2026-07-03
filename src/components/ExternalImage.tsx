"use client";

import { useState, type ReactNode } from "react";

interface ExternalImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

/** Google-hosted images (lh3.googleusercontent.com) require no-referrer to load off-site. */
export default function ExternalImage({
  src,
  alt,
  className,
  fallback = null,
}: ExternalImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src?.trim() || failed) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
