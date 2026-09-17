-- Free allowance becomes 2 successful marks per account, lifetime (was 1 per
-- UTC day). Paid marks come in packs — 20 marks, 30 days from purchase —
-- recorded in mark_packs and drawn down per submission via submissions.pack_id.
--
-- Additive and backward compatible: the previous deployment keeps working
-- against these functions (scoring_usage still emits reset_at for it), so
-- apply this migration FIRST, then deploy the application that reads the new
-- fields. Keep the additive schema on rollback.
--
-- Accounting rules:
--   * pack_id NULL on a submission = a free mark; otherwise the pack it came from.
--   * Only completed rows (scores not null) consume anything. An unexpired lease
--     holds a slot while a request is in flight; a released row is deleted.
--   * Free marks are spent first, then the unexpired pack closest to expiry.
--   * A pack chosen at reservation time is honoured even if it expires during
--     the ~30s scoring call; the reservation was validly granted.

create table public.mark_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  marks_total integer not null check (marks_total > 0),
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Refunds/chargebacks: set this rather than deleting the row.
  revoked_at timestamptz,
  source text not null default 'manual',
  external_ref text,
  amount_usd_cents integer,
  created_at timestamptz not null default now()
);

alter table public.mark_packs enable row level security;
create policy "Users read own packs"
  on public.mark_packs for select
  using (auth.uid() = user_id);

create index mark_packs_user_expiry_idx on public.mark_packs (user_id, expires_at);
-- Payment webhooks retry; the same external reference must never grant twice.
create unique index mark_packs_external_ref_idx on public.mark_packs (source, external_ref)
  where external_ref is not null;

alter table public.submissions
  add column pack_id uuid references public.mark_packs(id) on delete set null;
create index submissions_pack_idx on public.submissions (pack_id) where pack_id is not null;

-- Shared usage definition. The "2" here is the enforcing copy of the free
-- allowance; src/lib/quota.ts mirrors it for display only.
create or replace function public.scoring_usage(p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_completed integer;
  v_free_used integer;
  v_active_free integer;
  v_lease timestamptz;
  v_free_remaining integer;
  v_pack_remaining integer;
  v_next_expiry timestamptz;
begin
  -- One statement keeps completed and pending counts on the same snapshot.
  select
    count(*) filter (where scores is not null),
    count(*) filter (where scores is not null and pack_id is null),
    count(*) filter (where scores is null and reservation_expires_at > v_now and pack_id is null),
    max(reservation_expires_at) filter (where scores is null and reservation_expires_at > v_now)
  into v_completed, v_free_used, v_active_free, v_lease
  from public.submissions where user_id = p_user_id;

  v_free_remaining := greatest(0, 2 - v_free_used - v_active_free);

  -- Per unexpired, unrevoked pack: total minus completed minus in-flight.
  select coalesce(sum(remaining), 0), min(expires_at) filter (where remaining > 0)
  into v_pack_remaining, v_next_expiry
  from (
    select mp.expires_at,
      mp.marks_total - (
        select count(*) from public.submissions s
        where s.pack_id = mp.id and (s.scores is not null or s.reservation_expires_at > v_now)
      ) as remaining
    from public.mark_packs mp
    where mp.user_id = p_user_id and mp.revoked_at is null and mp.expires_at > v_now
  ) packs;

  return jsonb_build_object(
    'used_successful', v_completed,
    'free_used', v_free_used,
    'free_remaining', v_free_remaining,
    'pack_remaining', v_pack_remaining,
    'remaining', v_free_remaining + v_pack_remaining,
    'active', v_lease is not null,
    'lease_expires_at', v_lease,
    'next_expiry_at', v_next_expiry,
    -- Transitional: the previous deployment validates this field. Drop it once
    -- no deployed code reads it.
    'reset_at', date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC' + interval '1 day'
  );
end;
$$;

create or replace function public.reserve_scoring(p_user_id uuid, p_task_type text, p_question text, p_essay text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_usage jsonb;
  v_staff boolean;
  v_pack_id uuid;
  v_row public.submissions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select cohort = 'staff' into v_staff from public.profiles where id = p_user_id;
  v_usage := public.scoring_usage(p_user_id);
  if not coalesce(v_staff, false) then
    if (v_usage->>'active')::boolean then
      return v_usage || jsonb_build_object('code', 'request_active');
    end if;
    if (v_usage->>'free_remaining')::integer <= 0 then
      -- Free marks spent: draw from the pack closest to expiry that still has marks.
      select mp.id into v_pack_id
      from public.mark_packs mp
      where mp.user_id = p_user_id and mp.revoked_at is null and mp.expires_at > clock_timestamp()
        and mp.marks_total > (
          select count(*) from public.submissions s
          where s.pack_id = mp.id and (s.scores is not null or s.reservation_expires_at > clock_timestamp())
        )
      order by mp.expires_at asc
      limit 1;
      if v_pack_id is null then
        return v_usage || jsonb_build_object('code', 'quota_exhausted');
      end if;
    end if;
  end if;
  insert into public.submissions (user_id, task_type, question, essay, created_at, reservation_expires_at, pack_id)
    values (p_user_id, p_task_type, p_question, p_essay, clock_timestamp(), clock_timestamp() + interval '5 minutes', v_pack_id)
    returning * into v_row;
  return public.scoring_usage(p_user_id) || jsonb_build_object('id', v_row.id);
end;
$$;

-- Grants a pack. Called by the payment webhook once it exists; until then, run
-- it from the SQL editor after a manual payment:
--   select public.grant_mark_pack(id) from public.profiles where email = 'someone@example.com';
-- Idempotent on (source, external_ref) so a retried webhook cannot double-grant.
create function public.grant_mark_pack(
  p_user_id uuid,
  p_marks integer default 20,
  p_days integer default 30,
  p_source text default 'manual',
  p_external_ref text default null,
  p_amount_usd_cents integer default 2000
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.mark_packs;
begin
  if p_marks is null or p_marks <= 0 or p_days is null or p_days <= 0 then
    return jsonb_build_object('code', 'invalid_pack');
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return jsonb_build_object('code', 'unknown_user');
  end if;
  if p_external_ref is not null then
    select * into v_row from public.mark_packs
      where source = p_source and external_ref = p_external_ref;
    if found then
      return jsonb_build_object('pack', to_jsonb(v_row), 'duplicate', true);
    end if;
  end if;
  insert into public.mark_packs (user_id, marks_total, purchased_at, expires_at, source, external_ref, amount_usd_cents)
    values (p_user_id, p_marks, clock_timestamp(), clock_timestamp() + (p_days * interval '1 day'), p_source, p_external_ref, p_amount_usd_cents)
    returning * into v_row;
  return jsonb_build_object('pack', to_jsonb(v_row), 'duplicate', false);
end;
$$;

-- Service-role only, matching the existing scoring functions. Re-issued for the
-- replaced functions as well so the grant set is explicit in one place.
revoke all on function public.scoring_usage(uuid) from public, anon, authenticated;
revoke all on function public.reserve_scoring(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.grant_mark_pack(uuid, integer, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.scoring_usage(uuid) to service_role;
grant execute on function public.reserve_scoring(uuid, text, text, text) to service_role;
grant execute on function public.grant_mark_pack(uuid, integer, integer, text, text, integer) to service_role;
