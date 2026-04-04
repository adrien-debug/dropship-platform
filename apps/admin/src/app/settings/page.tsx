'use client';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Parametres</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold">Fournisseurs</h3>
          <div className="mt-4 space-y-3">
            <CredentialRow label="CJ Dropshipping API Key" envKey="CJ_DROPSHIPPING_API_KEY" />
            <CredentialRow label="Shopify Domain" envKey="SHOPIFY_STORE_DOMAIN" />
            <CredentialRow label="AliExpress App Key" envKey="ALIEXPRESS_APP_KEY" />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold">Infrastructure</h3>
          <div className="mt-4 space-y-3">
            <CredentialRow label="Coolify URL" envKey="COOLIFY_URL" />
            <CredentialRow label="Supabase URL" envKey="SUPABASE_URL" />
            <CredentialRow label="Medusa Backend" envKey="MEDUSA_BACKEND_URL" />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold">Marketing</h3>
          <div className="mt-4 space-y-3">
            <CredentialRow label="Google Ads" envKey="GOOGLE_ADS_DEVELOPER_TOKEN" />
            <CredentialRow label="Meta App ID" envKey="META_APP_ID" />
          </div>
        </section>
      </div>
    </div>
  );
}

function CredentialRow({ label, envKey }: { label: string; envKey: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-500">{envKey}</span>
    </div>
  );
}
