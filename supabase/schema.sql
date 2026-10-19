-- Skyrim Interactive Map: shared overrides table.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> Run).
--
-- One row per edited item or hold. `data` is the full object as the site stores it;
-- `data` = null means "deleted". Rows for ids that exist in the repo's data/*.json
-- override the base entry; other ids are new entries.

create table if not exists public.map_overrides (
  id          text primary key,
  kind        text not null check (kind in ('item', 'hold')),
  data        jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists map_overrides_updated_at on public.map_overrides (updated_at desc);

-- keep updated_at fresh on every change
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists map_overrides_touch on public.map_overrides;
create trigger map_overrides_touch before update on public.map_overrides
  for each row execute function public.touch_updated_at();

-- Open wiki-style access: anyone with the public anon key can read and write rows.
alter table public.map_overrides enable row level security;
drop policy if exists "anon read"   on public.map_overrides;
drop policy if exists "anon insert" on public.map_overrides;
drop policy if exists "anon update" on public.map_overrides;
drop policy if exists "anon delete" on public.map_overrides;
create policy "anon read"   on public.map_overrides for select to anon using (true);
create policy "anon insert" on public.map_overrides for insert to anon with check (true);
create policy "anon update" on public.map_overrides for update to anon using (true) with check (true);
create policy "anon delete" on public.map_overrides for delete to anon using (true);

grant select, insert, update, delete on public.map_overrides to anon;
