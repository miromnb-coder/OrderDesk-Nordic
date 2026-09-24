-- Product correction, customer memory and approval workflow.
-- Applied to the connected Supabase project on 2026-09-24.

create or replace function public.confirm_orderdesk_line_match(
  target_order_line_id uuid,
  target_product_id uuid,
  remember_for_customer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_order_id uuid;
  v_org_id uuid;
  v_customer_id uuid;
  v_raw_sku text;
  v_raw_description text;
  v_previous_product_id uuid;
  v_remaining integer;
  v_product_sku text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select ol.order_id, o.organization_id, o.customer_id, ol.raw_sku, ol.raw_description, ol.matched_product_id
  into v_order_id, v_org_id, v_customer_id, v_raw_sku, v_raw_description, v_previous_product_id
  from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  where ol.id = target_order_line_id;

  if v_order_id is null then raise exception 'Order line not found'; end if;
  if not public.is_orderdesk_org_member(v_org_id) then raise exception 'Not authorized for this workspace'; end if;

  select sku into v_product_sku
  from public.products
  where id = target_product_id
    and organization_id = v_org_id
    and active = true;

  if v_product_sku is null then raise exception 'Product not found in this workspace'; end if;

  update public.order_lines
  set matched_product_id = target_product_id,
      match_confidence = 100,
      match_method = 'manual',
      review_status = 'confirmed'
  where id = target_order_line_id;

  insert into public.mapping_corrections (
    organization_id, order_id, order_line_id, customer_id, previous_product_id,
    selected_product_id, corrected_by_user_id, remember_for_customer
  )
  values (
    v_org_id, v_order_id, target_order_line_id, v_customer_id, v_previous_product_id,
    target_product_id, uid, remember_for_customer
  );

  if remember_for_customer and v_customer_id is not null and nullif(trim(v_raw_sku), '') is not null then
    insert into public.customer_product_mappings (
      organization_id, customer_id, customer_sku, customer_description, product_id,
      confidence, source, confirmed_by_user_id, times_used, last_used_at
    )
    values (
      v_org_id, v_customer_id, trim(v_raw_sku), v_raw_description, target_product_id,
      100, 'user_confirmed', uid, 1, now()
    )
    on conflict (organization_id, customer_id, customer_sku)
    do update set
      customer_description = excluded.customer_description,
      product_id = excluded.product_id,
      confidence = 100,
      source = 'user_confirmed',
      confirmed_by_user_id = uid,
      times_used = public.customer_product_mappings.times_used + 1,
      last_used_at = now(),
      updated_at = now();
  end if;

  select count(*) into v_remaining
  from public.order_lines
  where order_id = v_order_id
    and review_status not in ('matched', 'confirmed');

  update public.orders
  set status = case
        when v_customer_id is not null and v_remaining = 0 then 'ready'
        else 'needs_review'
      end,
      overall_confidence = (
        select round(avg(coalesce(match_confidence, 0)))::numeric(5,2)
        from public.order_lines
        where order_id = v_order_id
      )
  where id = v_order_id;

  insert into public.order_events (
    order_id, organization_id, actor_user_id, event_type, message, metadata
  )
  values (
    v_order_id, v_org_id, uid, 'line_match_confirmed',
    'Order line product match confirmed.',
    jsonb_build_object(
      'order_line_id', target_order_line_id,
      'product_id', target_product_id,
      'product_sku', v_product_sku,
      'remembered', remember_for_customer
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'remaining_review_lines', v_remaining,
    'ready', (v_customer_id is not null and v_remaining = 0),
    'remembered', (remember_for_customer and v_customer_id is not null and nullif(trim(v_raw_sku), '') is not null)
  );
end;
$$;

revoke all on function public.confirm_orderdesk_line_match(uuid, uuid, boolean) from public, anon;
grant execute on function public.confirm_orderdesk_line_match(uuid, uuid, boolean) to authenticated;

create or replace function public.approve_orderdesk_order(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_org_id uuid;
  v_customer_id uuid;
  v_unresolved integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select organization_id, customer_id
  into v_org_id, v_customer_id
  from public.orders
  where id = target_order_id;

  if v_org_id is null then raise exception 'Order not found'; end if;
  if not public.is_orderdesk_org_member(v_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if v_customer_id is null then raise exception 'Customer must be matched before approval'; end if;

  select count(*) into v_unresolved
  from public.order_lines
  where order_id = target_order_id
    and review_status not in ('matched', 'confirmed');

  if v_unresolved > 0 then raise exception 'All order lines must be resolved before approval'; end if;

  update public.orders
  set status = 'ready',
      approved_at = now(),
      approved_by_user_id = uid,
      error_message = null
  where id = target_order_id;

  insert into public.order_events (
    order_id, organization_id, actor_user_id, event_type, message, metadata
  )
  values (
    target_order_id, v_org_id, uid, 'approved',
    'Order approved and ready for ERP creation.',
    jsonb_build_object('approved_at', now())
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', target_order_id,
    'status', 'ready',
    'approved', true
  );
end;
$$;

revoke all on function public.approve_orderdesk_order(uuid) from public, anon;
grant execute on function public.approve_orderdesk_order(uuid) to authenticated;
