alter table public.records
  add column archived_at timestamptz;

create index records_owner_archived_idx
  on public.records (owner_id, archived_at)
  where archived_at is not null;

create or replace function public.merge_record(p_record jsonb, p_versions jsonb)
returns public.records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.records;
  result_row public.records;
  current_user_id uuid := (select auth.uid());
  record_id text := pg_catalog.upper(pg_catalog.btrim(p_record->>'id'));
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(current_user_id::text || ':' || record_id)::bigint
  );

  select * into current_row from public.records
  where owner_id = current_user_id and id = record_id
  for update;

  if not found then
    insert into public.records (
      owner_id,id,kind,title,description,status,date,end_date,subject,predicate,value,tags,related_ids,archived_at,sync_meta
    ) values (
      current_user_id, record_id, p_record->>'kind', p_record->>'title', coalesce(p_record->>'description',''),
      coalesce(p_record->>'status','active'), nullif(p_record->>'date',''), nullif(p_record->>'end_date',''),
      coalesce(p_record->>'subject',''), coalesce(p_record->>'predicate',''), coalesce(p_record->>'value',''),
      array(select jsonb_array_elements_text(coalesce(p_record->'tags','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(p_record->'related_ids','[]'::jsonb))),
      nullif(p_record->>'archived_at','')::timestamptz, p_versions
    ) returning * into result_row;
  else
    update public.records set
      kind = case when coalesce(p_versions->>'kind','') > coalesce(sync_meta->>'kind','') then p_record->>'kind' else kind end,
      title = case when coalesce(p_versions->>'title','') > coalesce(sync_meta->>'title','') then p_record->>'title' else title end,
      description = case when coalesce(p_versions->>'description','') > coalesce(sync_meta->>'description','') then coalesce(p_record->>'description','') else description end,
      status = case when coalesce(p_versions->>'status','') > coalesce(sync_meta->>'status','') then p_record->>'status' else status end,
      date = case when coalesce(p_versions->>'date','') > coalesce(sync_meta->>'date','') then nullif(p_record->>'date','') else date end,
      end_date = case when coalesce(p_versions->>'end_date','') > coalesce(sync_meta->>'end_date','') then nullif(p_record->>'end_date','') else end_date end,
      subject = case when coalesce(p_versions->>'subject','') > coalesce(sync_meta->>'subject','') then coalesce(p_record->>'subject','') else subject end,
      predicate = case when coalesce(p_versions->>'predicate','') > coalesce(sync_meta->>'predicate','') then coalesce(p_record->>'predicate','') else predicate end,
      value = case when coalesce(p_versions->>'value','') > coalesce(sync_meta->>'value','') then coalesce(p_record->>'value','') else value end,
      tags = case when coalesce(p_versions->>'tags','') > coalesce(sync_meta->>'tags','') then array(select jsonb_array_elements_text(coalesce(p_record->'tags','[]'::jsonb))) else tags end,
      related_ids = case when coalesce(p_versions->>'related_ids','') > coalesce(sync_meta->>'related_ids','') then array(select jsonb_array_elements_text(coalesce(p_record->'related_ids','[]'::jsonb))) else related_ids end,
      archived_at = case when coalesce(p_versions->>'archived_at','') > coalesce(sync_meta->>'archived_at','') then nullif(p_record->>'archived_at','')::timestamptz else archived_at end,
      sync_meta = sync_meta || p_versions
    where owner_id = current_user_id and id = record_id
    returning * into result_row;
  end if;
  return result_row;
end;
$$;

revoke all on function public.merge_record(jsonb,jsonb) from public, anon;
grant execute on function public.merge_record(jsonb,jsonb) to authenticated;

create function public.delete_record(p_record_id text, p_version text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_id text := pg_catalog.upper(pg_catalog.btrim(p_record_id));
  deleted_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(current_user_id::text || ':' || normalized_id)::bigint
  );

  update public.records
  set related_ids = pg_catalog.array_remove(related_ids, normalized_id),
      sync_meta = pg_catalog.jsonb_set(sync_meta, '{related_ids}', pg_catalog.to_jsonb(p_version), true)
  where owner_id = current_user_id
    and normalized_id = any(related_ids);

  delete from public.records
  where owner_id = current_user_id and id = normalized_id;
  get diagnostics deleted_count = row_count;

  return deleted_count = 1;
end;
$$;

revoke all on function public.delete_record(text,text) from public, anon;
grant execute on function public.delete_record(text,text) to authenticated;
