-- Visma compliance gate, dry-run validation and live-write lock.
-- Applied to the connected Supabase project on 2026-09-24.
-- The compliance fields mirror the operational controls needed for the uploaded
-- Visma Developer Terms v25.06.2026: customer authorisation, prior written consent
-- for AI Integration production use, human-in-the-loop for writes, End User Terms,
-- no AI training without written permission, and limited data retention.

alter table public.erp_connections
  add column if not exists customer_authorized boolean not null default false,
  add column if not exists visma_ai_written_consent boolean not null default false,
  add column if not exists human_review_required boolean not null default true,
  add column if not exists end_user_terms_ready boolean not null default false,
  add column if not exists no_ai_training_ack boolean not null default false,
  add column if not exists data_minimization_ack boolean not null default false,
  add column if not exists compliance_updated_at timestamptz,
  add column if not exists compliance_updated_by uuid references auth.users(id) on delete set null;

revoke insert, update on public.erp_connections from authenticated;

drop policy if exists "members insert erp connections" on public.erp_connections;
drop policy if exists "members update erp connections" on public.erp_connections;

create or replace function public.set_visma_compliance_gate(
  input_customer_authorized boolean,
  input_visma_ai_written_consent boolean,
  input_human_review_required boolean,
  input_end_user_terms_ready boolean,
  input_no_ai_training_ack boolean,
  input_data_minimization_ack boolean
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
  all_ready boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select organization_id into org_id
  from public.organization_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if org_id is null then raise exception 'Workspace required'; end if;

  all_ready :=
    input_customer_authorized
    and input_visma_ai_written_consent
    and input_human_review_required
    and input_end_user_terms_ready
    and input_no_ai_training_ack
    and input_data_minimization_ack;

  update public.erp_connections
  set
    customer_authorized = input_customer_authorized,
    visma_ai_written_consent = input_visma_ai_written_consent,
    human_review_required = input_human_review_required,
    end_user_terms_ready = input_end_user_terms_ready,
    no_ai_training_ack = input_no_ai_training_ack,
    data_minimization_ack = input_data_minimization_ack,
    compliance_updated_at = now(),
    compliance_updated_by = uid,
    write_enabled = case when all_ready then write_enabled else false end,
    updated_at = now()
  where organization_id = org_id
    and provider = 'visma_net'
  returning id into conn_id;

  if conn_id is null then raise exception 'Configure the Visma Net connection first'; end if;

  return jsonb_build_object(
    'ok', true,
    'compliance_ready', all_ready,
    'write_enabled', case when all_ready then (
      select write_enabled from public.erp_connections where id = conn_id
    ) else false end
  );
end;
$$;

revoke all on function public.set_visma_compliance_gate(boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.set_visma_compliance_gate(boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.set_visma_live_write(input_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  conn public.erp_connections%rowtype;
  compliance_ready boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select organization_id into org_id
  from public.organization_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if org_id is null then raise exception 'Workspace required'; end if;

  select * into conn
  from public.erp_connections
  where organization_id = org_id and provider = 'visma_net'
  limit 1;

  if conn.id is null then raise exception 'Configure the Visma Net connection first'; end if;

  compliance_ready :=
    conn.customer_authorized
    and conn.visma_ai_written_consent
    and conn.human_review_required
    and conn.end_user_terms_ready
    and conn.no_ai_training_ack
    and conn.data_minimization_ack;

  if input_enabled and not compliance_ready then
    raise exception 'Compliance gate is incomplete';
  end if;

  if input_enabled and conn.status <> 'connected' then
    raise exception 'Test and verify the Visma connection before enabling live writes';
  end if;

  update public.erp_connections
  set write_enabled = input_enabled, updated_at = now()
  where id = conn.id;

  return jsonb_build_object(
    'ok', true,
    'write_enabled', input_enabled,
    'compliance_ready', compliance_ready,
    'connection_status', conn.status
  );
end;
$$;

revoke all on function public.set_visma_live_write(boolean) from public, anon;
grant execute on function public.set_visma_live_write(boolean) to authenticated;

create or replace function public.validate_visma_sales_order_dry_run(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_customer_id text;
  v_order_type text;
  v_warehouse text;
  v_checks jsonb := '[]'::jsonb;
  v_lines jsonb;
  v_payload jsonb;
  v_unresolved integer;
  v_missing_inventory integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into v_order from public.orders where id = target_order_id;
  if v_order.id is null then raise exception 'Order not found'; end if;

  if not public.is_orderdesk_org_member(v_order.organization_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  select erp_customer_id into v_customer_id
  from public.customers
  where id = v_order.customer_id and organization_id = v_order.organization_id;

  select coalesce(nullif(default_order_type,''), 'SO'), nullif(default_warehouse,'')
  into v_order_type, v_warehouse
  from public.erp_connections
  where organization_id = v_order.organization_id and provider = 'visma_net'
  limit 1;

  select count(*) into v_unresolved
  from public.order_lines
  where order_id = target_order_id
    and (matched_product_id is null or review_status not in ('matched','confirmed'));

  select count(*) into v_missing_inventory
  from public.order_lines ol
  left join public.products p on p.id = ol.matched_product_id
  where ol.order_id = target_order_id
    and (p.erp_product_id is null or trim(p.erp_product_id) = '');

  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key','approved','label','Human approval recorded','ok', v_order.approved_at is not null,
    'detail', case when v_order.approved_at is not null then 'Approved before ERP handoff' else 'Approve the order first' end
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key','customer','label','Visma customer ID available','ok', nullif(trim(v_customer_id),'') is not null,
    'detail', coalesce(v_customer_id,'Missing Visma customer ID')
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key','lines','label','All order lines resolved','ok', v_unresolved = 0,
    'detail', case when v_unresolved = 0 then 'All lines have confirmed products' else v_unresolved::text || ' line(s) still need review' end
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key','inventory','label','ERP inventory IDs available','ok', v_missing_inventory = 0,
    'detail', case when v_missing_inventory = 0 then 'All matched products have ERP IDs' else v_missing_inventory::text || ' product(s) are missing ERP IDs' end
  ));
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'key','order_type','label','Sales order type available','ok', nullif(trim(v_order_type),'') is not null,
    'detail', coalesce(v_order_type,'Missing order type')
  ));

  select jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'lineNumber', ol.line_number,
      'sourceSku', ol.raw_sku,
      'sourceDescription', ol.raw_description,
      'sourceQuantity', ol.raw_quantity,
      'sourceUnit', ol.raw_unit,
      'inventoryId', p.erp_product_id,
      'description', coalesce(ol.raw_description,p.name),
      'quantity', ol.raw_quantity,
      'unitOfMeasure', coalesce(nullif(ol.raw_unit,''), nullif(p.unit,'')),
      'warehouseId', v_warehouse
    ))
    order by ol.line_number
  )
  into v_lines
  from public.order_lines ol
  left join public.products p on p.id = ol.matched_product_id
  where ol.order_id = target_order_id;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'type', v_order_type,
    'date', coalesce(v_order.order_date,current_date)::text || 'T00:00:00',
    'requestOn', case when v_order.requested_delivery_date is not null then v_order.requested_delivery_date::text || 'T00:00:00' else null end,
    'description', case when v_order.po_number is not null then 'OrderDesk · Customer PO ' || v_order.po_number else 'OrderDesk purchase order' end,
    'status', 'H',
    'customer', jsonb_strip_nulls(jsonb_build_object('id', v_customer_id,'order', v_order.po_number)),
    'orderLines', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'inventoryId', item->>'inventoryId',
        'description', item->>'description',
        'quantity', (item->>'quantity')::numeric,
        'unitOfMeasure', item->>'unitOfMeasure',
        'warehouseId', item->>'warehouseId'
      )))
      from jsonb_array_elements(coalesce(v_lines,'[]'::jsonb)) item
    ), '[]'::jsonb)
  ));

  return jsonb_build_object(
    'valid', not exists (
      select 1 from jsonb_array_elements(v_checks) item
      where coalesce((item->>'ok')::boolean,false) = false
    ),
    'checks', v_checks,
    'payload', v_payload,
    'diff', jsonb_build_object(
      'customer', jsonb_build_object('source', v_order.raw_customer_name,'vismaCustomerId', v_customer_id),
      'poNumber', jsonb_build_object('source', v_order.po_number,'vismaCustomerOrder', v_order.po_number),
      'orderDate', jsonb_build_object('source', v_order.order_date,'vismaDate', coalesce(v_order.order_date,current_date)::text || 'T00:00:00'),
      'requestedDeliveryDate', jsonb_build_object(
        'source', v_order.requested_delivery_date,
        'vismaRequestOn', case when v_order.requested_delivery_date is not null then v_order.requested_delivery_date::text || 'T00:00:00' else null end
      ),
      'lines', coalesce(v_lines,'[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.validate_visma_sales_order_dry_run(uuid) from public, anon;
grant execute on function public.validate_visma_sales_order_dry_run(uuid) to authenticated;
