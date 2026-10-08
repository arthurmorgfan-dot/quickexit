-- DEVELOPMENT ONLY: manually confirm quickexit-dev and Project URL first.
-- Run the separate read-only preflight and stop on unexpected existing objects/data.
-- Original migration below is included byte-for-byte. No remote execution occurred.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('paper_workspaces','paper_operations'))
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='commit_paper_workspace') then
    raise exception 'Existing QuickExit objects: stop and compare; do not overwrite';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080001') then
      raise exception 'Migration version already recorded: stop and inspect';
    end if;
  end if;
end $$;
-- BEGIN UNCHANGED REVIEWED MIGRATION
-- An aggregate is committed once: positions, receipts, activity and cash cannot partially save.
create table public.paper_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb,
  revision bigint not null default 0 check (revision >= 0),
  import_decided boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint paper_payload_shape check (payload is null or coalesce((
    jsonb_typeof(payload) = 'object' and payload->>'version' = '3'
    and jsonb_typeof(payload->'state') = 'object'
    and payload->>'selectedAsset' in ('BTC','ETH','SOL')
    and octet_length(payload::text) <= 2000000
  ), false))
);
create table public.paper_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  revision bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.paper_workspaces enable row level security;
alter table public.paper_workspaces force row level security;
alter table public.paper_operations enable row level security;
alter table public.paper_operations force row level security;
create policy "Read own paper workspace" on public.paper_workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own paper workspace" on public.paper_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own paper workspace" on public.paper_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Read own operation receipts" on public.paper_operations for select to authenticated using ((select auth.uid()) = user_id);
-- Clients may read their own aggregate, but writes must use the atomic CAS function.
revoke all on public.paper_workspaces, public.paper_operations from anon, authenticated;
grant select on public.paper_workspaces, public.paper_operations to authenticated;

create function public.commit_paper_workspace(p_expected_revision bigint, p_operation_id uuid, p_payload jsonb, p_kind text default 'save')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.paper_workspaces%rowtype;
  v_receipt bigint;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_operation_id is null
     or p_kind not in ('save','import','skip_import') or p_kind is null
     or p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload->>'version' is distinct from '3'
     or pg_catalog.jsonb_typeof(p_payload->'state') is distinct from 'object'
     or p_payload->>'selectedAsset' not in ('BTC','ETH','SOL')
     or p_payload->>'selectedAsset' is null
     or pg_catalog.octet_length(p_payload::text) > 2000000 then
    raise exception 'Invalid paper snapshot' using errcode = '22023';
  end if;
  insert into public.paper_workspaces(user_id) values(v_uid) on conflict (user_id) do nothing;
  select * into v_row from public.paper_workspaces where user_id = v_uid for update;
  select revision into v_receipt from public.paper_operations where user_id = v_uid and operation_id = p_operation_id;
  if found then return pg_catalog.jsonb_build_object('status','duplicate','record',pg_catalog.to_jsonb(v_row),'committedRevision',v_receipt); end if;
  if v_row.revision <> p_expected_revision then return pg_catalog.jsonb_build_object('status','conflict','record',pg_catalog.to_jsonb(v_row)); end if;
  if p_kind in ('import','skip_import') and (v_row.import_decided or v_row.payload is not null) then
    return pg_catalog.jsonb_build_object('status','import_unavailable','record',pg_catalog.to_jsonb(v_row));
  end if;
  update public.paper_workspaces set payload=p_payload, revision=revision+1, import_decided=true, updated_at=now() where user_id=v_uid returning * into v_row;
  insert into public.paper_operations(user_id,operation_id,revision) values(v_uid,p_operation_id,v_row.revision);
  return pg_catalog.jsonb_build_object('status','saved','record',pg_catalog.to_jsonb(v_row),'committedRevision',v_row.revision);
end;
$$;
revoke all on function public.commit_paper_workspace(bigint, uuid, jsonb, text) from public, anon;
grant execute on function public.commit_paper_workspace(bigint, uuid, jsonb, text) to authenticated;

-- END UNCHANGED REVIEWED MIGRATION
-- Run inside the migration transaction; raises on security failure.
-- Also usable as read-only postflight: contains queries/assertions only.
do $$
declare t text; action text; f record; count_policies integer;
begin
  foreach t in array array['paper_workspaces','paper_operations'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relkind='r'
        and c.relrowsecurity and c.relforcerowsecurity
    ) then raise exception 'RLS missing or not forced on %', t; end if;
    if has_table_privilege('anon', 'public.'||t, 'SELECT') then
      raise exception 'Anonymous read access on %', t;
    end if;
    if not has_table_privilege('authenticated','public.'||t,'SELECT') then
      raise exception 'Authenticated own-record read grant missing on %', t;
    end if;
    foreach action in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('authenticated','public.'||t,action)
        or has_table_privilege('anon','public.'||t,action) then
        raise exception 'Forbidden direct % grant on %', action,t;
      end if;
    end loop;
  end loop;
  select * into f from pg_proc
    where oid=to_regprocedure('public.commit_paper_workspace(bigint,uuid,jsonb,text)');
  if not found then raise exception 'Commit function missing'; end if;
  if not f.prosecdef or not ('search_path=""'=any(coalesce(f.proconfig,array[]::text[]))) then
    raise exception 'Unsafe commit function security/search path';
  end if;
  if not exists(select 1 from pg_roles where oid=f.proowner and (rolsuper or rolbypassrls)) then
    raise exception 'Function owner cannot operate with forced RLS';
  end if;
  if has_function_privilege('anon', f.oid, 'EXECUTE')
    or not has_function_privilege('authenticated', f.oid, 'EXECUTE') then
    raise exception 'Unsafe commit function execution grants';
  end if;
  select count(*) into count_policies from pg_policies
    where schemaname='public' and tablename in ('paper_workspaces','paper_operations');
  if count_policies<>4 then raise exception 'Unexpected policy count'; end if;
  if exists (
    select 1 from pg_policies where schemaname='public'
      and tablename in ('paper_workspaces','paper_operations')
      and (roles<>array['authenticated']::name[] or permissive<>'PERMISSIVE'
        or cmd not in ('SELECT','INSERT','UPDATE')
        or (cmd in ('SELECT','UPDATE') and (qual is null or qual not like '%auth.uid()%user_id%'))
        or (cmd in ('INSERT','UPDATE') and (with_check is null or with_check not like '%auth.uid()%user_id%')))
  ) then raise exception 'Unexpected ownership policy'; end if;
end $$;
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('paper_workspaces','paper_operations');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('paper_workspaces','paper_operations');

commit;
