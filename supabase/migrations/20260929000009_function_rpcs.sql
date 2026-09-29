-- RPCs used only by Edge Functions running with the service-role key.

-- Hand the purge-attachments function a batch of storage paths whose attachment row is
-- gone, removing them from the queue. Paths whose row came back are simply dropped.
create or replace function public.claim_storage_purge(p_limit integer default 200)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with batch as (
    select q.storage_path from app.storage_purge_queue q
    order by q.queued_at
    limit greatest(1, least(p_limit, 1000))
    for update skip locked
  ), gone as (
    delete from app.storage_purge_queue q using batch b
    where q.storage_path = b.storage_path
    returning q.storage_path
  )
  select g.storage_path from gone g
  where not exists (select 1 from public.attachments a where a.storage_path = g.storage_path);
end $$;

revoke all on function public.claim_storage_purge(integer) from public, anon, authenticated;
grant execute on function public.claim_storage_purge(integer) to service_role;
