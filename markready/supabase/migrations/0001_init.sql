-- MarkReady schema. Records the SQL deployed to the production Supabase
-- project via the SQL editor (feature-research/auth-db, 2026). This file is
-- the in-repo source of truth for tables and RLS policies.
-- RLS note: clients hold only SELECT policies scoped to auth.uid(); all
-- writes go through the service-role client in /api/score, which bypasses RLS.

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  banned_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_type text not null,
  question text,
  essay text,
  scores jsonb,
  overall_band numeric(2,1),
  created_at timestamptz default now() not null
);

alter table public.submissions enable row level security;
create policy "Users read own submissions"
  on public.submissions for select
  using (auth.uid() = user_id);

create index submissions_user_date_idx
  on public.submissions (user_id, created_at);
