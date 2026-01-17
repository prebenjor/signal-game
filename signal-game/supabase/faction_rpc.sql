-- RLS + RPC write path for faction multiplayer.
-- Run once in Supabase SQL editor for the project.

alter table if exists public.faction_members
  add column if not exists callsign text;

create unique index if not exists faction_members_user_id_uidx
  on public.faction_members (user_id);

alter table public.factions enable row level security;
alter table public.faction_projects enable row level security;
alter table public.faction_building_progress enable row level security;
alter table public.faction_activity_log enable row level security;
alter table public.faction_donations_log enable row level security;
alter table public.faction_chat_log enable row level security;
alter table public.faction_members enable row level security;

drop policy if exists factions_read on public.factions;
create policy factions_read on public.factions
  for select using (true);

drop policy if exists faction_projects_read on public.faction_projects;
create policy faction_projects_read on public.faction_projects
  for select using (true);

drop policy if exists faction_building_progress_read on public.faction_building_progress;
create policy faction_building_progress_read on public.faction_building_progress
  for select using (true);

drop policy if exists faction_activity_log_read on public.faction_activity_log;
create policy faction_activity_log_read on public.faction_activity_log
  for select using (true);

drop policy if exists faction_donations_log_read on public.faction_donations_log;
create policy faction_donations_log_read on public.faction_donations_log
  for select using (true);

drop policy if exists faction_chat_log_read on public.faction_chat_log;
create policy faction_chat_log_read on public.faction_chat_log
  for select using (true);

drop policy if exists faction_members_read_self on public.faction_members;
create policy faction_members_read_self on public.faction_members
  for select using (auth.uid() = user_id);

create or replace function public.join_faction(p_faction_id text, p_callsign text)
returns public.faction_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.faction_members;
begin
  if p_callsign is null or length(trim(p_callsign)) < 2 then
    raise exception 'callsign required';
  end if;
  insert into public.faction_members (user_id, faction_id, callsign, joined_at)
  values (auth.uid(), p_faction_id, left(trim(p_callsign), 32), now())
  on conflict (user_id)
  do update set faction_id = excluded.faction_id, callsign = excluded.callsign
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.set_faction_callsign(p_callsign text)
returns public.faction_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.faction_members;
begin
  if p_callsign is null or length(trim(p_callsign)) < 2 then
    raise exception 'callsign required';
  end if;
  update public.faction_members
    set callsign = left(trim(p_callsign), 32)
    where user_id = auth.uid()
    returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.post_faction_chat(p_faction_id text, p_callsign text, p_message text)
returns public.faction_chat_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.faction_chat_log;
begin
  if p_message is null or length(trim(p_message)) < 1 then
    raise exception 'message required';
  end if;
  insert into public.faction_chat_log (faction_id, user_id, callsign, message)
  values (p_faction_id, auth.uid(), left(trim(p_callsign), 32), left(trim(p_message), 240))
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.join_faction(text, text) to anon, authenticated;
grant execute on function public.set_faction_callsign(text) to anon, authenticated;
grant execute on function public.post_faction_chat(text, text, text) to anon, authenticated;
