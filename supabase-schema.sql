-- Pacelog schema. Paste into Supabase SQL Editor and Run.

-- Runs
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null,
  type text not null,
  route_name text not null,
  distance numeric not null,
  duration integer not null,        -- seconds
  pace integer not null,            -- seconds per km
  elevation integer default 0,
  hr integer default 0,
  cadence integer default 0,
  splits jsonb default '[]'::jsonb, -- array of seconds-per-km
  segments jsonb default '[]'::jsonb, -- array of {distance, duration, pace, note}
  feel integer default 3,
  vibe text default 'flat',
  created_at timestamptz default now()
);

-- Goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target numeric not null,
  current numeric default 0,
  unit text default 'km',
  due text,
  done boolean default false,
  created_at timestamptz default now()
);

-- Plan (training calendar)
create table if not exists public.plan (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null,
  type text not null,
  distance numeric not null,
  description text,
  done boolean default false,
  created_at timestamptz default now()
);

-- SIMPLE public-access policies (single-user personal use).
-- For multi-user, add auth.users foreign keys and restrict by auth.uid().
alter table public.runs enable row level security;
alter table public.goals enable row level security;
alter table public.plan enable row level security;

drop policy if exists "public read runs" on public.runs;
drop policy if exists "public write runs" on public.runs;
drop policy if exists "public read goals" on public.goals;
drop policy if exists "public write goals" on public.goals;
drop policy if exists "public read plan" on public.plan;
drop policy if exists "public write plan" on public.plan;

create policy "public read runs"  on public.runs  for select using (true);
create policy "public write runs" on public.runs  for all    using (true) with check (true);
create policy "public read goals" on public.goals for select using (true);
create policy "public write goals" on public.goals for all   using (true) with check (true);
create policy "public read plan"  on public.plan  for select using (true);
create policy "public write plan" on public.plan  for all    using (true) with check (true);

-- Profile (single-row table for the owner's profile)
create table if not exists public.profile (
  id integer primary key default 1,
  name text default 'Your name',
  tagline text default 'RUNNER',
  pr_5k text,
  pr_10k text,
  pr_half text,
  member_since text default 'Jan 2024',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

alter table public.profile enable row level security;
drop policy if exists "public read profile" on public.profile;
drop policy if exists "public write profile" on public.profile;
create policy "public read profile"  on public.profile for select using (true);
create policy "public write profile" on public.profile for all    using (true) with check (true);

insert into public.profile (id) values (1) on conflict do nothing;

-- If you ran the original schema before segments was added, run:
-- alter table public.runs add column if not exists segments jsonb default '[]'::jsonb;

-- Seed a few starter goals
insert into public.goals (title, target, current, unit, due, done) values
  ('Run 150km this month', 150, 0, 'km', 'end of month', false),
  ('Sub-22 5K time trial', 22, 0, 'min', 'in 4 weeks', false),
  ('10 runs this month', 10, 0, 'runs', 'end of month', false)
on conflict do nothing;
