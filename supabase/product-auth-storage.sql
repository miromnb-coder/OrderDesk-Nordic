-- OrderDesk product auth + private storage
-- Applied to the connected Supabase project on 2026-09-24.

create or replace function public.is_orderdesk_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_orderdesk_org_member(uuid) from public, anon;
grant execute on function public.is_orderdesk_org_member(uuid) to authenticated;

create or replace function public.create_orderdesk_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  safe_slug text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if workspace_name is null or char_length(trim(workspace_name)) < 2 or char_length(trim(workspace_name)) > 120 then
    raise exception 'Workspace name must be 2-120 characters';
  end if;

  if exists (select 1 from public.organization_members where user_id = uid) then
    select organization_id into org_id
    from public.organization_members where user_id = uid
    order by created_at asc limit 1;
    return org_id;
  end if;

  safe_slug := lower(regexp_replace(trim(workspace_name), '[^a-zA-Z0-9]+', '-', 'g'));
  safe_slug := trim(both '-' from safe_slug);
  if safe_slug = '' then safe_slug := 'workspace'; end if;
  safe_slug := left(safe_slug, 48) || '-' || left(replace(uid::text, '-', ''), 8);

  insert into public.organizations(name, slug)
  values (trim(workspace_name), safe_slug)
  returning id into org_id;

  insert into public.organization_members(organization_id, user_id, role)
  values (org_id, uid, 'owner');

  return org_id;
end;
$$;

revoke all on function public.create_orderdesk_workspace(text) from public, anon;
grant execute on function public.create_orderdesk_workspace(text) to authenticated;

grant select on public.organization_members, public.organizations, public.customers,
  public.products, public.customer_product_mappings, public.erp_connections, public.order_lines
to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert on public.order_events to authenticated;

create policy "members read own memberships" on public.organization_members
for select to authenticated using ((select auth.uid()) = user_id);

create policy "members read organizations" on public.organizations
for select to authenticated using ((select public.is_orderdesk_org_member(id)));

create policy "members read orders" on public.orders
for select to authenticated using ((select public.is_orderdesk_org_member(organization_id)));
create policy "members insert orders" on public.orders
for insert to authenticated with check ((select public.is_orderdesk_org_member(organization_id)));
create policy "members update orders" on public.orders
for update to authenticated
using ((select public.is_orderdesk_org_member(organization_id)))
with check ((select public.is_orderdesk_org_member(organization_id)));
create policy "members delete orders" on public.orders
for delete to authenticated using ((select public.is_orderdesk_org_member(organization_id)));

create policy "members read order lines" on public.order_lines
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (select public.is_orderdesk_org_member(o.organization_id))
  )
);

create policy "members insert events" on public.order_events
for insert to authenticated with check ((select public.is_orderdesk_org_member(organization_id)));
create policy "members read events" on public.order_events
for select to authenticated using ((select public.is_orderdesk_org_member(organization_id)));

create policy "members read customers" on public.customers
for select to authenticated using ((select public.is_orderdesk_org_member(organization_id)));
create policy "members read products" on public.products
for select to authenticated using ((select public.is_orderdesk_org_member(organization_id)));
create policy "members read mappings" on public.customer_product_mappings
for select to authenticated using ((select public.is_orderdesk_org_member(organization_id)));
create policy "members read erp connections" on public.erp_connections
for select to authenticated using ((select public.is_orderdesk_org_member(organization_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-files', 'order-files', false, 15728640, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "members upload order files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'order-files'
  and array_length(storage.foldername(name), 1) >= 2
  and (select public.is_orderdesk_org_member((storage.foldername(name))[1]::uuid))
);

create policy "members read order files" on storage.objects
for select to authenticated using (
  bucket_id = 'order-files'
  and array_length(storage.foldername(name), 1) >= 2
  and (select public.is_orderdesk_org_member((storage.foldername(name))[1]::uuid))
);

create policy "members delete order files" on storage.objects
for delete to authenticated using (
  bucket_id = 'order-files'
  and array_length(storage.foldername(name), 1) >= 2
  and (select public.is_orderdesk_org_member((storage.foldername(name))[1]::uuid))
);
