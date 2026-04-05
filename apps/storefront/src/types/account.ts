export interface ShopCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
  signupAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrdersSummary {
  orderCount: number;
  lifetimeValue: number;
  currency: string;
  lastOrderAt: string | null;
}

export interface ShopOrder {
  id: string;
  amountTotal: number;
  currency: string;
  status: string;
  externalRef: string | null;
  placedAt: string;
  createdAt: string;
}

export interface ShopAddress {
  id: string;
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface ShopCustomerDetailResponse {
  customer: ShopCustomer;
  ordersSummary: ShopOrdersSummary;
  orders: ShopOrder[];
  addresses: ShopAddress[];
}

export const SHOP_ORDER_STATUS_FILTERS = [
  'all',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type ShopOrderStatusFilter = (typeof SHOP_ORDER_STATUS_FILTERS)[number];
