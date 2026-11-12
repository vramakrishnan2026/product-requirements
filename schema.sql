-- Product Spec Configurator — D1 schema (Phase 1)
-- Run once in the Cloudflare dashboard: D1 > product-spec-db > Console, paste and Execute.
-- Safe to re-run: every statement uses IF NOT EXISTS / INSERT OR IGNORE.

-- One row per requirement sheet. The full answers live in `data` (JSON),
-- so new questions can be added to the form without a migration.
CREATE TABLE IF NOT EXISTS specs (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  product_type  TEXT,
  product_family TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft | submitted | in_review | approved | archived
  requested_by  TEXT,
  data          TEXT NOT NULL,                   -- JSON: { fieldKey: value, ... }
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_specs_updated ON specs(updated_at DESC);

-- Flattened copy of every answer (one row per field / per selected option).
-- Rewritten on each save. This is the pipeline for Phase 2 product matching
-- and BOQ costing: both can query "which specs/products need X" with plain SQL.
CREATE TABLE IF NOT EXISTS spec_values (
  spec_id   TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  section   TEXT NOT NULL,
  key       TEXT NOT NULL,        -- e.g. comms.rs485.protocols
  value     TEXT,                 -- e.g. bacnet_mstp   (multi-selects get one row per option)
  num_value REAL                  -- numeric answers (I/O counts, sizes) for range comparisons
);
CREATE INDEX IF NOT EXISTS idx_spec_values_key ON spec_values(key, value);
CREATE INDEX IF NOT EXISTS idx_spec_values_spec ON spec_values(spec_id);

-- Edit history: previous version of `data` each time a spec is saved.
CREATE TABLE IF NOT EXISTS spec_history (
  spec_id    TEXT NOT NULL,
  data       TEXT NOT NULL,
  status     TEXT,
  saved_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_spec_history_spec ON spec_history(spec_id, saved_at DESC);

-- Product families offered in the "reuse plastics / product family" dropdown.
-- PLACEHOLDERS: edit names and details to match the real product line.
CREATE TABLE IF NOT EXISTS product_families (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  notes       TEXT,
  sort_order  INTEGER DEFAULT 100,
  active      INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO product_families (id, name, notes, sort_order) VALUES
  ('omnistat',  'OmniStat',       'Placeholder — confirm enclosure / plastics details', 10),
  ('mystat',    'MyStat',         'Placeholder', 20),
  ('verosense', 'VeroSense',      'Placeholder', 30),
  ('smartnode', 'Smart Node',     'Placeholder', 40),
  ('ccu',       'CCU',            'Placeholder', 50),
  ('connect',   'Connect Module', 'Placeholder', 60);

-- ---------- Phase 2: product matching (tables created now, left empty) ----------
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  family_id   TEXT REFERENCES product_families(id),
  status      TEXT DEFAULT 'active',   -- active | eol | in_development
  notes       TEXT
);
-- Same key/value shape as spec_values, so matching is a join on (key, value).
CREATE TABLE IF NOT EXISTS product_capabilities (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT,
  num_value  REAL
);
CREATE INDEX IF NOT EXISTS idx_product_caps_key ON product_capabilities(key, value);

-- ---------- Phase 3: BOQ costing (created now, left empty) ----------
CREATE TABLE IF NOT EXISTS boq_items (
  part_no     TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category    TEXT,          -- e.g. relay, mcu, display, radio, plastics
  unit_cost   REAL,
  currency    TEXT DEFAULT 'USD',
  supplier    TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);
-- Which BOQ parts a requirement pulls in, e.g. key=comms.interfaces value=rs485 -> transceiver part.
CREATE TABLE IF NOT EXISTS boq_feature_map (
  key       TEXT NOT NULL,
  value     TEXT,
  part_no   TEXT NOT NULL REFERENCES boq_items(part_no),
  qty_rule  TEXT DEFAULT '1'   -- '1', or a field key like 'io.relays' meaning "qty = that count"
);
