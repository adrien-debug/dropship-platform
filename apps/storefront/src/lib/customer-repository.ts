import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeLifetimeValueEur,
  countBillableOrders,
  lastOrderPlacedAt,
} from './crm-metrics-lite';
import type { ShopAddress, ShopCustomer, ShopOrder, ShopOrdersSummary } from '@/types/account';

interface CustomerRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
  signup_at: string;
  created_at: string;
  updated_at: string;
}

interface OrderRow {
  id: string;
  customer_id: string;
  amount_total: string | number;
  currency: string;
  status: string;
  external_ref: string | null;
  placed_at: string;
  created_at: string;
}

interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  is_default: boolean;
  created_at: string;
}

export function isMissingTableError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = err.message ?? '';
  return err.code === '42P01' || m.includes('does not exist') || m.includes('schema cache');
}

export async function loadCustomerDetail(
  db: SupabaseClient,
  id: string,
): Promise<
  | {
      ok: true;
      customer: ShopCustomer;
      ordersSummary: ShopOrdersSummary;
      orders: ShopOrder[];
      addresses: ShopAddress[];
    }
  | { ok: false; status: number; error: string }
> {
  const { data: cRow, error: cErr } = await db
    .from('clawd_crm_customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (cErr) {
    if (isMissingTableError(cErr)) {
      return { ok: false, status: 503, error: 'Customer store unavailable' };
    }
    return { ok: false, status: 500, error: 'Failed to load customer' };
  }
  if (!cRow) {
    return { ok: false, status: 404, error: 'Customer not found' };
  }

  const c = cRow as CustomerRow;

  const [{ data: orderData, error: oErr }, { data: addrData, error: aErr }] = await Promise.all([
    db
      .from('clawd_crm_orders')
      .select('*')
      .eq('customer_id', id)
      .order('placed_at', { ascending: false })
      .limit(500),
    db.from('clawd_crm_addresses').select('*').eq('customer_id', id).order('created_at'),
  ]);

  if (oErr && !isMissingTableError(oErr)) {
    return { ok: false, status: 500, error: 'Failed to load orders' };
  }
  if (aErr && !isMissingTableError(aErr)) {
    return { ok: false, status: 500, error: 'Failed to load addresses' };
  }

  const ords = (orderData ?? []) as OrderRow[];
  const lifetimeValue = computeLifetimeValueEur(ords);
  const orderCount = countBillableOrders(ords);
  const lastAt = lastOrderPlacedAt(
    ords.map(o => ({ placed_at: o.placed_at, status: o.status })),
  );

  const customer: ShopCustomer = {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    notes: c.notes,
    signupAt: c.signup_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };

  const ordersSummary: ShopOrdersSummary = {
    orderCount,
    lifetimeValue,
    currency: 'EUR',
    lastOrderAt: lastAt,
  };

  const orders: ShopOrder[] = ords.map((o: OrderRow) => ({
    id: o.id,
    amountTotal: Number(o.amount_total),
    currency: o.currency,
    status: o.status,
    externalRef: o.external_ref,
    placedAt: o.placed_at,
    createdAt: o.created_at,
  }));

  const addresses: ShopAddress[] = ((addrData ?? []) as AddressRow[]).map(a => ({
    id: a.id,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    postalCode: a.postal_code,
    country: a.country,
    isDefault: a.is_default,
    createdAt: a.created_at,
  }));

  return { ok: true, customer, ordersSummary, orders, addresses };
}

export async function findCustomerByEmail(
  db: SupabaseClient,
  email: string,
): Promise<CustomerRow | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await db
    .from('clawd_crm_customers')
    .select('*')
    .ilike('email', normalized)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(error.message);
  }
  return (data ?? null) as CustomerRow | null;
}
