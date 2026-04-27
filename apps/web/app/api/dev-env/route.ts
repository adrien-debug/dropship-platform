import { NextResponse } from 'next/server';
import { getMedusaBaseUrl } from '@/lib/medusa';

export async function GET() {
  const medusaUrl = getMedusaBaseUrl();
  const adminEmail = process.env.MEDUSA_ADMIN_EMAIL || '';
  const adminPassword = process.env.MEDUSA_ADMIN_PASSWORD || '';

  let publishableKey = '';
  try {
    const authRes = await fetch(`${medusaUrl}/auth/user/emailpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const auth = await authRes.json() as { token?: string };
    if (auth.token) {
      const keysRes = await fetch(`${medusaUrl}/admin/publishable-api-keys`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const keys = await keysRes.json() as { publishable_api_keys?: { token: string }[] };
      publishableKey = keys.publishable_api_keys?.[0]?.token || '';
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    MEDUSA_URL: medusaUrl,
    MEDUSA_ADMIN_EMAIL: adminEmail,
    MEDUSA_ADMIN_PASSWORD: adminPassword,
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: publishableKey,
    DATABASE_URL: process.env.DATABASE_URL || '',
  });
}
