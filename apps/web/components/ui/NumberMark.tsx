interface Props {
  /** "01", "02", etc. */
  value: string;
  color?: string;
  size?: 'md' | 'lg' | 'xl';
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  md: 'text-4xl',
  lg: 'text-5xl',
  xl: 'text-6xl',
};

/**
 * Big serif number used to enumerate steps or features. Replaces the
 * emoji-icon-per-card pattern with a clean editorial ordinal.
 */
export function NumberMark({ value, color, size = 'lg' }: Props) {
  return (
    <div
      className={`font-serif leading-none ${SIZE[size]}`}
      style={color ? { color } : undefined}
    >
      {value}
    </div>
  );
}
