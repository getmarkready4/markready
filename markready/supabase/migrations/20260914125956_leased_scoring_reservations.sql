-- Migration-first cutover: pause scoring, drain ALL old unfenced workers,
-- apply this migration, deploy the leased route, then reopen scoring.
-- Keep this additive schema on rollback; never overlap old and new workers.
alter table public.submissions add column reservation_expires_at timestamptz;

create index submissions_active_lease_idx on public.submissions (user_id, reservation_expires_at)
  where scores is null and reservation_expires_at is not null;

-- Shared usage definition: successful marks belong to their reservation's
-- UTC start day; an active lease blocks overlapping work even across midnight.
create function public.scoring_usage(p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day timestamptz;
  v_used integer;
  v_expiry timestamptz;
begin
  v_day := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  -- One statement keeps completed and pending counts on the same snapshot.
  select count(*) filter (where scores is not null and created_at >= v_day and created_at < v_day + interval '1 day'),
    max(reservation_expires_at) filter (where scores is null and reservation_expires_at > v_now)
    into v_used, v_expiry from public.submissions where user_id = p_user_id;
  return jsonb_build_object('used_successful', v_used, 'active', v_expiry is not null,
    'lease_expires_at', v_expiry, 'reset_at', v_day + interval '1 day');
end;
$$;

create function public.reserve_scoring(p_user_id uuid, p_task_type text, p_question text, p_essay text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_usage jsonb;
  v_staff boolean;
  v_row public.submissions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select cohort = 'staff' into v_staff from public.profiles where id = p_user_id;
  v_usage := public.scoring_usage(p_user_id);
  if not coalesce(v_staff, false) then
    if (v_usage->>'active')::boolean then
      return v_usage || jsonb_build_object('code', 'request_active');
    end if;
    if (v_usage->>'used_successful')::integer >= 1 then
      return v_usage || jsonb_build_object('code', 'quota_exhausted');
    end if;
  end if;
  insert into public.submissions (user_id, task_type, question, essay, created_at, reservation_expires_at)
    values (p_user_id, p_task_type, p_question, p_essay, clock_timestamp(), clock_timestamp() + interval '5 minutes')
    returning * into v_row;
  return public.scoring_usage(p_user_id) || jsonb_build_object('id', v_row.id);
end;
$$;

create function public.complete_scoring(p_user_id uuid, p_id uuid, p_scores jsonb, p_overall_band numeric)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.submissions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if p_scores is null or p_scores = 'null'::jsonb then
    return jsonb_build_object('code', 'invalid_scores');
  end if;
  update public.submissions set scores = p_scores, overall_band = p_overall_band
    where user_id = p_user_id and id = p_id and scores is null
      and reservation_expires_at > clock_timestamp()
    returning * into v_row;
  if not found then
    return jsonb_build_object('code', 'reservation_expired');
  end if;
  return jsonb_build_object('submission', to_jsonb(v_row));
end;
$$;

create function public.release_scoring(p_user_id uuid, p_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from public.submissions where user_id = p_user_id and id = p_id and scores is null;
  return found;
end;
$$;

revoke all on function public.scoring_usage(uuid) from public, anon, authenticated;
revoke all on function public.reserve_scoring(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_scoring(uuid, uuid, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.release_scoring(uuid, uuid) from public, anon, authenticated;
grant execute on function public.scoring_usage(uuid) to service_role;
grant execute on function public.reserve_scoring(uuid, text, text, text) to service_role;
grant execute on function public.complete_scoring(uuid, uuid, jsonb, numeric) to service_role;
grant execute on function public.release_scoring(uuid, uuid) to service_role;
