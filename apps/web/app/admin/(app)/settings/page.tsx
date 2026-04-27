import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getSettings() {
  const db = getDb();
  const { rows } = await db.query<{ key: string; value: string; updated_at: Date }>(
    `SELECT key, value, updated_at FROM platform_settings ORDER BY key`,
  );
  return Object.fromEntries(rows.map(r => [r.key, { value: r.value, updatedAt: r.updated_at }]));
}

export default async function SettingsPage() {
  const settings = await getSettings();

  const aliToken = settings['aliexpress_access_token'];
  const aliNick = settings['aliexpress_user_nick'];
  const aliExpires = settings['aliexpress_token_expires'];

  const isConnected = !!aliToken?.value;
  const expiresAt = aliExpires?.value ? new Date(parseInt(aliExpires.value)) : null;
  const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Paramètres</h2>
        <p className="text-sm text-zinc-500 mt-1">Connexions API fournisseurs</p>
      </div>

      {/* AliExpress */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-zinc-50 flex items-center gap-3">
          <span className="text-2xl">🟠</span>
          <div>
            <h3 className="font-bold">AliExpress DS API</h3>
            <p className="text-xs text-zinc-500">AppKey: 531346 · App Category: Drop Shipping</p>
          </div>
          <div className="ml-auto">
            {isConnected && !isExpired ? (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">
                ✅ Connecté
              </span>
            ) : isConnected && isExpired ? (
              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1 rounded-full">
                ⚠️ Token expiré
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-3 py-1 rounded-full">
                ❌ Non connecté
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isConnected && (
            <div className="text-sm text-zinc-600 space-y-1">
              {aliNick?.value && <div><span className="font-medium">Compte :</span> {aliNick.value}</div>}
              {expiresAt && (
                <div>
                  <span className="font-medium">Token expire :</span>{' '}
                  <span className={isExpired ? 'text-red-600' : 'text-zinc-600'}>
                    {expiresAt.toLocaleString('fr-FR')}
                  </span>
                </div>
              )}
              {aliToken?.updatedAt && (
                <div>
                  <span className="font-medium">Dernière auth :</span>{' '}
                  {new Date(aliToken.updatedAt).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
          )}

          {!isConnected && (
            <p className="text-sm text-zinc-600">
              L&apos;agent a besoin d&apos;un <code className="bg-zinc-100 px-1 rounded">access_token</code> OAuth pour appeler <code className="bg-zinc-100 px-1 rounded">aliexpress.solution.product.list.get</code>.
              Clique sur le bouton pour autoriser l&apos;accès avec ton compte AliExpress.
            </p>
          )}

          <a
            href="/api/aliexpress/oauth/start"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {isConnected && !isExpired ? '🔄 Re-autoriser' : '🔗 Connecter AliExpress'}
          </a>
        </div>
      </div>

      {/* CJ Dropshipping */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-zinc-50 flex items-center gap-3">
          <span className="text-2xl">🔵</span>
          <div>
            <h3 className="font-bold">CJ Dropshipping API</h3>
            <p className="text-xs text-zinc-500">Email: adriennejkovic@gmail.com</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1 rounded-full">
              ⚠️ API Key manquante
            </span>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-zinc-600">
            L&apos;authentification CJ nécessite une <strong>API Key dédiée</strong> (pas le mot de passe du compte).
            Va sur <a href="https://cjdropshipping.com" target="_blank" className="text-blue-600 hover:underline">cjdropshipping.com</a> →
            Account Settings → Developer → copie l&apos;API Key et mets-la dans <code className="bg-zinc-100 px-1 rounded">CJ_DROPSHIPPING_API_KEY</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
