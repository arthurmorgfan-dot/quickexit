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
