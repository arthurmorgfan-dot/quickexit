-- READ ONLY. First confirm quickexit-dev in the dashboard and match its
-- Project URL to NEXT_PUBLIC_SUPABASE_URL locally. Never print/share the key.
-- Inspect every result. Stop on unexpected objects/data or prior migration.
begin read only;
select current_database() as database_name, current_user as inspecting_role;
-- Database name alone cannot prove dashboard project identity.
select n.nspname as schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) as owner, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
order by c.relname;
select p.oid::regprocedure::text as function_signature,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='commit_paper_workspace';
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public' order by tablename,policyname;
select table_schema, table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema='public' order by table_name,grantee,privilege_type;
select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema='public' and routine_name='commit_paper_workspace';
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
do $$
declare item record; total bigint;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    for item in execute 'select version from supabase_migrations.schema_migrations order by version' loop
      raise notice 'Existing migration version: %', item.version;
    end loop;
  end if;
  -- Only row counts, never balances, emails, receipt payloads or other user data.
  for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname='public' and c.relkind in ('r','p') loop
    execute format('select count(*) from public.%I', item.relname) into total;
    raise notice 'Existing public table %: % rows', item.relname, total;
  end loop;
end $$;
commit;
