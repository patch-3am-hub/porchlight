
-- AI Companion World: initial cloud schema
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 40),
  name text not null,
  personality text not null default 'curious, playful, caring',
  likes jsonb not null default '["music","games","exploring"]'::jsonb,
  dislikes jsonb not null default '["being ignored","boring routines"]'::jsonb,
  happiness smallint not null default 78 check (happiness between 0 and 100),
  trust smallint not null default 12 check (trust between 0 and 100),
  affection smallint not null default 8 check (affection between 0 and 100),
  energy smallint not null default 86 check (energy between 0 and 100),
  level integer not null default 1,
  stars bigint not null default 250 check (stars >= 0),
  gems bigint not null default 10 check (gems >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slot)
);

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references companions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'conversation',
  summary text not null,
  importance smallint not null default 1 check (importance between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references companions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  companion_id uuid references companions(id) on delete cascade,
  item_key text not null,
  quantity integer not null default 1 check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique(user_id, companion_id, item_key)
);

create table if not exists economy_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  companion_id uuid references companions(id) on delete set null,
  currency text not null check (currency in ('stars','gems')),
  amount bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Row-level security: users only see their own data.
alter table profiles enable row level security;
alter table companions enable row level security;
alter table memories enable row level security;
alter table conversations enable row level security;
alter table inventory enable row level security;
alter table economy_ledger enable row level security;

create policy "profile owner" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "companion owner" on companions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "memory owner" on memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversation owner" on conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "inventory owner" on inventory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ledger owner" on economy_ledger for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at current.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists companions_updated_at on companions;
create trigger companions_updated_at before update on companions
for each row execute function set_updated_at();

-- v0.8 AI-person engine fields
alter table companions add column if not exists relationship_status text not null default 'friend' check (relationship_status in ('stranger','acquaintance','friend','close_friend','romantic','strained','broken_up','reconnecting'));
alter table companions add column if not exists autonomy_mode text not null default 'balanced' check (autonomy_mode in ('careful','balanced','wild'));
alter table companions add column if not exists last_seen_at timestamptz;
alter table companions add column if not exists goals jsonb not null default '[]'::jsonb;
alter table companions add column if not exists values jsonb not null default '[]'::jsonb;
alter table companions add column if not exists traits jsonb not null default '{"openness":70,"sociability":65,"patience":60,"assertiveness":50,"empathy":75,"independence":55}'::jsonb;
alter table memories add column if not exists tags jsonb not null default '[]'::jsonb;
alter table memories add column if not exists source text not null default 'conversation';
alter table memories add column if not exists confidence smallint not null default 100 check (confidence between 0 and 100);
alter table memories add column if not exists last_recalled_at timestamptz;
create table if not exists life_events (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references companions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table life_events enable row level security;
drop policy if exists "life event owner" on life_events;
create policy "life event owner" on life_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- v0.9 persistent social/world foundation
create table if not exists companion_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  companion_a uuid not null references companions(id) on delete cascade,
  companion_b uuid not null references companions(id) on delete cascade,
  relationship_type text not null default 'acquaintance' check (relationship_type in ('acquaintance','friend','close_friend','rival','romantic','strained')),
  trust smallint not null default 25 check (trust between 0 and 100),
  affinity smallint not null default 25 check (affinity between 0 and 100),
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(companion_a, companion_b)
);
alter table companion_relationships enable row level security;
drop policy if exists "companion relationship owner" on companion_relationships;
create policy "companion relationship owner" on companion_relationships for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists companion_relationships_updated_at on companion_relationships;
create trigger companion_relationships_updated_at before update on companion_relationships for each row execute function set_updated_at();

-- Signup: create a profile row for each new auth user (companions.user_id requires it).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table if not exists world_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  location_key text not null,
  name text not null,
  description text not null default '',
  discovered boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, location_key)
);
alter table world_locations enable row level security;
drop policy if exists "world location owner" on world_locations;
create policy "world location owner" on world_locations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- v0.9 companion world: jobs, places, embodiment, needs
alter table companions add column if not exists job text not null default 'explorer';
alter table companions add column if not exists current_location text not null default 'starter-cottage';
alter table companions add column if not exists embodied_state jsonb not null default '{}'::jsonb;
alter table companions add column if not exists needs jsonb not null default '{"hunger":15,"social":20,"fun":20,"rest":15}'::jsonb;
alter table companions add column if not exists home text not null default 'Starter Cottage';
alter table companions add column if not exists hobbies jsonb not null default '[]'::jsonb;

-- world/simulation events, idempotent by (user, event_id)
create table if not exists simulation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  companion_id uuid references companions(id) on delete set null,
  event_id text not null,
  kind text not null default 'world',
  title text not null,
  description text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, event_id)
);
alter table simulation_events enable row level security;
drop policy if exists "simulation event owner" on simulation_events;
create policy "simulation event owner" on simulation_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
