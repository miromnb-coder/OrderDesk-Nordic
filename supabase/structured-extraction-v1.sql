-- Structured extraction + optional sample catalogue
-- Applied to the connected Supabase project on 2026-09-24.

alter table public.orders
  add column if not exists raw_customer_name text,
  add column if not exists extraction_version text,
  add column if not exists extraction_metadata jsonb not null default '{}'::jsonb;

create or replace function public.seed_orderdesk_sample_catalog()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  customer_uuid uuid;
  pump_uuid uuid;
  elbow_uuid uuid;
  valve_uuid uuid;
  pump2_uuid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select organization_id into org_id
  from public.organization_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if org_id is null then raise exception 'Workspace required'; end if;

  insert into public.customers (organization_id, erp_customer_id, name, business_id, email_domain)
  values (org_id, '100284', 'Putkiurakointi Oy', '1234567-8', 'example.test')
  on conflict (organization_id, erp_customer_id)
  do update set name = excluded.name, business_id = excluded.business_id, email_domain = excluded.email_domain
  returning id into customer_uuid;

  insert into public.products (organization_id, erp_product_id, sku, name, manufacturer, unit, search_text)
  values (org_id, 'GRU-98561418', 'GRU-98561418', 'Grundfos ALPHA2 25-60', 'Grundfos', 'pcs', 'grundfos alpha2 25-60 circulation pump')
  on conflict (organization_id, erp_product_id)
  do update set sku = excluded.sku, name = excluded.name, manufacturer = excluded.manufacturer, unit = excluded.unit, search_text = excluded.search_text
  returning id into pump_uuid;

  insert into public.products (organization_id, erp_product_id, sku, name, manufacturer, unit, search_text)
  values (org_id, 'UPO-314729', 'UPO-314729', 'Uponor S-Press PLUS elbow 25', 'Uponor', 'pcs', 'uponor elbow 25 mm s-press plus')
  on conflict (organization_id, erp_product_id)
  do update set sku = excluded.sku, name = excluded.name, manufacturer = excluded.manufacturer, unit = excluded.unit, search_text = excluded.search_text
  returning id into elbow_uuid;

  insert into public.products (organization_id, erp_product_id, sku, name, manufacturer, unit, search_text)
  values (org_id, 'DAN-004812', 'DAN-004812', 'Danfoss RA-N valve body 1/2', 'Danfoss', 'pcs', 'danfoss valve 1/2 inch ra-n valve body')
  on conflict (organization_id, erp_product_id)
  do update set sku = excluded.sku, name = excluded.name, manufacturer = excluded.manufacturer, unit = excluded.unit, search_text = excluded.search_text
  returning id into valve_uuid;

  insert into public.products (organization_id, erp_product_id, sku, name, manufacturer, unit, search_text)
  values (org_id, 'GRU-99411175', 'GRU-99411175', 'Grundfos ALPHA1 L 25-40', 'Grundfos', 'pcs', 'grundfos alpha1 l 25-40 circulation pump')
  on conflict (organization_id, erp_product_id)
  do update set sku = excluded.sku, name = excluded.name, manufacturer = excluded.manufacturer, unit = excluded.unit, search_text = excluded.search_text
  returning id into pump2_uuid;

  insert into public.customer_product_mappings
    (organization_id, customer_id, customer_sku, customer_description, product_id, confidence, source, times_used)
  values
    (org_id, customer_uuid, 'PUMP-37A', 'Grundfos Alpha2 25-60', pump_uuid, 100, 'imported', 18),
    (org_id, customer_uuid, 'UPO-EL25', 'Uponor elbow 25 mm', elbow_uuid, 100, 'imported', 12),
    (org_id, customer_uuid, 'VALVE-X12', 'Danfoss valve 1/2 inch', valve_uuid, 100, 'imported', 11)
  on conflict (organization_id, customer_id, customer_sku)
  do update set
    customer_description = excluded.customer_description,
    product_id = excluded.product_id,
    confidence = excluded.confidence,
    source = excluded.source,
    times_used = greatest(public.customer_product_mappings.times_used, excluded.times_used);

  return jsonb_build_object(
    'organization_id', org_id,
    'customer_id', customer_uuid,
    'products', 4,
    'known_mappings', 3
  );
end;
$$;

revoke all on function public.seed_orderdesk_sample_catalog() from public, anon;
grant execute on function public.seed_orderdesk_sample_catalog() to authenticated;
