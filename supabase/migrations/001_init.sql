-- Artisans
CREATE TABLE IF NOT EXISTS artisans (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number  TEXT        UNIQUE NOT NULL,
  name          TEXT,
  company_name  TEXT,
  email         TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id         UUID        REFERENCES artisans(id) ON DELETE CASCADE,
  quote_number       TEXT        NOT NULL UNIQUE,
  client_name        TEXT        NOT NULL,
  items              JSONB       NOT NULL DEFAULT '[]',
  total_ht           NUMERIC(12, 0) NOT NULL,
  tva                NUMERIC(12, 0) NOT NULL,
  total_ttc          NUMERIC(12, 0) NOT NULL,
  pdf_url            TEXT,
  status             TEXT        NOT NULL DEFAULT 'draft',
  raw_transcription  TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Storage bucket for PDFs (run once via Supabase dashboard or CLI)
 INSERT INTO storage.buckets (id, name, public) VALUES ('quotes', 'quotes', true)
 ON CONFLICT DO NOTHING;

-- Policies: allow service role full access
ALTER TABLE artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_artisans" ON artisans USING (true) WITH CHECK (true);
CREATE POLICY "service_quotes"   ON quotes   USING (true) WITH CHECK (true);
