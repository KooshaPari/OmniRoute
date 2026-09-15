-- 163_radar_feed_cache_generated_at.sql
--
-- radar_feed_cache (migration 136) kept only fetched_at — when this install
-- downloaded the feed — while the feed itself carries generatedAt, the date
-- its data was built. Nothing downstream could tell a recent download from
-- recent data: a feed fetched minutes ago can carry weeks-old figures.
--
-- radar_referrals_cache (migration 142) already persists that date; this
-- brings the catalog cache in line. NULL on rows cached before this column
-- existed — the date is unknown, and stays unknown rather than being stood in
-- for by fetched_at.

-- Ensure the radar_feed_cache table exists before altering it.
-- The canonical CREATE TABLE lives in migration 197 (renamed from 136_radar_cache_settings),
-- but because migration numbers were renumbered during a batch merge, 163 may run first.
CREATE TABLE IF NOT EXISTS radar_feed_cache (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  version    TEXT,
  tier       TEXT,
  payload    TEXT,
  signature  TEXT,
  fetched_at TEXT
);

ALTER TABLE radar_feed_cache ADD COLUMN generated_at TEXT DEFAULT NULL;
