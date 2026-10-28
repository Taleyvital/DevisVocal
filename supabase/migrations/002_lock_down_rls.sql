-- The server now uses the service role key, which bypasses RLS.
-- Drop the permissive policies so the public anon key can no longer read or write quotes.
DROP POLICY IF EXISTS "service_artisans" ON artisans;
DROP POLICY IF EXISTS "service_quotes"   ON quotes;
