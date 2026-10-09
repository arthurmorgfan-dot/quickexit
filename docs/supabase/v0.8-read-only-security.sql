-- Metadata only. Run only after confirming the intended development project.
-- No RPC calls, user creation, data payloads, balances, or application mutations.
-- Pair with development-final-verification.sql for full schema/body/history review.
begin read only;
set local statement_timeout = '15s';
select jsonb_build_object(
  'rls', (select jsonb_agg(to_jsonb(x)) from (
    select c.relname as table_name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('paper_workspaces','paper_operations')
    order by c.relname
  ) x),
  'policies', (select jsonb_agg(to_jsonb(x)) from (
    select tablename,policyname,permissive,roles,cmd,qual,with_check
    from pg_policies where schemaname='public'
    and tablename in ('paper_workspaces','paper_operations') order by tablename,policyname
  ) x),
  'effective_table_privileges', (select jsonb_agg(to_jsonb(x)) from (
    select r.rolname,c.relname as table_name,
      has_table_privilege(r.oid,c.oid,'SELECT') as can_select,
      has_table_privilege(r.oid,c.oid,'INSERT') as can_insert,
      has_table_privilege(r.oid,c.oid,'UPDATE') as can_update,
      has_table_privilege(r.oid,c.oid,'DELETE') as can_delete,
      has_table_privilege(r.oid,c.oid,'TRUNCATE') as can_truncate,
      has_table_privilege(r.oid,c.oid,'REFERENCES') as can_reference,
      has_table_privilege(r.oid,c.oid,'TRIGGER') as can_trigger
    from pg_roles r cross join pg_class c
    where r.rolname in ('anon','authenticated')
    and c.oid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations'))
    order by r.rolname,c.relname
  ) x),
  'functions', (select jsonb_agg(to_jsonb(x)) from (
    select p.oid::regprocedure::text as signature,r.rolname as owner,
      r.rolsuper,r.rolbypassrls,p.prosecdef as security_definer,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
      pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_roles r on r.oid=p.proowner
    where n.nspname='public' and p.proname='commit_paper_workspace' order by p.oid
  ) x)
) as security_verification;
commit;
