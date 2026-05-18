export const metadata = {
  title: "Mentions légales — Hearst Corporation",
  description: "Informations sur l'éditeur du site, l'hébergeur et le directeur de publication.",
};

export default function MentionsLegales() {
  return (
    <>
      <h1 className="ct-title mb-2">Mentions légales</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}>Dernière mise à jour : 27 avril 2026</p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Éditeur du site</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <strong>Hearst Corporation</strong><br />
        Représenté par Adrien Hearst, Directeur de la publication<br />
        Email : <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a><br />
        SIREN : à compléter<br />
        N° TVA intracommunautaire : à compléter
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Hébergement</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Le frontend est hébergé par <strong>Vercel Inc.</strong> — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis (
        <a href="https://vercel.com" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }} target="_blank" rel="noreferrer">vercel.com</a>
        ). Le backend e-commerce et la base de données sont hébergés par <strong>Railway Corporation</strong> — 251 Little Falls Drive, Wilmington, DE 19808, États-Unis (
        <a href="https://railway.app" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }} target="_blank" rel="noreferrer">railway.app</a>
        ).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Propriété intellectuelle</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        L’ensemble des contenus présents sur le site (textes, descriptions générées, agencement, code source, identité visuelle des boutiques) est la propriété de Hearst Corporation, sauf indication contraire. Toute reproduction sans autorisation préalable est interdite.
      </p>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les images des produits proviennent des fournisseurs partenaires (AliExpress, CJ Dropshipping). Hearst Corporation ne revendique aucun droit sur ces visuels et les affiche dans le cadre de l’activité de revente.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Responsabilité</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Hearst Corporation s’efforce d’assurer l’exactitude des informations diffusées sur le site mais ne peut garantir l’absence d’erreurs. Les délais de livraison annoncés sont indicatifs et dépendent du fournisseur d’origine.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Contact</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Pour toute question, réclamation ou exercice des droits RGPD, écrire à{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a>.
      </p>
    </>
  );
}
