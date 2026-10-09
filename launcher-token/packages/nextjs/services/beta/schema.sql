-- Additive migration. No existing hosting/backup tables are modified.
CREATE TABLE IF NOT EXISTS beta_challenges (
  token_hash text PRIMARY KEY, message text NOT NULL, address text NOT NULL,
  expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE IF NOT EXISTS beta_sessions (
  token_hash text PRIMARY KEY, address text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS beta_admission (
  id bigserial PRIMARY KEY, address text NOT NULL, role text NOT NULL CHECK (role IN ('launcher','participant')),
  admitted boolean NOT NULL, actor text NOT NULL, reason text NOT NULL, source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE beta_admission ADD COLUMN IF NOT EXISTS transaction_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS beta_admission_receipt ON beta_admission(transaction_hash) WHERE transaction_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS beta_admission_latest ON beta_admission(address, role, id DESC);
CREATE TABLE IF NOT EXISTS beta_proposals (
  id text PRIMARY KEY, family text NOT NULL, predecessor text REFERENCES beta_proposals(id),
  launcher text NOT NULL, revision text NOT NULL, terms jsonb NOT NULL,
  source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beta_proposals_launcher ON beta_proposals(launcher, created_at DESC);
CREATE TABLE IF NOT EXISTS beta_reviews (
  id bigserial PRIMARY KEY, proposal text NOT NULL REFERENCES beta_proposals(id),
  action text NOT NULL CHECK (action IN ('approve','reject','revoke')),
  actor text NOT NULL, reason text NOT NULL, source text NOT NULL,
  transaction_hash text NOT NULL UNIQUE, block_number text NOT NULL, block_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beta_reviews_latest ON beta_reviews(proposal, id DESC);
