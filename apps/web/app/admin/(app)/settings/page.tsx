import { getDbRead } from '@/lib/db';
import { PageHeader, StatusPill, type Tone } from '../../_components/AdminUI';

export const dynamic = 'force-dynamic';

async function getSettings() {
  const db = getDbRead();
  const { rows } = await db.query<{ key: string; value: string; updated_at: Date }>(
    `SELECT key, value, updated_at FROM platform_settings ORDER BY key`,
  );
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
}

export default async function SettingsPage() {
  const settings = await getSettings();

  const aliToken = settings['aliexpress_access_token'];
  const aliNick = settings['aliexpress_user_nick'];
  const aliExpires = settings['aliexpress_token_expires'];

  const isConnected = !!aliToken?.value;
  const expiresAt = aliExpires?.value ? new Date(parseInt(aliExpires.value)) : null;
  const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;

  const aliTone: Tone = isConnected && !isExpired ? 'emerald' : isConnected ? 'amber' : 'red';
  const aliLabel = isConnected && !isExpired ? 'Connecté' : isConnected ? 'Token expiré' : 'Non connecté';

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        kicker="Production · Intégrations"
        title={
          <>
            Connexions <em className="italic text-zinc-400">fournisseurs</em>
          </>
        }
        lede="L’agent a besoin de ces clés pour interroger AliExpress et CJ. Les jetons OAuth expirent — vérifie l’état avant chaque grosse session."
      />

      <ProviderCard
        accent="#FF4F00"
        name="AliExpress DS API"
        meta="AppKey 531346 · App Category: Drop Shipping"
        tone={aliTone}
        statusLabel={aliLabel}
      >
        {isConnected ? (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
            {aliNick?.value && (
              <DLRow label="Compte" value={aliNick.value} />
            )}
            {expiresAt && (
              <DLRow
                label="Expire le"
                value={
                  <span className={isExpired ? 'text-zinc-500' : 'text-zinc-600'}>
                    {expiresAt.toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                }
              />
            )}
            {aliToken?.updatedAt && (
              <DLRow
                label="Dernière auth"
                value={new Date(aliToken.updatedAt).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            )}
          </dl>
        ) : (
          <p className="text-sm text-zinc-600 leading-relaxed">
            L’agent a besoin d’un{' '}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">access_token</code> OAuth pour appeler{' '}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">aliexpress.solution.product.list.get</code>.
            Autorise l’accès avec ton compte AliExpress.
          </p>
        )}

        <div className="pt-4">
          <a
            href="/api/aliexpress/oauth/start"
            className="inline-flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors shadow-cta"
          >
            {isConnected && !isExpired ? 'Re-autoriser AliExpress' : 'Connecter AliExpress'}
            <span aria-hidden>↗</span>
          </a>
        </div>
      </ProviderCard>

      <ProviderCard
        accent="#1976D2"
        name="CJ Dropshipping API"
        meta="Email: adriennejkovic@gmail.com"
        tone="amber"
        statusLabel="API Key manquante"
      >
        <p className="text-sm text-zinc-600 leading-relaxed">
          L’authentification CJ nécessite une <strong className="font-medium text-zinc-900">API Key dédiée</strong>{' '}
          (pas le mot de passe du compte). Va sur{' '}
          <a
            href="https://cjdropshipping.com"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 transition-colors"
          >
            cjdropshipping.com
          </a>{' '}
          → Account Settings → Developer → copie l’API Key et mets-la dans{' '}
          <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">CJ_DROPSHIPPING_API_KEY</code>.
        </p>
      </ProviderCard>
    </div>
  );
}

function DLRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-600">{value}</dd>
    </div>
  );
}

function ProviderCard({
  accent,
  name,
  meta,
  tone,
  statusLabel,
  children,
}: {
  accent: string;
  name: string;
  meta: string;
  tone: Tone;
  statusLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-zinc-200 bg-zinc-50 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200/70 flex items-center gap-4">
        <span className="w-1 h-10 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
        <div className="min-w-0">
          <h3 className="font-medium text-zinc-900">{name}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{meta}</p>
        </div>
        <div className="ml-auto">
          <StatusPill tone={tone}>{statusLabel}</StatusPill>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </section>
  );
}
