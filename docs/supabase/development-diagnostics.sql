-- DIAGNOSTIC ONLY. Confirm quickexit-dev in the Dashboard and match its
-- Project URL to your local configuration before running. No application RPCs.
-- Results contain definitions and counts, never user IDs or stored payloads.
begin read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

select current_database() as database_name, current_user as inspecting_role,
       current_setting('transaction_read_only') as read_only,
       current_setting('row_security') as row_security,
       r.rolsuper, r.rolbypassrls
from pg_roles r where r.rolname = current_user;
-- database_name alone does NOT establish Supabase project identity.

-- Includes conflicting views, indexes, sequences, and objects in other schemas.
select n.nspname as schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       c.relacl as explicit_acl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relname in ('paper_workspaces', 'paper_operations')
order by n.nspname, c.relname;

select c.relname as table_name, a.attnum as ordinal, a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null, pg_get_expr(d.adbin, d.adrelid) as default_expression,
       a.attidentity as identity_kind, a.attgenerated as generated_kind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where n.nspname = 'public' and c.relname in ('paper_workspaces','paper_operations')
  and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;

select c.relname as table_name, k.conname, k.contype, k.convalidated,
       pg_get_constraintdef(k.oid, true) as definition
from pg_constraint k join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('paper_workspaces','paper_operations')
order by c.relname, k.conname;

select c.relname as table_name, i.indisvalid, i.indisunique,
       pg_get_indexdef(i.indexrelid) as definition
from pg_index i join pg_class c on c.oid = i.indrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('paper_workspaces','paper_operations');

select c.relname as table_name, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('paper_workspaces','paper_operations')
  and not t.tgisinternal;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('paper_workspaces','paper_operations')
order by tablename, policyname;

select table_name, grantee, privilege_type, is_grantable
from information_schema.table_privileges where table_schema = 'public'
  and table_name in ('paper_workspaces','paper_operations')
order by table_name, grantee, privilege_type;
select table_name, column_name, grantee, privilege_type, is_grantable
from information_schema.column_privileges where table_schema = 'public'
  and table_name in ('paper_workspaces','paper_operations')
order by table_name, column_name, grantee, privilege_type;

-- Effective privileges include PUBLIC and inherited role privileges.
select r.rolname, c.relname, v.privilege,
       has_table_privilege(r.oid, c.oid, v.privilege) as allowed
from pg_roles r cross join pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
                   ('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
where r.rolname in ('anon','authenticated') and n.nspname = 'public'
  and c.relname in ('paper_workspaces','paper_operations') and c.relkind in ('r','p')
order by c.relname, r.rolname, v.privilege;
select r.rolname, c.relname, a.attname, v.privilege,
       has_column_privilege(r.oid, c.oid, a.attnum, v.privilege) as allowed
from pg_roles r cross join pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
cross join (values ('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)
where r.rolname in ('anon','authenticated') and n.nspname = 'public'
  and c.relname in ('paper_workspaces','paper_operations') and c.relkind in ('r','p')
  and a.attnum > 0 and not a.attisdropped
order by c.relname, r.rolname, a.attname, v.privilege;

-- Inspect every overload. Review definitions locally before sharing results;
-- redact any unexpected embedded secrets in pre-existing function definitions.
select p.oid::regprocedure::text as signature, pg_get_userbyid(p.proowner) as owner,
       r.rolsuper as owner_superuser, r.rolbypassrls as owner_bypasses_rls,
       p.prosecdef as security_definer, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname = 'commit_paper_workspace';
select r.rolname, p.oid::regprocedure::text as signature,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') as execute_allowed
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid = p.pronamespace
where r.rolname in ('anon','authenticated') and n.nspname = 'public'
  and p.proname = 'commit_paper_workspace';

select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
select column_name, data_type from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
order by ordinal_position;

-- Dynamic reads tolerate missing objects. Check the SQL Editor Messages tab.
do $$
declare item record; total bigint;
begin
  if exists (select 1 from pg_attribute
             where attrelid = to_regclass('supabase_migrations.schema_migrations')
               and attname = 'version' and not attisdropped) then
    for item in execute 'select version::text as version from supabase_migrations.schema_migrations order by version' loop
      raise notice 'Recorded migration version: %', item.version;
    end loop;
  else
    raise notice 'Migration history unavailable or has no version column';
  end if;
  for item in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname in ('paper_workspaces','paper_operations')
                and c.relkind in ('r','p') loop
    execute format('select count(*) from public.%I', item.relname) into total;
    raise notice 'Visible row count for public.%: % (may be RLS-filtered unless inspecting role bypasses RLS)', item.relname, total;
  end loop;
end $$;
commit;
