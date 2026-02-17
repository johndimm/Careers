CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalized TEXT UNIQUE NOT NULL,
  summary TEXT,
  photo_url TEXT,
  raw_llm_response JSONB,
  llm_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalized TEXT UNIQUE NOT NULL,
  description TEXT,
  products TEXT,
  history TEXT,
  logo_url TEXT,
  domain TEXT,
  raw_llm_response JSONB,
  llm_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS person_company_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position TEXT,
  start_year INTEGER,
  end_year INTEGER,
  projects JSONB,
  coworkers JSONB,
  reports_to TEXT,
  performance_comments TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(person_id, company_id, position)
);

CREATE TABLE IF NOT EXISTS llm_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_type TEXT NOT NULL,
  query_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(query_type, query_key, provider)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_provider TEXT NOT NULL DEFAULT 'anthropic',
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO settings (id, active_provider) VALUES (1, 'anthropic')
ON CONFLICT (id) DO NOTHING;

-- Add image columns to existing tables (safe to run repeatedly)
DO $$ BEGIN
  ALTER TABLE persons ADD COLUMN IF NOT EXISTS photo_url TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
