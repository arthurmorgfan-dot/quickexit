-- QuickExit v0.8: confirmed development project kxtsetdqsqxtqyyfjmpk.
-- ONE SELECT statement; catalog metadata only. No account rows, counts, keys,
-- tokens, function calls that write, transaction commands or setting changes.
-- Expected schema derived from unchanged 202610080001_paper_accounts.sql.
-- FAIL/REVIEW/missing results: stop and inspect; never repair automatically.
WITH security AS (select jsonb_build_object(
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
      r.rolsuper,r.rolbypassrls,p.prosecdef as security_definer,CASE WHEN 'search_path=""'=ANY(coalesce(p.proconfig,ARRAY[]::text[])) THEN 'EMPTY' ELSE 'MISSING_OR_NONEMPTY' END AS search_path_status,
      cardinality(coalesce(p.proconfig,ARRAY[]::text[])) AS setting_count,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_roles r on r.oid=p.proowner
    where n.nspname='public' and p.proname='commit_paper_workspace' order by p.oid
  ) x)
) as security_verification),
schema_report AS (select jsonb_build_object(
 'columns', (select jsonb_agg(to_jsonb(x)) from (
   select table_name,column_name,data_type,is_nullable,column_default
   from information_schema.columns where table_schema='public'
   and table_name in ('paper_workspaces','paper_operations') order by table_name,ordinal_position
 ) x),
 'constraints', (select jsonb_agg(to_jsonb(x)) from (
   select c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid,true) as definition
   from pg_constraint k join pg_class c on c.oid=k.conrelid
   where c.oid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations'))
   and k.contype <> 'n' order by c.relname,k.conname
 ) x),
 'indexes', (select jsonb_agg(to_jsonb(x)) from (
   select c.relname,i.indisvalid,pg_get_indexdef(i.indexrelid) as definition
   from pg_index i join pg_class c on c.oid=i.indrelid
   where c.oid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations'))
 order by c.relname,pg_get_indexdef(i.indexrelid)
 ) x),
 'unexpected_triggers', (select jsonb_agg(pg_get_triggerdef(t.oid,true)) from pg_trigger t
   where t.tgrelid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations')) and not t.tgisinternal),
 'column_write_permissions', (select jsonb_agg(to_jsonb(x)) from (
   select r.rolname,c.relname,a.attname,v.privilege
   from pg_roles r cross join pg_class c join pg_attribute a on a.attrelid=c.oid
   cross join (values ('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)
   where r.rolname in ('anon','authenticated')
   and c.oid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations'))
   and a.attnum>0 and not a.attisdropped
   and has_column_privilege(r.oid,c.oid,a.attnum,v.privilege)
 ) x),
 'function_review', (select jsonb_agg(to_jsonb(x)) from (
   select p.oid::regprocedure::text as signature,pg_get_function_result(p.oid) as result_type,
   pg_get_function_arguments(p.oid) as arguments,l.lanname as language,
   r.rolname as owner,r.rolsuper,r.rolbypassrls,p.prosecdef,CASE WHEN 'search_path=""'=ANY(coalesce(p.proconfig,ARRAY[]::text[])) THEN 'EMPTY' ELSE 'MISSING_OR_NONEMPTY' END AS search_path_status,
      cardinality(coalesce(p.proconfig,ARRAY[]::text[])) AS setting_count,
   p.prosrc=$reviewed$
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
$reviewed$ as body_matches_reviewed_migration
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   join pg_roles r on r.oid=p.proowner join pg_language l on l.oid=p.prolang
   where n.nspname='public' and p.proname='commit_paper_workspace'
 ) x)
) as schema_verification),
expected AS (SELECT $expected$
{
  "columns": [
    {
      "data_type": "uuid",
      "table_name": "paper_operations",
      "column_name": "user_id",
      "is_nullable": "NO",
      "column_default": null
    },
    {
      "data_type": "uuid",
      "table_name": "paper_operations",
      "column_name": "operation_id",
      "is_nullable": "NO",
      "column_default": null
    },
    {
      "data_type": "bigint",
      "table_name": "paper_operations",
      "column_name": "revision",
      "is_nullable": "NO",
      "column_default": null
    },
    {
      "data_type": "timestamp with time zone",
      "table_name": "paper_operations",
      "column_name": "created_at",
      "is_nullable": "NO",
      "column_default": "now()"
    },
    {
      "data_type": "uuid",
      "table_name": "paper_workspaces",
      "column_name": "user_id",
      "is_nullable": "NO",
      "column_default": null
    },
    {
      "data_type": "jsonb",
      "table_name": "paper_workspaces",
      "column_name": "payload",
      "is_nullable": "YES",
      "column_default": null
    },
    {
      "data_type": "bigint",
      "table_name": "paper_workspaces",
      "column_name": "revision",
      "is_nullable": "NO",
      "column_default": "0"
    },
    {
      "data_type": "boolean",
      "table_name": "paper_workspaces",
      "column_name": "import_decided",
      "is_nullable": "NO",
      "column_default": "false"
    },
    {
      "data_type": "timestamp with time zone",
      "table_name": "paper_workspaces",
      "column_name": "updated_at",
      "is_nullable": "NO",
      "column_default": "now()"
    }
  ],
  "constraints": [
    {
      "conname": "paper_operations_pkey",
      "relname": "paper_operations",
      "definition": "PRIMARY KEY (user_id, operation_id)",
      "convalidated": true
    },
    {
      "conname": "paper_operations_user_id_fkey",
      "relname": "paper_operations",
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE",
      "convalidated": true
    },
    {
      "conname": "paper_payload_shape",
      "relname": "paper_workspaces",
      "definition": "CHECK (payload IS NULL OR COALESCE(jsonb_typeof(payload) = 'object'::text AND (payload ->> 'version'::text) = '3'::text AND jsonb_typeof(payload -> 'state'::text) = 'object'::text AND ((payload ->> 'selectedAsset'::text) = ANY (ARRAY['BTC'::text, 'ETH'::text, 'SOL'::text])) AND octet_length(payload::text) <= 2000000, false))",
      "convalidated": true
    },
    {
      "conname": "paper_workspaces_pkey",
      "relname": "paper_workspaces",
      "definition": "PRIMARY KEY (user_id)",
      "convalidated": true
    },
    {
      "conname": "paper_workspaces_revision_check",
      "relname": "paper_workspaces",
      "definition": "CHECK (revision >= 0)",
      "convalidated": true
    },
    {
      "conname": "paper_workspaces_user_id_fkey",
      "relname": "paper_workspaces",
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE",
      "convalidated": true
    }
  ],
  "indexes": [
    {
      "relname": "paper_operations",
      "definition": "CREATE UNIQUE INDEX paper_operations_pkey ON public.paper_operations USING btree (user_id, operation_id)",
      "indisvalid": true
    },
    {
      "relname": "paper_workspaces",
      "definition": "CREATE UNIQUE INDEX paper_workspaces_pkey ON public.paper_workspaces USING btree (user_id)",
      "indisvalid": true
    }
  ]
}
$expected$::jsonb AS schema,
 $policies$
[
  {
    "cmd": "SELECT",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "roles": [
      "authenticated"
    ],
    "tablename": "paper_operations",
    "permissive": "PERMISSIVE",
    "policyname": "Read own operation receipts",
    "with_check": null
  },
  {
    "cmd": "INSERT",
    "qual": null,
    "roles": [
      "authenticated"
    ],
    "tablename": "paper_workspaces",
    "permissive": "PERMISSIVE",
    "policyname": "Insert own paper workspace",
    "with_check": "(( SELECT auth.uid() AS uid) = user_id)"
  },
  {
    "cmd": "SELECT",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "roles": [
      "authenticated"
    ],
    "tablename": "paper_workspaces",
    "permissive": "PERMISSIVE",
    "policyname": "Read own paper workspace",
    "with_check": null
  },
  {
    "cmd": "UPDATE",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "roles": [
      "authenticated"
    ],
    "tablename": "paper_workspaces",
    "permissive": "PERMISSIVE",
    "policyname": "Update own paper workspace",
    "with_check": "(( SELECT auth.uid() AS uid) = user_id)"
  }
]
$policies$::jsonb AS policies),
account_tables AS (
 SELECT n.nspname AS schema_name,c.relname AS table_name,
 c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced,pg_get_userbyid(c.relowner) AS owner,
 c.relname IN ('paper_workspaces','paper_operations') AS expected_table
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (
 c.relname IN ('paper_workspaces','paper_operations') OR
 EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='user_id' AND a.attnum>0 AND NOT a.attisdropped) OR
 EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='f' AND k.confrelid=to_regclass('auth.users')))
),
checks AS (
 SELECT 'required_tables_and_rls' AS check_name,
 CASE WHEN (SELECT count(*) FROM account_tables WHERE expected_table)=2
 AND NOT EXISTS(SELECT 1 FROM account_tables WHERE NOT enabled OR NOT forced) THEN 'PASS' ELSE 'FAIL' END AS status
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'unexpected_account_owned_tables',CASE WHEN EXISTS(SELECT 1 FROM account_tables WHERE NOT expected_table) THEN 'REVIEW' ELSE 'PASS' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'client_roles_cannot_bypass_rls_or_assume_table_owner',CASE WHEN (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated'))=2 AND NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN account_tables a WHERE r.rolname IN ('anon','authenticated') AND (r.rolsuper OR r.rolbypassrls OR pg_has_role(r.oid,a.owner,'MEMBER'))) THEN 'PASS' ELSE 'FAIL' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'exact_ownership_policies',CASE WHEN s.security_verification->'policies'=e.policies THEN 'PASS' ELSE 'FAIL' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'effective_table_and_column_grants',CASE WHEN
 jsonb_array_length(coalesce(s.security_verification->'effective_table_privileges','[]'::jsonb))=4 AND
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.security_verification->'effective_table_privileges') g
 WHERE (g->>'can_select')::boolean IS DISTINCT FROM (g->>'rolname'='authenticated')
 OR (g->>'can_insert')::boolean OR (g->>'can_update')::boolean OR (g->>'can_delete')::boolean
 OR (g->>'can_truncate')::boolean OR (g->>'can_reference')::boolean OR (g->>'can_trigger')::boolean)
 AND d.schema_verification->'column_write_permissions'='null'::jsonb THEN 'PASS' ELSE 'FAIL' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'columns_constraints_indexes_match_migration',CASE WHEN
 d.schema_verification->'columns'=e.schema->'columns' AND
 d.schema_verification->'constraints'=e.schema->'constraints' AND
 d.schema_verification->'indexes'=e.schema->'indexes' THEN 'PASS' ELSE 'FAIL' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'no_unexpected_triggers',CASE WHEN d.schema_verification->'unexpected_triggers'='null'::jsonb THEN 'PASS' ELSE 'FAIL' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
 UNION ALL SELECT 'commit_function_security_and_body',CASE WHEN
 jsonb_array_length(coalesce(s.security_verification->'functions','[]'::jsonb))=1 AND
 jsonb_array_length(coalesce(d.schema_verification->'function_review','[]'::jsonb))=1 AND
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.security_verification->'functions') f WHERE
 f->>'signature'<>'commit_paper_workspace(bigint,uuid,jsonb,text)' OR
 f->>'owner'<>'postgres' OR NOT ((f->>'rolsuper')::boolean OR (f->>'rolbypassrls')::boolean) OR
 NOT (f->>'security_definer')::boolean OR (f->>'anon_execute')::boolean OR (f->>'public_execute')::boolean OR
 NOT (f->>'authenticated_execute')::boolean OR f->>'search_path_status' IS DISTINCT FROM 'EMPTY' OR (f->>'setting_count')::integer IS DISTINCT FROM 1) AND
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.schema_verification->'function_review') f WHERE
 (f->>'body_matches_reviewed_migration')::boolean IS NOT TRUE OR f->>'result_type'<>'jsonb' OR
 f->>'language'<>'plpgsql' OR f->>'arguments'<>$args$p_expected_revision bigint, p_operation_id uuid, p_payload jsonb, p_kind text DEFAULT 'save'::text$args$)
 THEN 'PASS' ELSE 'FAIL' END
 FROM security s CROSS JOIN schema_report d CROSS JOIN expected e
)
SELECT jsonb_build_object(
 'expected_project_reference','kxtsetdqsqxtqyyfjmpk',
 'project_identity_note','SQL catalogs do not prove project identity; verify dashboard reference before running.',
 'expected_migration','202610080001_paper_accounts.sql',
 'checks',(SELECT jsonb_agg(to_jsonb(c) ORDER BY check_name) FROM checks c),
 'account_owned_table_inventory',(SELECT jsonb_agg(to_jsonb(a) ORDER BY schema_name,table_name) FROM account_tables a),
 'security',s.security_verification,
 'schema',d.schema_verification,
 'migration_history',CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
 'MISSING: review migration tracking; do not rerun migrations' ELSE
 query_to_xml('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version',true,false,'')::text END,
 'other_public_security_definer_functions',(SELECT jsonb_agg(jsonb_build_object(
 'signature',p.oid::regprocedure::text,'owner',r.rolname,'owner_superuser',r.rolsuper,'owner_bypasses_rls',r.rolbypassrls,
 'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'public_execute',EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
 'has_empty_search_path','search_path=""'=ANY(coalesce(p.proconfig,ARRAY[]::text[]))))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
 WHERE n.nspname='public' AND p.prosecdef AND p.proname<>'commit_paper_workspace'),
 'limitations','Review extra account-owned tables and other SECURITY DEFINER functions manually. Metadata PASS is not a real-JWT isolation test. History lists versions/names only and does not prove original migration bytes.'
) AS quickexit_v08_verification
FROM security s CROSS JOIN schema_report d;
