interface Props {
  name: 'charge' | 'wear' | 'blow';
  /** Stroke color. Defaults to currentColor. */
  color?: string;
  /** Square size in px. Defaults to 56. */
  size?: number;
}

/**
 * Custom monoline icon set for the "Trois gestes" mode-d'emploi block.
 * Hand-drawn paths, intentionally not Lucide/Heroicons — they need to look
 * like part of the brand, not borrowed iconography. Add a new variant only
 * when you have a corresponding gesture step on the landing.
 */
export function GestureIcon({ name, color = 'currentColor', size = 56 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'charge') {
    return (
      <svg {...common}>
        {/* USB-C plug + cable curling into a battery silhouette */}
        <rect x="22" y="14" width="20" height="34" rx="6" />
        <line x1="28" y1="48" x2="36" y2="48" />
        <line x1="32" y1="48" x2="32" y2="54" />
        <path d="M28 22 L34 22 L30 30 L36 30 L28 42" />
        <line x1="22" y1="10" x2="42" y2="10" />
      </svg>
    );
  }

  if (name === 'wear') {
    return (
      <svg {...common}>
        {/* Stylized neck + open collar arc */}
        <ellipse cx="32" cy="20" rx="9" ry="10" />
        <path d="M22 30 C22 38 18 42 14 46" />
        <path d="M42 30 C42 38 46 42 50 46" />
        <path d="M14 46 C20 56 44 56 50 46" />
        <path d="M22 32 C26 36 38 36 42 32" />
      </svg>
    );
  }

  // blow — three curved airflow streams emerging from a focal point
  return (
    <svg {...common}>
      <circle cx="20" cy="32" r="3.5" />
      <path d="M24 26 C36 22 46 24 56 18" />
      <path d="M24 32 C36 32 46 32 58 32" />
      <path d="M24 38 C36 42 46 40 56 46" />
      <path d="M52 14 L56 18 L52 22" />
      <path d="M54 28 L58 32 L54 36" />
      <path d="M52 42 L56 46 L52 50" />
    </svg>
  );
}
