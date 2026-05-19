import { getDbRead } from '@/lib/db';
import { PageHeader, StatusPill, type Tone } from '@/app/admin/_components/AdminUI';
import { ButtonLink } from '@/components/ui';
// No additional imports needed — uses inline ct-* styles

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

  const aliTone: Tone = isConnected && !isExpired ? 'emerald' : 'neutral';
  const aliLabel = isConnected && !isExpired ? 'Connecté' : isConnected ? 'Token expiré' : 'Non connecté';

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <PageHeader
        kicker="Production · Intégrations"
        title={
          <>
            Connexions <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>fournisseurs</em>
          </>
        }
        lede="L'agent a besoin de ces clés pour interroger AliExpress et CJ. Les jetons OAuth expirent — vérifie l'état avant chaque grosse session."
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProviderCard
          name="AliExpress DS API"
          meta="AppKey 531346 · App Category: Drop Shipping"
          tone={aliTone}
          statusLabel={aliLabel}
        >
          {isConnected ? (
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, fontSize: 13 }}>
              {aliNick?.value && <DLRow label="Compte" value={aliNick.value} />}
              {expiresAt && (
                <DLRow
                  label="Expire le"
                  value={
                    <span style={{ color: isExpired ? 'var(--ct-text-faint)' : 'var(--ct-text-primary)' }}>
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
                  label="Derniere auth"
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
            <p style={{ fontSize: 13, color: 'var(--ct-text-muted)', lineHeight: 1.6 }}>
              L&apos;agent a besoin d&apos;un{' '}
              <code style={{ fontSize: 11, background: 'var(--ct-surface-3)', color: 'var(--ct-text-primary)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>access_token</code> OAuth pour appeler{' '}
              <code style={{ fontSize: 11, background: 'var(--ct-surface-3)', color: 'var(--ct-text-primary)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>aliexpress.solution.product.list.get</code>.
              Autorise l&apos;acc&egrave;s avec ton compte AliExpress.
            </p>
          )}

          <div className="pt-2">
            <ButtonLink
              href="/api/aliexpress/oauth/start"
              variant="primary"
              size="md"
              trailing={<span aria-hidden>↗</span>}
            >
              {isConnected && !isExpired ? 'Re-autoriser AliExpress' : 'Connecter AliExpress'}
            </ButtonLink>
          </div>
        </ProviderCard>

        <ProviderCard
          name="CJ Dropshipping API"
          meta="Email: adriennejkovic@gmail.com"
          tone="neutral"
          statusLabel="API Key manquante"
        >
          <p style={{ fontSize: 13, color: 'var(--ct-text-muted)', lineHeight: 1.6 }}>
            L&apos;authentification CJ n&eacute;cessite une <strong style={{ fontWeight: 600, color: 'var(--ct-text-primary)' }}>API Key d&eacute;di&eacute;e</strong>{' '}
            (pas le mot de passe du compte). Va sur{' '}
            <a
              href="https://cjdropshipping.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--ct-text-primary)', textDecoration: 'underline', textUnderlineOffset: 4 }}
            >
              cjdropshipping.com
            </a>{' '}
            &#8594; Account Settings &#8594; Developer &#8594; copie l&apos;API Key et mets-la dans{' '}
            <code style={{ fontSize: 11, background: 'var(--ct-surface-3)', color: 'var(--ct-text-primary)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>CJ_DROPSHIPPING_API_KEY</code>.
          </p>
        </ProviderCard>
      </div>
    </div>
  );
}

function DLRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-muted)', fontWeight: 700 }}>{label}</dt>
      <dd style={{ marginTop: 2, fontSize: 13, color: 'var(--ct-text-primary)' }}>{value}</dd>
    </div>
  );
}

function ProviderCard({
  name,
  meta,
  tone,
  statusLabel,
  children,
}: {
  name: string;
  meta: string;
  tone: Tone;
  statusLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      display: 'flex', flexDirection: 'column',
      border: '1px solid var(--ct-border)',
      background: 'var(--ct-surface-1)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ct-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 4, height: 36, borderRadius: 9999, background: 'var(--ct-accent)', flexShrink: 0 }} aria-hidden />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h3>
          <p style={{ fontSize: 12, color: 'var(--ct-text-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <StatusPill tone={tone}>{statusLabel}</StatusPill>
        </div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>{children}</div>
    </section>
  );
}
