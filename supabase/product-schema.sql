-- OrderDesk product v0 schema
-- Applied to the connected Supabase project on 2026-09-24.
-- Product tables are RLS-protected and intentionally have no client policies yet.
-- The first UI uses demo data until Supabase Auth and server-side data access are wired.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','reviewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.erp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('visma_net')),
  external_company_id text,
  display_name text,
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  secret_ref text,
  default_warehouse text,
  default_order_type text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  erp_customer_id text not null,
  name text not null check (char_length(name) between 1 and 240),
  business_id text,
  email_domain text,
  delivery_address jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, erp_customer_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  erp_product_id text not null,
  sku text not null,
  name text not null,
  manufacturer text,
  unit text,
  active boolean not null default true,
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, erp_product_id),
  unique (organization_id, sku)
);

create table if not exists public.customer_product_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_sku text not null,
  customer_description text,
  product_id uuid not null references public.products(id) on delete restrict,
  confidence numeric(5,2) not null default 100 check (confidence between 0 and 100),
  source text not null default 'user_confirmed' check (source in ('user_confirmed','imported','system')),
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  times_used integer not null default 0 check (times_used >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id, customer_sku)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  source_type text not null check (source_type in ('pdf','excel','email','manual')),
  source_file_name text,
  source_storage_path text,
  po_number text,
  order_date date,
  requested_delivery_date date,
  delivery_address jsonb,
  status text not null default 'received' check (status in ('received','processing','needs_review','ready','creating','created','failed')),
  overall_confidence numeric(5,2) check (overall_confidence is null or overall_confidence between 0 and 100),
  erp_order_id text,
  erp_order_number text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  raw_sku text,
  raw_description text,
  raw_quantity numeric(14,4) not null check (raw_quantity > 0),
  raw_unit text,
  matched_product_id uuid references public.products(id) on delete set null,
  match_confidence numeric(5,2) check (match_confidence is null or match_confidence between 0 and 100),
  match_method text check (match_method is null or match_method in ('customer_mapping','alias','catalogue','ai_suggestion','manual')),
  review_status text not null default 'pending' check (review_status in ('pending','matched','needs_review','confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create table if not exists public.mapping_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  previous_product_id uuid references public.products(id) on delete set null,
  selected_product_id uuid not null references public.products(id) on delete restrict,
  corrected_by_user_id uuid references auth.users(id) on delete set null,
  remember_for_customer boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists erp_connections_organization_id_idx on public.erp_connections(organization_id);
create index if not exists customers_organization_id_idx on public.customers(organization_id);
create index if not exists customers_name_idx on public.customers(organization_id, name);
create index if not exists products_organization_id_idx on public.products(organization_id);
create index if not exists products_sku_idx on public.products(organization_id, sku);
create index if not exists customer_product_mappings_customer_id_idx on public.customer_product_mappings(customer_id);
create index if not exists customer_product_mappings_product_id_idx on public.customer_product_mappings(product_id);
create index if not exists customer_product_mappings_confirmed_by_user_id_idx on public.customer_product_mappings(confirmed_by_user_id);
create index if not exists orders_organization_status_idx on public.orders(organization_id, status, received_at desc);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_approved_by_user_id_idx on public.orders(approved_by_user_id);
create index if not exists order_lines_order_id_idx on public.order_lines(order_id);
create index if not exists order_lines_matched_product_id_idx on public.order_lines(matched_product_id);
create index if not exists mapping_corrections_order_id_idx on public.mapping_corrections(order_id);
create index if not exists mapping_corrections_order_line_id_idx on public.mapping_corrections(order_line_id);
create index if not exists mapping_corrections_organization_id_idx on public.mapping_corrections(organization_id);
create index if not exists mapping_corrections_customer_id_idx on public.mapping_corrections(customer_id);
create index if not exists mapping_corrections_previous_product_id_idx on public.mapping_corrections(previous_product_id);
create index if not exists mapping_corrections_selected_product_id_idx on public.mapping_corrections(selected_product_id);
create index if not exists mapping_corrections_corrected_by_user_id_idx on public.mapping_corrections(corrected_by_user_id);
create index if not exists order_events_order_id_created_at_idx on public.order_events(order_id, created_at);
create index if not exists order_events_organization_id_idx on public.order_events(organization_id);
create index if not exists order_events_actor_user_id_idx on public.order_events(actor_user_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.erp_connections enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.customer_product_mappings enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.mapping_corrections enable row level security;
alter table public.order_events enable row level security;

revoke all on table public.organizations, public.organization_members, public.erp_connections,
  public.customers, public.products, public.customer_product_mappings, public.orders,
  public.order_lines, public.mapping_corrections, public.order_events
from anon, authenticated;

create or replace function public.orderdesk_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.orderdesk_set_updated_at() from public, anon, authenticated;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.orderdesk_set_updated_at();

drop trigger if exists erp_connections_set_updated_at on public.erp_connections;
create trigger erp_connections_set_updated_at before update on public.erp_connections
for each row execute function public.orderdesk_set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.orderdesk_set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.orderdesk_set_updated_at();

drop trigger if exists customer_product_mappings_set_updated_at on public.customer_product_mappings;
create trigger customer_product_mappings_set_updated_at before update on public.customer_product_mappings
for each row execute function public.orderdesk_set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.orderdesk_set_updated_at();

drop trigger if exists order_lines_set_updated_at on public.order_lines;
create trigger order_lines_set_updated_at before update on public.order_lines
for each row execute function public.orderdesk_set_updated_at();
