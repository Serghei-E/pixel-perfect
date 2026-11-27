create or replace function public.my_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select business_id from public.profiles where user_id = auth.uid() limit 1
$$;
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;
create or replace function public.is_cafe_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('owner','manager'))
$$;
create or replace function public.is_cafe_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'owner')
$$;
revoke execute on function public.my_business_id(), public.my_profile_id(), public.is_cafe_manager(), public.is_cafe_owner() from public, anon;
grant execute on function public.my_business_id(), public.my_profile_id(), public.is_cafe_manager(), public.is_cafe_owner() to authenticated;

do $$ declare t text; begin
  foreach t in array array['businesses','notifications','inventory_records','ingredients','profiles','daily_tasks','production_items','products','locations','production_plans'] loop
    execute format('drop policy if exists "team read %1$s" on public.%1$I', t);
    execute format('drop policy if exists "team write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "team update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "team delete %1$s" on public.%1$I', t);
  end loop;
end $$;

-- businesses: team reads its own café, only owners edit it
create policy "members read own business" on public.businesses for select to authenticated using (id = public.my_business_id());
create policy "owners update own business" on public.businesses for update to authenticated using (id = public.my_business_id() and public.is_cafe_owner()) with check (id = public.my_business_id());

-- locations: owners manage
create policy "members read locations" on public.locations for select to authenticated using (business_id = public.my_business_id());
create policy "owners add locations" on public.locations for insert to authenticated with check (business_id = public.my_business_id() and public.is_cafe_owner());
create policy "owners update locations" on public.locations for update to authenticated using (business_id = public.my_business_id() and public.is_cafe_owner()) with check (business_id = public.my_business_id());
create policy "owners delete locations" on public.locations for delete to authenticated using (business_id = public.my_business_id() and public.is_cafe_owner());

-- business-scoped tables managed by owners/managers
do $$ declare t text; begin
  foreach t in array array['products','ingredients','production_plans','daily_tasks','notifications'] loop
    execute format('create policy "managers add %1$s" on public.%1$I for insert to authenticated with check (business_id = public.my_business_id() and public.is_cafe_manager())', t);
    execute format('create policy "managers delete %1$s" on public.%1$I for delete to authenticated using (business_id = public.my_business_id() and public.is_cafe_manager())', t);
  end loop;
  foreach t in array array['products','ingredients','production_plans'] loop
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (business_id = public.my_business_id())', t);
    execute format('create policy "managers update %1$s" on public.%1$I for update to authenticated using (business_id = public.my_business_id() and public.is_cafe_manager()) with check (business_id = public.my_business_id())', t);
  end loop;
end $$;

-- daily tasks: everyone in the café can tick tasks off
create policy "members read daily_tasks" on public.daily_tasks for select to authenticated using (business_id = public.my_business_id());
create policy "members update daily_tasks" on public.daily_tasks for update to authenticated using (business_id = public.my_business_id()) with check (business_id = public.my_business_id());

-- notifications: see your own or café-wide ones; managers see all
create policy "members read notifications" on public.notifications for select to authenticated using (business_id = public.my_business_id() and (profile_id is null or profile_id = public.my_profile_id() or public.is_cafe_manager()));
create policy "members update notifications" on public.notifications for update to authenticated using (business_id = public.my_business_id() and (profile_id = public.my_profile_id() or public.is_cafe_manager())) with check (business_id = public.my_business_id());

-- production items via their plan
create policy "members read production_items" on public.production_items for select to authenticated using (exists (select 1 from public.production_plans p where p.id = plan_id and p.business_id = public.my_business_id()));
create policy "managers add production_items" on public.production_items for insert to authenticated with check (public.is_cafe_manager() and exists (select 1 from public.production_plans p where p.id = plan_id and p.business_id = public.my_business_id()));
create policy "managers update production_items" on public.production_items for update to authenticated using (public.is_cafe_manager() and exists (select 1 from public.production_plans p where p.id = plan_id and p.business_id = public.my_business_id())) with check (exists (select 1 from public.production_plans p where p.id = plan_id and p.business_id = public.my_business_id()));
create policy "managers delete production_items" on public.production_items for delete to authenticated using (public.is_cafe_manager() and exists (select 1 from public.production_plans p where p.id = plan_id and p.business_id = public.my_business_id()));

-- inventory records via their ingredient
create policy "members read inventory_records" on public.inventory_records for select to authenticated using (exists (select 1 from public.ingredients i where i.id = ingredient_id and i.business_id = public.my_business_id()));
create policy "managers add inventory_records" on public.inventory_records for insert to authenticated with check (public.is_cafe_manager() and exists (select 1 from public.ingredients i where i.id = ingredient_id and i.business_id = public.my_business_id()));
create policy "managers update inventory_records" on public.inventory_records for update to authenticated using (public.is_cafe_manager() and exists (select 1 from public.ingredients i where i.id = ingredient_id and i.business_id = public.my_business_id())) with check (exists (select 1 from public.ingredients i where i.id = ingredient_id and i.business_id = public.my_business_id()));
create policy "managers delete inventory_records" on public.inventory_records for delete to authenticated using (public.is_cafe_manager() and exists (select 1 from public.ingredients i where i.id = ingredient_id and i.business_id = public.my_business_id()));

-- profiles: team list visible; people edit themselves, managers edit the team
create policy "members read profiles" on public.profiles for select to authenticated using (business_id = public.my_business_id() or user_id = auth.uid());
create policy "managers add profiles" on public.profiles for insert to authenticated with check (business_id = public.my_business_id() and public.is_cafe_manager());
create policy "self or managers update profiles" on public.profiles for update to authenticated using (user_id = auth.uid() or (business_id = public.my_business_id() and public.is_cafe_manager())) with check (business_id = public.my_business_id());
create policy "managers delete profiles" on public.profiles for delete to authenticated using (business_id = public.my_business_id() and public.is_cafe_manager() and user_id is distinct from auth.uid());