import type { ReactNode } from 'react';
import { cn } from './cn';

interface Props {
  src: string;
  alt: string;
  /** Caption rendered as overlay at the bottom of the image. */
  caption?: ReactNode;
  /** Tiny uppercase tag rendered at the top-left over a scrim. */
  tag?: ReactNode;
  /** Constrain the box aspect ratio. Default "4/5" — portrait DTC look. */
  aspect?: '1/1' | '4/5' | '3/4' | '16/9' | '21/9';
  /** Extra Tailwind on the wrapping figure. */
  className?: string;
  /** Subtle grading filter applied uniformly across the gallery. */
  grade?: 'cool' | 'warm' | 'none';
  priority?: boolean;
}

const ASPECT: Record<NonNullable<Props['aspect']>, string> = {
  '1/1': 'aspect-square',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
  '16/9': 'aspect-video',
  '21/9': 'aspect-[21/9]',
};

const GRADE: Record<NonNullable<Props['grade']>, string> = {
  // Slight bump in saturation/contrast + cool tint via mix-blend overlay.
  // Keeps the gallery visually coherent across mismatched Kontext renders.
  cool: '[filter:saturate(1.06)_contrast(1.04)_brightness(1.02)]',
  warm: '[filter:saturate(1.08)_contrast(1.03)_brightness(1.02)_sepia(0.06)]',
  none: '',
};

/**
 * Editorial image card with a uniform grade, optional tag, and overlay
 * caption. Use it for any lifestyle gallery on a landing page so the row
 * reads as one curated set rather than a pile of mismatched photos.
 */
export function ImagePlate({
  src,
  alt,
  caption,
  tag,
  aspect = '4/5',
  className,
  grade = 'cool',
  priority = false,
}: Props) {
  return (
    <figure className={cn('group relative overflow-hidden rounded-2xl bg-zinc-900', ASPECT[aspect], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]',
          GRADE[grade],
        )}
      />
      {/* Cool tint overlay — tames runaway warm Kontext renders. */}
      {grade === 'cool' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-40"
          style={{ background: 'linear-gradient(180deg, rgba(0,180,235,0.35) 0%, rgba(0,40,80,0.25) 100%)' }}
        />
      )}
      {tag && (
        <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-black/35 backdrop-blur-md px-3 py-1.5 text-kicker uppercase tracking-label text-white font-medium">
          {tag}
        </span>
      )}
      {caption && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
          />
          <figcaption className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6 text-white">
            <div className="font-serif text-xl sm:text-2xl leading-tight tracking-tight">
              {caption}
            </div>
          </figcaption>
        </>
      )}
    </figure>
  );
}
