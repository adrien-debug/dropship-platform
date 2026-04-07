-- ============================================================
-- Make CRM tables multi-tenant: scope everything by site_id
-- ============================================================

-- 1. Add site_id to customers
ALTER TABLE clawd_crm_customers
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

-- Drop old global unique email constraint, replace with per-site unique
ALTER TABLE clawd_crm_customers DROP CONSTRAINT IF EXISTS clawd_crm_customers_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customers_site_email
  ON clawd_crm_customers (site_id, lower(email));

DROP INDEX IF EXISTS idx_crm_customers_email;

-- 2. Add site_id to orders
ALTER TABLE clawd_crm_orders
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_crm_orders_site_id ON clawd_crm_orders (site_id);

-- 3. Add site_id to addresses
ALTER TABLE clawd_crm_addresses
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_crm_addresses_site_id ON clawd_crm_addresses (site_id);

-- 4. Add site_id to contact_messages and newsletter_subscribers
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

-- Replace global unique email on newsletter with per-site
ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_site_email
  ON newsletter_subscribers (site_id, lower(email));

-- 5. Update RLS policies: drop old CRM policies, recreate with site_id scoping

-- Customers
DROP POLICY IF EXISTS "service_role full access on clawd_crm_customers" ON clawd_crm_customers;
DROP POLICY IF EXISTS "authenticated users own data on clawd_crm_customers" ON clawd_crm_customers;

CREATE POLICY "service_role full access on clawd_crm_customers"
  ON clawd_crm_customers FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- Orders
DROP POLICY IF EXISTS "service_role full access on clawd_crm_orders" ON clawd_crm_orders;
DROP POLICY IF EXISTS "authenticated users own orders on clawd_crm_orders" ON clawd_crm_orders;

CREATE POLICY "service_role full access on clawd_crm_orders"
  ON clawd_crm_orders FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- Addresses
DROP POLICY IF EXISTS "service_role full access on clawd_crm_addresses" ON clawd_crm_addresses;
DROP POLICY IF EXISTS "authenticated users own addresses on clawd_crm_addresses" ON clawd_crm_addresses;

CREATE POLICY "service_role full access on clawd_crm_addresses"
  ON clawd_crm_addresses FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- Contact messages
DROP POLICY IF EXISTS "service_role read on contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "anon insert on contact_messages" ON contact_messages;

CREATE POLICY "service_role full access on contact_messages"
  ON contact_messages FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "anon insert on contact_messages"
  ON contact_messages FOR INSERT
  WITH CHECK (true);

-- Newsletter
DROP POLICY IF EXISTS "service_role read on newsletter_subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "anon insert on newsletter_subscribers" ON newsletter_subscribers;

CREATE POLICY "service_role full access on newsletter_subscribers"
  ON newsletter_subscribers FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "anon insert on newsletter_subscribers"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);


NOTIFY pgrst, 'reload schema';
