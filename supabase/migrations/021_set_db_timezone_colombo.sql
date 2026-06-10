-- 021_set_db_timezone_colombo.sql
--
-- Display-only change: sets the database default timezone so the Supabase SQL
-- editor, psql, and any client that does not set its own session timezone
-- renders timestamptz values in Sri Lanka time (+05:30) instead of UTC.
--
-- Storage is unaffected — timestamptz is always stored as UTC internally.
-- App code is unaffected — the Supabase JS client returns ISO strings with an
-- explicit offset, and all app-side formatting converts to Asia/Colombo
-- explicitly (lib/dateUtils.ts). Reversible with:
--   alter database postgres set timezone to 'UTC';
--
-- Takes effect on NEW connections; existing pooled connections keep their
-- session timezone until they reconnect.

alter database postgres set timezone to 'Asia/Colombo';
