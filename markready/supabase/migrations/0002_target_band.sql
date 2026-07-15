-- 0002_target_band.sql
-- Adds a user-set target band for dashboard goal tracking.
-- Apply via the Supabase SQL editor (see the 0001 note on how migrations are
-- deployed). Reads use the existing "Users read own profile" SELECT policy,
-- which already exposes this column to its owner. Writes go through the
-- service-role client in /api/target-band (bypasses RLS), matching the
-- app-wide convention that all writes are server-side.

alter table public.profiles
  add column if not exists target_band numeric(2,1);
