-- Lumber & Canopy: accounts and saved progress.
-- Run this in the Supabase SQL editor once the project exists, then enable Email auth
-- (Authentication > Providers > Email). Email confirmation is recommended.
--
-- Emails and passwords live only in Supabase Auth (auth.users). These tables never copy the email.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  -- inventory, tool levels, cabin build stage, placed plants, propagation timers, tutorial state
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: players can only read and write their own rows.
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create the profile when someone signs up, using the name they typed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'name'), 24), ''), 'Friend')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- "Delete my account": removes the signed-in user; profile and progress cascade.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
