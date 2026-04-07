CREATE TABLE IF NOT EXISTS clawd_crm_customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text,
  phone       text,
  password_hash text,
  notes       text,
  signup_at   timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clawd_crm_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid REFERENCES clawd_crm_customers(id) ON DELETE SET NULL,
  amount_total  numeric NOT NULL DEFAULT 0,
  currency      text DEFAULT 'EUR',
  status        text DEFAULT 'pending',
  external_ref  text,
  placed_at     timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clawd_crm_addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES clawd_crm_customers(id) ON DELETE CASCADE,
  label         text,
  line1         text,
  line2         text,
  city          text,
  postal_code   text,
  country       text,
  is_default    boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_email ON clawd_crm_customers (email);
CREATE INDEX IF NOT EXISTS idx_crm_orders_customer_id ON clawd_crm_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_addresses_customer_id ON clawd_crm_addresses (customer_id);
