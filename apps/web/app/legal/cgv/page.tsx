export const metadata = {
  title: "Conditions Générales de Vente — Hearst Corporation",
  description: "CGV applicables aux achats effectués sur les boutiques opérées par Hearst Corporation.",
};

export default function CGV() {
  return (
    <>
      <h1 className="ct-title mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}>Dernière mise à jour : 27 avril 2026</p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>1. Objet</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les présentes CGV régissent l’ensemble des ventes conclues entre Hearst Corporation (ci-après « le Vendeur ») et tout acheteur particulier ou professionnel (ci-après « le Client ») via les boutiques en ligne accessibles sur ce site. Toute commande implique l’acceptation pleine et entière des CGV en vigueur au moment de la commande.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>2. Produits</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les produits proposés sont des biens d’importation expédiés par des fournisseurs partenaires internationaux (notamment AliExpress et CJ Dropshipping). Les caractéristiques essentielles, photographies et prix figurent sur chaque fiche produit. Les visuels sont fournis à titre indicatif ; de légères variations sont possibles.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>3. Prix</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les prix sont indiqués en euros (€), toutes taxes comprises (TTC) hors frais de livraison. Le Vendeur se réserve le droit de modifier ses prix à tout moment ; les commandes seront facturées sur la base des tarifs en vigueur au moment de leur validation.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>4. Commande</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        La commande devient ferme et définitive après confirmation du paiement. Un email de confirmation est envoyé à l’adresse renseignée par le Client. Le Vendeur se réserve le droit de refuser ou d’annuler toute commande en cas de litige antérieur, de soupçon de fraude ou de rupture de stock chez le fournisseur.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>5. Paiement</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Le paiement est traité par <strong>Stripe Payments Europe Ltd</strong> (Dublin, Irlande), prestataire certifié PCI-DSS. Les moyens de paiement acceptés sont les cartes bancaires (Visa, Mastercard, American Express) et les portefeuilles compatibles (Apple Pay, Google Pay, Link). Aucune donnée bancaire n’est conservée sur les serveurs de Hearst Corporation.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>6. Livraison</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les produits sont expédiés depuis l’entrepôt du fournisseur (généralement Chine ou Asie). Les délais indicatifs sont :
      </p>
      <ul className="list-disc list-inside mt-2 space-y-1" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <li>France métropolitaine et UE : 15 à 30 jours ouvrés</li>
        <li>Reste du monde : 20 à 45 jours ouvrés</li>
      </ul>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Ces délais peuvent être allongés en période de forte affluence (soldes, fêtes, Nouvel An chinois). Un numéro de suivi est communiqué par email dès l’expédition. Le Client est responsable de l’exactitude de l’adresse de livraison.
      </p>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        En cas de non-réception après 60 jours, le Client peut demander un remboursement intégral en écrivant à{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>7. Droit de rétractation</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Conformément à l’article L221-18 du Code de la consommation, le Client dispose de <strong>14 jours francs</strong> à compter de la réception du produit pour exercer son droit de rétractation, sans avoir à justifier de motif. La demande s’effectue par email à{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a>. Les frais de retour sont à la charge du Client. Le remboursement intervient dans un délai maximum de 14 jours après réception du bien retourné en parfait état.
      </p>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Sont exclus du droit de rétractation, conformément à l’article L221-28 : les biens personnalisés, scellés et descellés par le Client (hygiène), ou consommables périssables.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>8. Garanties</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Le Client bénéficie de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation) et de la garantie contre les vices cachés (articles 1641 et suivants du Code civil). En cas de produit défectueux à réception, contacter{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a> sous 30 jours avec photos à l’appui.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>9. Responsabilité</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        La responsabilité du Vendeur ne saurait être engagée pour tout dommage indirect résultant de l’utilisation des produits. Le Vendeur ne garantit pas la disponibilité ininterrompue du site.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>10. Données personnelles</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les données collectées sont traitées conformément à la{' '}
        <a href="/legal/confidentialite" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>Politique de confidentialité</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>11. Litiges</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les présentes CGV sont régies par le droit français. En cas de litige, le Client est invité à contacter le service client à{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a>{' '}
        afin de chercher une solution amiable. À défaut, le Client peut recourir à la plateforme européenne de règlement en ligne des litiges :{' '}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>ec.europa.eu/consumers/odr</a>. À défaut de résolution amiable, les tribunaux français sont seuls compétents.
      </p>
    </>
  );
}
