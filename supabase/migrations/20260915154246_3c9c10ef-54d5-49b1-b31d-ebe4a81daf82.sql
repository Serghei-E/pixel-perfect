-- CaféFlow schema
create type public.app_role as enum ('owner','manager','staff');
create type public.staff_role as enum ('barista','kitchen','shift_leader','manager');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'EUR',
  opening_hours jsonb not null default '{"mon-fri":"07:30-18:00","sat-sun":"08:30-17:00"}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  business_id uuid references public.businesses(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  full_name text not null,
  email text,
  staff_role public.staff_role not null default 'barista',
  hourly_cost numeric not null default 14,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  contact_email text,
  lead_time_days int not null default 2,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  price numeric not null default 0,
  unit_cost numeric not null default 0,
  base_daily_demand int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  unit text not null default 'unit',
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  avg_daily_usage numeric not null default 1,
  unit_cost numeric not null default 0,
  last_purchase date,
  created_at timestamptz not null default now()
);

create table public.sales_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sold_on date not null,
  quantity int not null default 0,
  revenue numeric not null default 0
);

create table public.production_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  plan_date date not null,
  status text not null default 'draft',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (location_id, plan_date)
);

create table public.production_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.production_plans(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  expected_demand int not null default 0,
  safety_buffer int not null default 0,
  recommended_qty int not null default 0,
  planned_qty int not null default 0,
  actual_qty int not null default 0,
  sold_qty int not null default 0,
  remaining_qty int not null default 0,
  wasted_qty int not null default 0,
  status text not null default 'not_started',
  source text not null default 'system',
  reason text,
  note text,
  updated_at timestamptz not null default now()
);

create table public.inventory_records (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  counted_stock numeric not null default 0,
  counted_at timestamptz not null default now(),
  note text,
  order_status text
);

create table public.waste_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 1,
  cost numeric not null default 0,
  reason text not null default 'Overproduction',
  note text,
  occurred_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null
);

create table public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week int not null,
  available boolean not null default true,
  note text,
  unique (profile_id, day_of_week)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  role public.staff_role not null default 'barista',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_open boolean not null default false,
  confirmed boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create table public.shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  reason text,
  created_at timestamptz not null default now()
);

create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  task_date date not null default current_date,
  section text not null default 'opening',
  title text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  completed boolean not null default false
);

create table public.stockout_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null,
  note text,
  reported_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  rec_date date not null default current_date,
  category text not null default 'production',
  title text not null,
  detail text,
  reason text,
  status text not null default 'system',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- role helper
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- new users join the demo business with the role from their signup metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b_id uuid;
  l_id uuid;
  r public.app_role;
  sr public.staff_role;
begin
  select id into b_id from public.businesses order by created_at limit 1;
  select id into l_id from public.locations where business_id = b_id order by created_at limit 1;
  r := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'owner')::public.app_role;
  sr := case r when 'owner' then 'manager' when 'manager' then 'manager' else 'barista' end::public.staff_role;

  insert into public.profiles (user_id, business_id, location_id, full_name, email, staff_role, hourly_cost)
  values (new.id, b_id, l_id,
          coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
          new.email, sr, case when r = 'staff' then 14 else 22 end)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, r) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- grants + RLS (single shared demo workspace: any signed-in team member sees the café data)
do $$
declare t text;
begin
  foreach t in array array['businesses','locations','profiles','suppliers','products','ingredients','sales_records',
    'production_plans','production_items','inventory_records','waste_records','staff_availability','shifts',
    'shift_swap_requests','daily_tasks','stockout_reports','recommendations','notifications']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "team read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "team write %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "team update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "team delete %1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());