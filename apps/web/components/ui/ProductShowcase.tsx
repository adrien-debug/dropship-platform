import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  imageUrl: string;
  alt: string;
  primaryColor: string;
  accentColor: string;
  /** Optional kicker rendered inside the dark frame, top of the text column. */
  kicker?: string;
  /** Optional headline rendered inside the dark frame. Use ReactNode to allow
   *  inline italic emphasis on a key word. */
  headline?: ReactNode;
  /** Optional supporting copy rendered under the headline. */
  lede?: ReactNode;
  /** Aspect of the showcase frame. Default `16/10`. */
  aspect?: '16/10' | '4/3' | '1/1';
  className?: string;
}

const ASPECT = {
  '16/10': 'aspect-[16/10]',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
} as const;

/**
 * Hero-product visualisation block. Dark stage with a soft accent halo, the
 * cutout PNG centered (or right-aligned when paired with a headline) and
 * breathing with a barely-perceptible float. Pass `kicker`/`headline`/`lede`
 * to integrate the section title INSIDE the frame — fills the dark space
 * editorially instead of leaving the stage feeling empty. Use it once per
 * landing as the page's centerpiece.
 */
export function ProductShowcase({
  imageUrl,
  alt,
  primaryColor,
  accentColor,
  kicker,
  headline,
  lede,
  aspect = '16/10',
  className,
}: Props) {
  const hasText = Boolean(kicker || headline || lede);

  return (
    <div className={cn('relative w-full', className)}>
      <div
        className={cn(
          'relative mx-auto w-full overflow-hidden rounded-[28px]',
          ASPECT[aspect],
        )}
        style={{
          background: `radial-gradient(circle at ${hasText ? '70% 55%' : '50% 55%'}, ${accentColor}26 0%, transparent 55%), radial-gradient(circle at 85% 15%, ${primaryColor}33 0%, transparent 55%), #050608`,
        }}
      >
        {/* Soft accent halo behind product. Shifts right when the layout has a
            text column on the left. */}
        <div
          aria-hidden="true"
          className={cn(
            'brisa-showcase-halo absolute rounded-full blur-3xl pointer-events-none',
            hasText
              ? 'top-1/2 -translate-y-1/2 right-[5%] w-[55%] h-[80%]'
              : 'inset-0 m-auto w-[55%] h-[55%]',
          )}
          style={{
            background: `radial-gradient(circle, ${accentColor}66 0%, ${primaryColor}1a 45%, transparent 75%)`,
          }}
        />

        {hasText ? (
          <div className="relative h-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center px-6 sm:px-10 lg:px-16 py-8 sm:py-12">
            <div className="md:col-span-5 lg:col-span-5 text-white max-w-md md:max-w-none">
              {kicker && (
                <p className="text-kicker uppercase tracking-kicker font-medium text-white/55 mb-4 sm:mb-5">
                  {kicker}
                </p>
              )}
              {headline && (
                <h2 className="font-semibold tracking-tight leading-[1.05] text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-white">
                  {headline}
                </h2>
              )}
              {lede && (
                <p className="mt-5 text-base sm:text-lg text-white/70 leading-relaxed max-w-md">
                  {lede}
                </p>
              )}
            </div>
            <div className="md:col-span-7 lg:col-span-7 relative h-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={alt}
                className="brisa-showcase-product relative max-h-[85%] w-auto object-contain drop-shadow-[0_40px_70px_rgba(0,0,0,0.6)]"
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={alt}
              className="brisa-showcase-product relative max-h-full w-auto object-contain drop-shadow-[0_40px_70px_rgba(0,0,0,0.6)]"
            />
          </div>
        )}

        {/* Vignette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,0,0,0.55)_100%)]"
        />
      </div>
    </div>
  );
}
