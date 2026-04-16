'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  resolvePrimaryEventImage,
  resolveCategoryFallbackImage,
  resolveGenericFallbackImage,
} from '@/lib/event-images';

type FallbackStage = 'primary' | 'category' | 'generic' | 'placeholder';

interface EventImageProps {
  /** External image URL from the event (event.image_url). */
  src?: string | null;
  /** Event category for fallback image selection. */
  category?: string | null;
  /** Event title — used as seed for deterministic fallback variant. */
  title?: string | null;
  alt?: string;
  className?: string;
  wrapperClassName?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Show a skeleton shimmer while loading. Default: true */
  showSkeleton?: boolean;
  /** Show a gradient overlay at the bottom of the image. Default: false */
  showGradientOverlay?: boolean;
  objectPosition?: string;
  /** CSS object-fit value. Default: 'cover' */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

/**
 * Central event image component. Handles the full fallback chain:
 * 1. Primary event image (external URL)
 * 2. Category-specific local fallback
 * 3. Generic local fallback
 * 4. Neutral placeholder block (never shows a broken browser icon)
 *
 * Must be used as a Client Component ('use client').
 */
export function EventImage({
  src,
  category,
  title,
  alt = '',
  className = '',
  wrapperClassName = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  showSkeleton = true,
  showGradientOverlay = false,
  objectPosition,
  objectFit = 'cover',
}: EventImageProps) {
  const computePrimary = useCallback(
    () => resolvePrimaryEventImage({ imageUrl: src, category, title }),
    [src, category, title],
  );

  const [currentSrc, setCurrentSrc] = useState(computePrimary);
  const [stage, setStage] = useState<FallbackStage>('primary');
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset when props change
  useEffect(() => {
    const next = computePrimary();
    setCurrentSrc(next);
    setStage('primary');
    setLoaded(false);
  }, [computePrimary]);

  // Handle cached-image race: if the browser served <img> from cache synchronously,
  // onLoad may have fired before React attached the handler. Check img.complete
  // after each src change and flip loaded manually.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else if (img.complete && img.naturalWidth === 0) {
      // Cached as broken — trigger error flow
      handleError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSrc]);

  const handleError = useCallback(() => {
    switch (stage) {
      case 'primary': {
        const fallback = resolveCategoryFallbackImage(category, title ?? undefined);
        setCurrentSrc(fallback);
        setStage('category');
        break;
      }
      case 'category': {
        setCurrentSrc(resolveGenericFallbackImage());
        setStage('generic');
        break;
      }
      case 'generic':
        // Even the generic local image failed — show placeholder
        setStage('placeholder');
        break;
      default:
        break;
    }
  }, [stage, category, title]);

  if (stage === 'placeholder') {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 ${wrapperClassName}`}
        role="img"
        aria-label={alt || 'Event-Bild'}
      >
        <svg
          className="w-10 h-10 text-white/10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {showSkeleton && !loaded && (
        <div className="absolute inset-0 skeleton" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={`${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 ${className}`}
        style={{
          objectFit,
          ...(objectPosition ? { objectPosition } : {}),
        }}
        loading={loading}
        fetchPriority={fetchPriority}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
      {showGradientOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
