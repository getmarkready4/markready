-- Scoring attempt rate limit (10/hour, 20/day per non-staff user).
-- Concurrent grant_mark_pack idempotency.
-- Mark pack deletion protection (on delete restrict).

create table public.scoring_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index scoring_attempts_user_created_idx on public.scoring_attempts (user_id, created_at);

alter table public.scoring_attempts enable row level security;

-- Counts only; no read permissions from client roles.

create or replace function public.reserve_scoring(p_user_id uuid, p_task_type text, p_question text, p_essay text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_usage jsonb;
  v_staff boolean;
  v_pack_id uuid;
  v_row public.submissions;
  v_attempts_1h integer;
  v_attempts_24h integer;
  v_oldest_1h timestamptz;
  v_oldest_24h timestamptz;
  v_retry_at timestamptz;
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
    -- Rate limit check for non-staff users, after quota check passes
    -- Delete old attempts (bounded retention)
    delete from public.scoring_attempts
      where user_id = p_user_id and created_at < clock_timestamp() - interval '24 hours';

    -- Count attempts in last hour and 24 hours
    select count(*), min(created_at)
      into v_attempts_1h, v_oldest_1h
      from public.scoring_attempts
      where user_id = p_user_id and created_at >= clock_timestamp() - interval '1 hour';

    select count(*), min(created_at)
      into v_attempts_24h, v_oldest_24h
      from public.scoring_attempts
      where user_id = p_user_id and created_at >= clock_timestamp() - interval '24 hours';

    -- Check limits: 10/hour, 20/24h
    if v_attempts_1h >= 10 or v_attempts_24h >= 20 then
      -- Calculate retry_at as GREATEST of breached windows
      v_retry_at := greatest(
        case when v_attempts_1h >= 10 then v_oldest_1h + interval '1 hour' else clock_timestamp() end,
        case when v_attempts_24h >= 20 then v_oldest_24h + interval '24 hours' else clock_timestamp() end
      );
      return v_usage || jsonb_build_object('code', 'rate_limited', 'retry_at', v_retry_at);
    end if;
  end if;

  -- Insert attempt row (before the submission, so released attempts still count)
  if not coalesce(v_staff, false) then
    insert into public.scoring_attempts (user_id, created_at)
      values (p_user_id, clock_timestamp());
  end if;

  insert into public.submissions (user_id, task_type, question, essay, created_at, reservation_expires_at, pack_id)
    values (p_user_id, p_task_type, p_question, p_essay, clock_timestamp(), clock_timestamp() + interval '5 minutes', v_pack_id)
    returning * into v_row;
  return public.scoring_usage(p_user_id) || jsonb_build_object('id', v_row.id);
end;
$$;

create or replace function public.grant_mark_pack(
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

  -- Idempotent on (source, external_ref) with on conflict do nothing
  insert into public.mark_packs (user_id, marks_total, purchased_at, expires_at, source, external_ref, amount_usd_cents)
    values (p_user_id, p_marks, clock_timestamp(), clock_timestamp() + (p_days * interval '1 day'), p_source, p_external_ref, p_amount_usd_cents)
    on conflict (source, external_ref) where external_ref is not null do nothing
    returning * into v_row;

  if not found then
    -- Conflict: return existing row with duplicate: true
    select * into v_row from public.mark_packs
      where source = p_source and external_ref = p_external_ref;
    return jsonb_build_object('pack', to_jsonb(v_row), 'duplicate', true);
  end if;

  return jsonb_build_object('pack', to_jsonb(v_row), 'duplicate', false);
end;
$$;

-- Fix: submissions.pack_id should block direct pack deletion (not set null).
-- Use NO ACTION (checked at statement end) not RESTRICT (checked immediately):
-- RESTRICT would fail when deleting a profile (cascades to mark_packs), but NO ACTION
-- still blocks direct pack deletes and allows whole-account deletion to complete.
alter table public.submissions drop constraint submissions_pack_id_fkey;
alter table public.submissions
  add constraint submissions_pack_id_fkey
  foreign key (pack_id) references public.mark_packs(id) on delete no action;

-- Revoke/grant for service role only
revoke all on function public.reserve_scoring(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.grant_mark_pack(uuid, integer, integer, text, text, integer) from public, anon, authenticated;
revoke all on table public.scoring_attempts from public, anon, authenticated;

grant execute on function public.reserve_scoring(uuid, text, text, text) to service_role;
grant execute on function public.grant_mark_pack(uuid, integer, integer, text, text, integer) to service_role;
