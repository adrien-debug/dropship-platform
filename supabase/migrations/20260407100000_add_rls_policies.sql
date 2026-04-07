-- ============================================================
-- RLS policies for all tables
-- ============================================================

-- ========== ADMIN TABLES ==========
-- sites, catalogs, campaigns, sync_logs:
--   service_role → full CRUD
--   anon         → read-only

-- sites
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on sites"
  ON sites FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "anon read-only on sites"
  ON sites FOR SELECT
  USING (current_setting('role') = 'anon');

-- catalogs
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on catalogs"
  ON catalogs FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "anon read-only on catalogs"
  ON catalogs FOR SELECT
  USING (current_setting('role') = 'anon');

-- campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on campaigns"
  ON campaigns FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "anon read-only on campaigns"
  ON campaigns FOR SELECT
  USING (current_setting('role') = 'anon');

-- sync_logs
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on sync_logs"
  ON sync_logs FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "anon read-only on sync_logs"
  ON sync_logs FOR SELECT
  USING (current_setting('role') = 'anon');


-- ========== CRM TABLES ==========
-- clawd_crm_customers, clawd_crm_orders, clawd_crm_addresses:
--   service_role    → full CRUD
--   authenticated   → own data only (matched via auth.uid())

-- clawd_crm_customers
ALTER TABLE clawd_crm_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on clawd_crm_customers"
  ON clawd_crm_customers FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "authenticated users own data on clawd_crm_customers"
  ON clawd_crm_customers FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- clawd_crm_orders
ALTER TABLE clawd_crm_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on clawd_crm_orders"
  ON clawd_crm_orders FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "authenticated users own orders on clawd_crm_orders"
  ON clawd_crm_orders FOR ALL
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- clawd_crm_addresses
ALTER TABLE clawd_crm_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on clawd_crm_addresses"
  ON clawd_crm_addresses FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "authenticated users own addresses on clawd_crm_addresses"
  ON clawd_crm_addresses FOR ALL
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());


-- ========== PUBLIC TABLES ==========

-- contact_messages: anon can INSERT, service_role can SELECT
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role read on contact_messages"
  ON contact_messages FOR SELECT
  USING (current_setting('role') = 'service_role');

CREATE POLICY "anon insert on contact_messages"
  ON contact_messages FOR INSERT
  WITH CHECK (current_setting('role') = 'anon');

-- newsletter_subscribers: anon can INSERT, service_role can SELECT
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role read on newsletter_subscribers"
  ON newsletter_subscribers FOR SELECT
  USING (current_setting('role') = 'service_role');

CREATE POLICY "anon insert on newsletter_subscribers"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (current_setting('role') = 'anon');


NOTIFY pgrst, 'reload schema';
