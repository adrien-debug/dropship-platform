import Link from 'next/link';

const FOOTER_LINKS = [
  { label: 'Boutique', href: '/shop' },
  { label: 'Nouveautes', href: '/new-arrivals' },
  { label: 'Categories', href: '/categories' },
  { label: 'Panier', href: '/cart' },
  { label: 'Newsletter', href: '/newsletter' },
  { label: 'Mon Compte', href: '/account' },
  { label: 'Administration', href: '/admin/login' },
];

export function OnePieceFooter() {
  return (
    <footer className="border-t-[3px] border-[#D9312B] bg-[#1a1a1a] py-16 text-white font-['Noto_Sans_JP',sans-serif]">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="flex flex-col items-center gap-10">
          <img
            src="/logo-onepiece.png"
            alt="ONE PIECE SHOP"
            className="h-16 brightness-0 invert opacity-80"
          />

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[11px] font-bold text-[#999]">
            {FOOTER_LINKS.map(link => (
              <Link key={link.href} href={link.href} className="hover:text-[#D9312B] transition-colors">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="h-px w-full max-w-[400px] bg-[#D9312B]/30" />

          <p className="text-[10px] text-[#555] tracking-tight text-center">
            Fan-made shop &mdash; Not affiliated with Shueisha or Toei Animation
          </p>
        </div>
      </div>
    </footer>
  );
}
