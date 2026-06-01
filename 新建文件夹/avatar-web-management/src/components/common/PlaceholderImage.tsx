'use client';

import { useState } from 'react';
import Image from 'next/image';

type PlaceholderType = 'avatar' | 'model' | 'asset' | 'template';

const FALLBACK_MAP: Record<PlaceholderType, string> = {
  avatar: '/images/placeholder-avatar.svg',
  model: '/images/placeholder-model.svg',
  asset: '/images/placeholder-asset.svg',
  template: '/images/placeholder-template.svg',
};

interface PlaceholderImageProps {
  src: string | null | undefined;
  alt: string;
  type?: PlaceholderType;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  /** Override the default fallback SVG */
  fallbackSrc?: string;
}

export default function PlaceholderImage({
  src,
  alt,
  type = 'model',
  width,
  height,
  fill,
  className,
  fallbackSrc,
}: PlaceholderImageProps) {
  const [hasError, setHasError] = useState(false);
  const fallback = fallbackSrc || FALLBACK_MAP[type];

  // No source — use fallback immediately
  if (!src || hasError) {
    return (
      <Image
        src={fallback}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        className={className}
        unoptimized
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

/** Resolve a thumbnail URL that may be null — returns the URL or null for fallback */
export function thumbnailSrc(url: string | null | undefined): string | null | undefined {
  if (!url) return null;
  // If it is already a full URL or starts with /, return as-is
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/uploads/${url}`;
}
