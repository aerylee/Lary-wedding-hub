-- Realtime publication, assistant rate limiting, scheduled jobs.

-- ─── realtime ────────────────────────────────────────────────────────────────
-- Realtime evaluates each subscriber's SELECT policy before delivering a change, so a
-- collaborator subscribed to budget_lines receives nothing. Verified by the RLS tests
-- and the manual check in docs/TESTING.md.
do $$
declare t record;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  for t in select tbl from app.table_perms union all select 'activity_log' union all select 'memberships' loop
    execute format('alter publication supabase_realtime add table public.%I', t.tbl);
  end loop;
end $$;

-- ─── assistant rate limit ────────────────────────────────────────────────────
-- A chat endpoint backed by a paid model is where a bored family member costs real money.
create table app.assistant_usage (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  kind        text not null default 'assistant',
  at          timestamptz not null default now()
);
create index assistant_usage_user_idx on app.assistant_usage (user_id, at desc);

-- Records one call and returns true if the caller is within limits. Called by Edge
-- Functions with the caller's JWT, so auth.uid() is the real user.
create or replace function public.assistant_take_token(w uuid, p_kind text default 'assistant')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare per_hour int; per_day int;
begin
  if auth.uid() is null or not app.has(w, 'assistant:use') then return false; end if;
  select count(*) filter (where at > now() - interval '1 hour'),
         count(*) filter (where at > now() - interval '1 day')
    into per_hour, per_day
    from app.assistant_usage where user_id = auth.uid() and kind = p_kind;
  if per_hour >= 30 or per_day >= 150 then return false; end if;
  insert into app.assistant_usage (user_id, wedding_id, kind) values (auth.uid(), w, p_kind);
  return true;
end $$;
revoke all on function public.assistant_take_token(uuid, text) from public, anon;
grant execute on function public.assistant_take_token(uuid, text) to authenticated;

-- ─── scheduled jobs ──────────────────────────────────────────────────────────
-- Daily FX refresh (which also keeps a free-tier project from pausing) and an hourly
-- storage purge. Both call Edge Functions through pg_net with a service key kept in Vault:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>',        'service_role_key');
-- Skipped cleanly where the extensions are unavailable (plain Postgres in CI).
do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net not available — skipping scheduled jobs';
    return;
  end if;

  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;

  perform cron.schedule('fx-refresh-daily', '17 6 * * *', $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fx-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body    := '{}'::jsonb
    );
  $job$);

  perform cron.schedule('purge-attachments-hourly', '41 * * * *', $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-attachments',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body    := '{}'::jsonb
    );
  $job$);
end $outer$;
