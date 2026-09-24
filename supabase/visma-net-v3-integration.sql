-- Visma Net service connection + Sales Order v3 dry-run integration.
-- Applied to the connected Supabase project on 2026-09-24.

alter table public.erp_connections
  add column if not exists auth_mode text not null default 'service' check (auth_mode in ('service','interactive')),
  add column if not exists client_id text,
  add column if not exists tenant_id text,
  add column if not exists scopes text[] not null default array[
    'vismanet_erp_service_api:read',
    'vismanet_erp_service_api:create',
    'vismanet_erp_service_api:update'
  ]::text[],
  add column if not exists sales_order_endpoint text not null default 'https://salesorder.visma.net/api/v3/SalesOrders',
  add column if not exists write_enabled boolean not null default false,
  add column if not exists connected_at timestamptz,
  add column if not exists last_connection_test_at timestamptz,
  add column if not exists last_connection_error text;

grant insert, update on public.erp_connections to authenticated;

create policy "members insert erp connections"
on public.erp_connections for insert
to authenticated
with check ((select public.is_orderdesk_org_member(organization_id)));

create policy "members update erp connections"
on public.erp_connections for update
to authenticated
using ((select public.is_orderdesk_org_member(organization_id)))
with check ((select public.is_orderdesk_org_member(organization_id)));

create or replace function public.configure_visma_connection(
  input_client_id text,
  input_tenant_id text default null,
  input_external_company_id text default null,
  input_display_name text default null,
  input_default_warehouse text default null,
  input_default_order_type text default 'SO'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  conn_id uuid;
  generated_secret_ref text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select organization_id into org_id
  from public.organization_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if org_id is null then raise exception 'Workspace required'; end if;
  if nullif(trim(input_client_id),'') is null then raise exception 'Visma client id is required'; end if;

  generated_secret_ref := 'visma_net_client_secret_' || replace(org_id::text, '-', '');

  insert into public.erp_connections (
    organization_id, provider, external_company_id, display_name, status, secret_ref,
    default_warehouse, default_order_type, auth_mode, client_id, tenant_id, write_enabled
  )
  values (
    org_id, 'visma_net', nullif(trim(input_external_company_id),''),
    nullif(trim(input_display_name),''), 'disconnected', generated_secret_ref,
    nullif(trim(input_default_warehouse),''), coalesce(nullif(trim(input_default_order_type),''), 'SO'),
    'service', trim(input_client_id), nullif(trim(input_tenant_id),''), false
  )
  on conflict (organization_id, provider)
  do update set
    external_company_id = excluded.external_company_id,
    display_name = excluded.display_name,
    secret_ref = excluded.secret_ref,
    default_warehouse = excluded.default_warehouse,
    default_order_type = excluded.default_order_type,
    auth_mode = excluded.auth_mode,
    client_id = excluded.client_id,
    tenant_id = excluded.tenant_id,
    updated_at = now()
  returning id into conn_id;

  return jsonb_build_object(
    'ok', true,
    'connection_id', conn_id,
    'secret_ref', generated_secret_ref,
    'provider', 'visma_net'
  );
end;
$$;

revoke all on function public.configure_visma_connection(text,text,text,text,text,text) from public, anon;
grant execute on function public.configure_visma_connection(text,text,text,text,text,text) to authenticated;

create or replace function public.get_orderdesk_vault_secret(input_secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = input_secret_name
  limit 1;
$$;

revoke all on function public.get_orderdesk_vault_secret(text) from public, anon, authenticated;
grant execute on function public.get_orderdesk_vault_secret(text) to service_role;

create or replace function public.mark_visma_connection_test(
  input_connection_id uuid,
  input_ok boolean,
  input_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.erp_connections
  set status = case when input_ok then 'connected' else 'error' end,
      connected_at = case when input_ok then coalesce(connected_at, now()) else connected_at end,
      last_connection_test_at = now(),
      last_connection_error = case when input_ok then null else left(input_error, 1000) end,
      updated_at = now()
  where id = input_connection_id;
end;
$$;

revoke all on function public.mark_visma_connection_test(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.mark_visma_connection_test(uuid,boolean,text) to service_role;

create or replace function public.prepare_visma_sales_order_payload(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_org_id uuid;
  v_customer_erp_id text;
  v_order_type text := 'SO';
  v_warehouse text;
  v_endpoint text := 'https://salesorder.visma.net/api/v3/SalesOrders';
  v_lines jsonb;
  v_payload jsonb;
  v_unresolved integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into v_order from public.orders where id = target_order_id;
  if v_order.id is null then raise exception 'Order not found'; end if;

  v_org_id := v_order.organization_id;
  if not public.is_orderdesk_org_member(v_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if v_order.approved_at is null then raise exception 'Order must be approved before ERP payload preparation'; end if;
  if v_order.customer_id is null then raise exception 'Customer must be matched before ERP payload preparation'; end if;

  select erp_customer_id into v_customer_erp_id
  from public.customers
  where id = v_order.customer_id and organization_id = v_org_id;

  if nullif(trim(v_customer_erp_id), '') is null then
    raise exception 'Matched customer has no Visma customer id';
  end if;

  select
    coalesce(nullif(default_order_type,''), 'SO'),
    nullif(default_warehouse,''),
    coalesce(nullif(sales_order_endpoint,''), 'https://salesorder.visma.net/api/v3/SalesOrders')
  into v_order_type, v_warehouse, v_endpoint
  from public.erp_connections
  where organization_id = v_org_id and provider = 'visma_net'
  limit 1;

  select count(*) into v_unresolved
  from public.order_lines
  where order_id = target_order_id
    and (matched_product_id is null or review_status not in ('matched','confirmed'));

  if v_unresolved > 0 then raise exception 'All lines must have confirmed catalogue products'; end if;

  select jsonb_agg(
    jsonb_strip_nulls(
      jsonb_build_object(
        'inventoryId', p.erp_product_id,
        'description', coalesce(ol.raw_description, p.name),
        'quantity', ol.raw_quantity,
        'unitOfMeasure', coalesce(nullif(ol.raw_unit,''), nullif(p.unit,'')),
        'warehouseId', v_warehouse
      )
    )
    order by ol.line_number
  )
  into v_lines
  from public.order_lines ol
  join public.products p on p.id = ol.matched_product_id
  where ol.order_id = target_order_id;

  if v_lines is null or jsonb_array_length(v_lines) = 0 then raise exception 'Order has no lines'; end if;

  v_payload := jsonb_strip_nulls(
    jsonb_build_object(
      'type', v_order_type,
      'date', coalesce(v_order.order_date, current_date)::text || 'T00:00:00',
      'requestOn', case
        when v_order.requested_delivery_date is not null
        then v_order.requested_delivery_date::text || 'T00:00:00'
        else null
      end,
      'description', case
        when v_order.po_number is not null
        then 'OrderDesk · Customer PO ' || v_order.po_number
        else 'OrderDesk purchase order'
      end,
      'status', 'H',
      'customer', jsonb_strip_nulls(
        jsonb_build_object(
          'id', v_customer_erp_id,
          'order', v_order.po_number
        )
      ),
      'orderLines', v_lines
    )
  );

  insert into public.order_events (
    order_id, organization_id, actor_user_id, event_type, message, metadata
  )
  values (
    target_order_id, v_org_id, uid, 'visma_payload_prepared',
    'Visma Net Sales Order v3 payload prepared in dry-run mode.',
    jsonb_build_object(
      'endpoint', v_endpoint,
      'order_type', v_order_type,
      'line_count', jsonb_array_length(v_lines)
    )
  );

  return jsonb_build_object(
    'dry_run', true,
    'method', 'POST',
    'endpoint', v_endpoint,
    'api_version', 'v3',
    'payload', v_payload
  );
end;
$$;

revoke all on function public.prepare_visma_sales_order_payload(uuid) from public, anon;
grant execute on function public.prepare_visma_sales_order_payload(uuid) to authenticated;
