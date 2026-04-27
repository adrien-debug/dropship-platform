export const metadata = {
  title: "Mentions légales — Hearst Corporation",
  description: "Informations sur l'éditeur du site, l'hébergeur et le directeur de publication.",
};

export default function MentionsLegales() {
  return (
    <>
      <h1 className="text-3xl font-bold text-zinc-900 mb-2">Mentions légales</h1>
      <p className="text-sm text-zinc-500 mb-8">Dernière mise à jour : 27 avril 2026</p>

      <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-3">Éditeur du site</h2>
      <p className="text-zinc-700">
        <strong>Hearst Corporation</strong><br />
        Représenté par Adrien Hearst, Directeur de la publication<br />
        Email : <a href="mailto:adrien@hearstcorporation.io" className="text-indigo-600 hover:underline">adrien@hearstcorporation.io</a><br />
        SIREN : à compléter<br />
        N° TVA intracommunautaire : à compléter
      </p>

      <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-3">Hébergement</h2>
      <p className="text-zinc-700">
        Le frontend est hébergé par <strong>Vercel Inc.</strong> — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis (
        <a href="https://vercel.com" className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">vercel.com</a>
        ). Le backend e-commerce et la base de données sont hébergés par <strong>Railway Corporation</strong> — 251 Little Falls Drive, Wilmington, DE 19808, États-Unis (
        <a href="https://railway.app" className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">railway.app</a>
        ).
      </p>

      <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-3">Propriété intellectuelle</h2>
      <p className="text-zinc-700">
        L’ensemble des contenus présents sur le site (textes, descriptions générées, agencement, code source, identité visuelle des boutiques) est la propriété de Hearst Corporation, sauf indication contraire. Toute reproduction sans autorisation préalable est interdite.
      </p>
      <p className="text-zinc-700 mt-3">
        Les images des produits proviennent des fournisseurs partenaires (AliExpress, CJ Dropshipping). Hearst Corporation ne revendique aucun droit sur ces visuels et les affiche dans le cadre de l’activité de revente.
      </p>

      <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-3">Responsabilité</h2>
      <p className="text-zinc-700">
        Hearst Corporation s’efforce d’assurer l’exactitude des informations diffusées sur le site mais ne peut garantir l’absence d’erreurs. Les délais de livraison annoncés sont indicatifs et dépendent du fournisseur d’origine.
      </p>

      <h2 className="text-xl font-semibold text-zinc-900 mt-8 mb-3">Contact</h2>
      <p className="text-zinc-700">
        Pour toute question, réclamation ou exercice des droits RGPD, écrire à{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="text-indigo-600 hover:underline">adrien@hearstcorporation.io</a>.
      </p>
    </>
  );
}
