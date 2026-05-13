import { cn } from '@/lib/utils/cn';

/**
 * Premium "monogram" avatar for stores in admin lists. Replaces the
 * generic ShoppingBag fallback so a list of 7 stores no longer reads
 * as 7 identical shopping bags. Each store gets a deterministic
 * gradient + first initial based on its slug — same store always
 * renders the same swatch, but the set as a whole is varied.
 */

interface Props {
  slug: string;
  name: string;
  size?: number;
  className?: string;
}

// Tuned for the indigo-leaning brand: every palette stays close to the
// admin's accent so the dashboard reads as one family, but each store
// gets its own distinct duo so the list has rhythm.
const PALETTES: Array<[string, string]> = [
  ['#6366f1', '#a78bfa'], // indigo → violet
  ['#0ea5e9', '#6366f1'], // sky → indigo
  ['#8b5cf6', '#ec4899'], // violet → pink
  ['#10b981', '#0ea5e9'], // emerald → sky
  ['#f59e0b', '#ef4444'], // amber → red
  ['#ec4899', '#6366f1'], // pink → indigo
  ['#06b6d4', '#10b981'], // cyan → emerald
  ['#a855f7', '#3b82f6'], // purple → blue
  ['#f97316', '#ec4899'], // orange → pink
  ['#14b8a6', '#6366f1'], // teal → indigo
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '·';
  const parts = cleaned.split(/[\s·\-_/]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function StoreAvatar({ slug, name, size = 32, className }: Props) {
  const idx = hashSlug(slug) % PALETTES.length;
  const [from, to] = PALETTES[idx]!;
  const fontSize = Math.round(size * 0.42);

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-white font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.08)] select-none',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        fontSize,
        lineHeight: 1,
      }}
    >
      {initials(name)}
    </span>
  );
}
