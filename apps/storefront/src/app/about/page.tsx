import Link from 'next/link';

export const metadata = {
  title: 'À propos — One Piece Store',
  description: 'Découvrez notre boutique de figurines et goodies One Piece.',
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 font-['Noto_Sans_JP',sans-serif]">
      <nav className="mb-6 text-sm text-[#999]">
        <Link href="/" className="hover:text-[#D9312B] transition-colors">Accueil</Link>
        <span className="mx-2">›</span>
        <span className="text-[#333]">À propos</span>
      </nav>

      <h1 className="mb-8 inline-block pb-2 text-2xl font-bold tracking-wider text-[#333] border-b-[3px] border-[#D9312B]">
        À PROPOS
      </h1>

      <div className="space-y-6 text-[#555] leading-relaxed">
        <p>
          Bienvenue sur <strong className="text-[#333]">One Piece Store</strong>, votre destination pour
          les figurines, t-shirts, mugs et goodies One Piece de qualité.
        </p>
        <p>
          Nous sélectionnons avec soin chaque produit pour offrir aux fans des articles fidèles
          à l&apos;univers créé par Eiichiro Oda. Des figurines Gear 5 aux accessoires du quotidien,
          chaque article est choisi pour sa qualité et son authenticité.
        </p>

        <h2 className="pt-4 text-lg font-bold text-[#333] border-b border-[#eee] pb-2">
          Notre engagement
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Produits vérifiés et de qualité</li>
          <li>Livraison suivie vers la France et l&apos;Europe</li>
          <li>Service client réactif</li>
          <li>Retours acceptés sous 14 jours</li>
        </ul>

        <h2 className="pt-4 text-lg font-bold text-[#333] border-b border-[#eee] pb-2">
          Livraison
        </h2>
        <p>
          Livraison standard gratuite dès 50€ d&apos;achat. Délai estimé : 7 à 15 jours ouvrés.
          Livraison express disponible au checkout.
        </p>

        <p className="pt-4 text-xs text-[#999]">
          Fan-made shop — Not affiliated with Shueisha or Toei Animation.
        </p>
      </div>
    </main>
  );
}
