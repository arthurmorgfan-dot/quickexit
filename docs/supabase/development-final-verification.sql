-- Run only in confirmed quickexit-dev. One result; no Messages tab needed.
-- No RPC calls, user IDs, balances or payloads. Exact body comparison is
-- whitespace-sensitive: false requires review, not automatic replacement.
begin read only;
set local statement_timeout = '15s';
select jsonb_build_object(
 'columns', (select jsonb_agg(to_jsonb(x)) from (
   select table_name,column_name,data_type,is_nullable,column_default
   from information_schema.columns where table_schema='public'
   and table_name in ('paper_workspaces','paper_operations') order by table_name,ordinal_position
 ) x),
 'constraints', (select jsonb_agg(to_jsonb(x)) from (
   select c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid,true) as definition
   from pg_constraint k join pg_class c on c.oid=k.conrelid
   where c.oid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations'))
   order by c.relname,k.conname
 ) x),
 'indexes', (select jsonb_agg(to_jsonb(x)) from (
   select c.relname,i.indisvalid,pg_get_indexdef(i.indexrelid) as definition
   from pg_index i join pg_class c on c.oid=i.indrelid
   where c.oid in (to_regclass('public.paper_workspaces'),to_regclass('public.paper_operations'))
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
   r.rolname as owner,r.rolsuper,r.rolbypassrls,p.prosecdef,p.proconfig,p.proacl,
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
 ) x),
 'migration_history', (select jsonb_agg(to_jsonb(x)) from (
   select version,name from supabase_migrations.schema_migrations order by version
 ) x),
 'data_counts', jsonb_build_object(
   'paper_workspaces',(select count(*) from public.paper_workspaces),
   'paper_operations',(select count(*) from public.paper_operations)),
 'count_visibility', (select jsonb_build_object('role',rolname,'superuser',rolsuper,'bypasses_rls',rolbypassrls)
   from pg_roles where rolname=current_user)
) as remaining_verification;
commit;
