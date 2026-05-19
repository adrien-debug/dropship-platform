export const metadata = {
  title: "Politique de confidentialité — Hearst Corporation",
  description: "Traitement des données personnelles et droits RGPD applicables aux clients.",
};

export default function Confidentialite() {
  return (
    <>
      <h1 className="ct-title mb-2">Politique de confidentialité</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}>Dernière mise à jour : 27 avril 2026</p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Responsable du traitement</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <strong>Hearst Corporation</strong>, représentée par Adrien Hearst, est responsable du traitement des données personnelles collectées sur ce site.<br />
        Contact :{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a>
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Données collectées</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Lors d’une commande, les données suivantes sont collectées :
      </p>
      <ul className="list-disc list-inside mt-2 space-y-1" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <li>Identité : nom, prénom</li>
        <li>Coordonnées : email, téléphone, adresse postale de livraison</li>
        <li>Données de transaction : référence de commande, montant, historique d’achat</li>
        <li>Données techniques : adresse IP, type de navigateur, pages consultées</li>
      </ul>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les données bancaires (numéro de carte, cryptogramme) sont collectées et stockées exclusivement par notre prestataire de paiement Stripe ; Hearst Corporation n’y a jamais accès.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Finalités du traitement</h2>
      <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <li>Traitement et expédition des commandes (base légale : exécution du contrat)</li>
        <li>Service après-vente et gestion des litiges (intérêt légitime)</li>
        <li>Comptabilité et obligations fiscales (obligation légale)</li>
        <li>Lutte contre la fraude (intérêt légitime)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Destinataires</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les données sont communiquées aux sous-traitants strictement nécessaires :
      </p>
      <ul className="list-disc list-inside mt-2 space-y-1" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <li><strong>Stripe</strong> (Irlande, États-Unis) — paiement</li>
        <li><strong>Vercel</strong> (États-Unis) — hébergement frontend</li>
        <li><strong>Railway</strong> (États-Unis) — hébergement backend e-commerce et base de données</li>
        <li><strong>AliExpress / CJ Dropshipping</strong> (Chine) — préparation et expédition de la commande (nom, adresse de livraison uniquement)</li>
        <li><strong>Anthropic</strong> (États-Unis) — génération de contenu produit (aucune donnée client transmise)</li>
      </ul>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Les transferts hors Union Européenne s’effectuent sur la base de clauses contractuelles types validées par la Commission européenne.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Durée de conservation</h2>
      <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <li>Données de commande et de facturation : 10 ans (obligation comptable)</li>
        <li>Données de prospection : 3 ans après le dernier contact</li>
        <li>Logs techniques : 12 mois</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Vos droits</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Conformément au Règlement (UE) 2016/679 (RGPD) et à la Loi Informatique et Libertés, vous disposez des droits suivants :
      </p>
      <ul className="list-disc list-inside mt-2 space-y-1" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        <li>Droit d’accès, de rectification et d’effacement</li>
        <li>Droit à la limitation et à la portabilité</li>
        <li>Droit d’opposition à un traitement</li>
        <li>Droit de définir des directives post-mortem</li>
      </ul>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Pour exercer ces droits, écrire à{' '}
        <a href="mailto:adrien@hearstcorporation.io" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>adrien@hearstcorporation.io</a> en joignant un justificatif d’identité. Une réponse est apportée sous un mois.
      </p>
      <p className="mt-3" style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        En cas de réponse jugée insatisfaisante, vous pouvez introduire une réclamation auprès de la Commission Nationale de l’Informatique et des Libertés (CNIL) :{' '}
        <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: 'var(--ct-accent, #be123c)' }}>cnil.fr</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--ct-text-strong)' }}>Cookies</h2>
      <p style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}>
        Le site utilise uniquement des cookies strictement nécessaires au fonctionnement du panier et de l’authentification (durée de vie : session ou 30 jours). Aucun cookie tiers de mesure d’audience ou de publicité n’est déposé sans consentement explicite.
      </p>
    </>
  );
}
