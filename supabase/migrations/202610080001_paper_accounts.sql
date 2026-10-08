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
