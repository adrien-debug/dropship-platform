interface Props {
  count?: number;
  color?: string;
  size?: number;
}

export function Stars({ count = 5, color = '#0087BE', size = 14 }: Props) {
  return (
    <div className="flex gap-1" aria-label={`${count} étoiles sur 5`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 14 14" fill={color} aria-hidden="true">
          <path d="M7 0l1.764 4.236L13 4.764 9.764 7.764 10.528 12 7 9.764 3.472 12l.764-4.236L1 4.764l4.236-.528L7 0z" />
        </svg>
      ))}
    </div>
  );
}
