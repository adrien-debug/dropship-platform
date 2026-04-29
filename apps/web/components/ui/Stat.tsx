interface Props {
  value: string;
  label: string;
}

export function Stat({ value, label }: Props) {
  return (
    <div>
      <div className="font-serif text-3xl sm:text-4xl text-zinc-900 mb-1 leading-none">{value}</div>
      <div className="text-kicker uppercase tracking-cta text-zinc-500 font-medium">{label}</div>
    </div>
  );
}
