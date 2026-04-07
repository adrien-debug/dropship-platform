import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizedCustomerId } from '@/lib/api-auth';
import { loadCustomerDetail } from '@/lib/customer-repository';

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

  return NextResponse.json({
    customer: result.customer,
    ordersSummary: result.ordersSummary,
    orders: result.orders,
    addresses: result.addresses,
  });
}
