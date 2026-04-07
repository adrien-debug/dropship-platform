import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizedCustomerId } from '@/lib/api-auth';
import { loadCustomerDetail, isMissingTableError } from '@/lib/customer-repository';

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthorizedCustomerId(req, params.id);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await loadCustomerDetail(supabase, auth.customerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ addresses: result.addresses });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthorizedCustomerId(req, params.id);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const body = (await req.json()) as {
      label?: string;
      line1?: string;
      line2?: string;
      city?: string;
      postal_code?: string;
      country?: string;
      is_default?: boolean;
    };

    if (body.is_default) {
      await supabase
        .from('clawd_crm_addresses')
        .update({ is_default: false })
        .eq('customer_id', auth.customerId);
    }

    const { data, error } = await supabase
      .from('clawd_crm_addresses')
      .insert({
        customer_id: auth.customerId,
        label: body.label ?? null,
        line1: body.line1 ?? null,
        line2: body.line2 ?? null,
        city: body.city ?? null,
        postal_code: body.postal_code ?? null,
        country: body.country ?? null,
        is_default: body.is_default ?? false,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }
      console.error('[addresses/POST] Insert error:', error.message);
      return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
    }

    return NextResponse.json({
      address: {
        id: data.id,
        label: data.label,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        postalCode: data.postal_code,
        country: data.country,
        isDefault: data.is_default,
        createdAt: data.created_at,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[addresses/POST] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
