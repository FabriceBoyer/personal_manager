create policy records_delete_own on public.records
  for delete to authenticated
  using (owner_id = (select auth.uid()));

grant delete on public.records to authenticated;
