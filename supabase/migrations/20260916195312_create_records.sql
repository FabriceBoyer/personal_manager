create table public.records (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('action', 'event', 'journal', 'fact')),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  status text not null default 'active',
  date text,
  end_date text,
  subject text not null default '',
  predicate text not null default '',
  value text not null default '',
  tags text[] not null default '{}',
  related_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint records_id_format check (id ~ '^[A-Z][A-Z0-9]{1,7}(-[A-Z0-9]{2,12}){1,3}$')
);

create index records_owner_date_idx on public.records (owner_id, date);

create function public.prepare_record() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prefix text;
  base text;
  next_number integer;
  related_id text;
begin
  if new.owner_id is distinct from (select auth.uid()) then
    raise exception 'owner_id must match the authenticated user' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
      raise exception 'record identity cannot be changed' using errcode = '23514';
    end if;
    new.updated_at := now();
  else
    if nullif(btrim(new.id), '') is null then
      prefix := case new.kind
        when 'action' then 'ACT'
        when 'event' then 'RDV'
        when 'journal' then 'JRN'
        else 'FCT'
      end;
      base := prefix || '-' || extract(year from now() at time zone 'UTC')::integer;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.owner_id::text || ':' || base)::bigint);
      select coalesce(max(pg_catalog.substring(id, '[0-9]+$')::integer), 0) + 1
        into next_number
        from public.records
        where owner_id = new.owner_id
          and id ~ ('^' || base || '-[0-9]{3,}$');
      new.id := base || '-' || pg_catalog.lpad(next_number::text, 3, '0');
    else
      new.id := pg_catalog.upper(pg_catalog.btrim(new.id));
    end if;
  end if;

  new.title := pg_catalog.btrim(new.title);
  foreach related_id in array new.related_ids loop
    if related_id = new.id or not exists (
      select 1 from public.records
      where owner_id = new.owner_id and id = related_id
    ) then
      raise exception 'related record % does not exist', related_id using errcode = '23503';
    end if;
  end loop;
  return new;
end;
$$;

create trigger prepare_record_before_write
before insert or update on public.records
for each row execute function public.prepare_record();

alter table public.records enable row level security;

create policy records_select_own on public.records
  for select to authenticated using (owner_id = (select auth.uid()));
create policy records_insert_own on public.records
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy records_update_own on public.records
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.records from anon;
grant select, insert, update on public.records to authenticated;
revoke all on function public.prepare_record() from public, anon, authenticated;
