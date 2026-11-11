create or replace function public.ensure_production_plan(p_location uuid, p_date date)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare pid uuid; bid uuid; past boolean := p_date < current_date;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into pid from production_plans where location_id=p_location and plan_date=p_date;
  if pid is not null then return pid; end if;
  select business_id into bid from locations where id=p_location;
  if bid is null then raise exception 'Unknown location'; end if;
  insert into production_plans(business_id,location_id,plan_date,status,approved_at)
  values (bid,p_location,p_date,case when past then 'approved' else 'draft' end, case when past then now() end)
  returning id into pid;
  insert into production_items(plan_id,product_id,expected_demand,safety_buffer,recommended_qty,planned_qty,actual_qty,sold_qty,remaining_qty,wasted_qty,status,source,reason)
  select pid, x.id, x.d, x.b, x.d+x.b, x.d+x.b,
    case when past then x.d+x.b else 0 end,
    case when past then least(x.d+x.b, coalesce(x.actual, x.d)) else 0 end,
    case when past then greatest(0, x.d+x.b-coalesce(x.actual,x.d)) - floor(greatest(0, x.d+x.b-coalesce(x.actual,x.d))*0.5)::int else 0 end,
    case when past then floor(greatest(0, x.d+x.b-coalesce(x.actual,x.d))*0.5)::int else 0 end,
    case when past then 'complete' else 'not_started' end, 'system',
    'Average of the last ' || x.n || ' ' || to_char(p_date,'FMDay') || 's is ' || x.d || ', plus a 10% safety buffer.'
  from (
    select p.id,
      coalesce(round(avg(s.quantity))::int, p.base_daily_demand) d,
      ceil(coalesce(avg(s.quantity), p.base_daily_demand)*0.1)::int b,
      greatest(count(s.id),1) n,
      (select sum(quantity)::int from sales_records a where a.product_id=p.id and a.location_id=p_location and a.sold_on=p_date) actual
    from products p
    left join sales_records s on s.product_id=p.id and s.location_id=p_location
      and s.sold_on in (p_date-7,p_date-14,p_date-21,p_date-28)
    where p.business_id=bid and p.active
    group by p.id
  ) x;
  return pid;
end $$;
revoke execute on function public.ensure_production_plan(uuid,date) from public, anon;
grant execute on function public.ensure_production_plan(uuid,date) to authenticated;