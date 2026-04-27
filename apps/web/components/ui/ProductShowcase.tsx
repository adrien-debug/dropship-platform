import { cn } from './cn';
import { Product3DScene } from './Product3DScene';

interface Props {
  imageUrl: string;
  alt: string;
  primaryColor: string;
  accentColor: string;
  /** Optional tag rendered top-left over the canvas (e.g. "360°"). */
  tag?: string;
  /** Optional caption rendered bottom-left (e.g. "Drag to rotate"). */
  caption?: string;
  /** Aspect of the showcase frame. Default `16/10` works well full-bleed. */
  aspect?: '16/10' | '4/3' | '1/1';
  className?: string;
}

const ASPECT = {
  '16/10': 'aspect-[16/10]',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
} as const;

/**
 * Hero-product visualisation block. Renders a real 3D billboard of the
 * cutout PNG with helical airflow particles emanating from the lateral
 * vents. Drag to rotate, idle drift. Use it once per landing — it is the
 * page's centerpiece and reads as filler if repeated.
 *
 * Server-renderable shell: it ships an `<img>` fallback so SSR is non-empty,
 * and lazy-loads the three.js scene client-side on top.
 */
export function ProductShowcase({
  imageUrl,
  alt,
  primaryColor,
  accentColor,
  tag,
  caption,
  aspect = '16/10',
  className,
}: Props) {
  return (
    <div className={cn('relative w-full', className)}>
      {/* Frame: tall, full-width inside its Section, with a subtle radial
          accent glow piped from the brand colours. */}
      <div
        className={cn(
          'relative mx-auto w-full overflow-hidden rounded-[28px]',
          'bg-[radial-gradient(circle_at_50%_55%,rgba(255,255,255,0.06),transparent_60%)]',
          ASPECT[aspect],
        )}
        style={{
          background: `radial-gradient(circle at 50% 55%, ${accentColor}22 0%, transparent 55%), radial-gradient(circle at 80% 20%, ${primaryColor}33 0%, transparent 50%), #050608`,
        }}
      >
        {/* SSR fallback — also acts as a graceful fallback if WebGL is off. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="w-[55%] max-w-md drop-shadow-[0_30px_60px_rgba(0,0,0,0.55)] opacity-90"
          />
        </div>

        <Product3DScene
          imageUrl={imageUrl}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />

        {/* Vignette to push focus to the centre */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.55)_100%)]"
        />

        {/* Tag */}
        {tag && (
          <span className="absolute top-5 left-5 z-10 inline-flex items-center gap-2 rounded-full bg-white/8 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/85 font-medium">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
            {tag}
          </span>
        )}

        {/* Caption */}
        {caption && (
          <span className="absolute bottom-5 left-5 z-10 text-[10px] uppercase tracking-[0.3em] text-white/55 font-medium">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
