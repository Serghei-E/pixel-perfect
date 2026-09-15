do $$
declare
  b uuid; l1 uuid; l2 uuid;
  s_bakery uuid; s_dairy uuid; s_roaster uuid; s_pack uuid;
  p record; d date; qty int; dow int; factor numeric;
  plan_id uuid; i int; sh_start timestamptz;
  pr_cinnamon uuid; pr_sandwich uuid;
  prof_ids uuid[]; names text[]; roles public.staff_role[];
begin
  insert into public.businesses (name) values ('Rósa Coffee') returning id into b;
  insert into public.locations (business_id, name, address) values (b, 'Old Town', 'Vene 12, Tallinn') returning id into l1;
  insert into public.locations (business_id, name, address) values (b, 'Kalamaja', 'Telliskivi 60, Tallinn') returning id into l2;

  insert into public.suppliers (business_id, name, contact_email, lead_time_days) values
    (b, 'Nordic Bakehouse', 'orders@nordicbakehouse.example', 1) returning id into s_bakery;
  insert into public.suppliers (business_id, name, contact_email, lead_time_days) values
    (b, 'Vali Dairy', 'sales@validairy.example', 1) returning id into s_dairy;
  insert into public.suppliers (business_id, name, contact_email, lead_time_days) values
    (b, 'Paper & Pack', 'hello@paperpack.example', 3) returning id into s_pack;
  insert into public.suppliers (business_id, name, contact_email, lead_time_days) values
    (b, 'Rösti Roasters', 'wholesale@rosti.example', 2) returning id into s_roaster;

  insert into public.products (business_id, name, category, price, unit_cost, base_daily_demand) values
    (b,'Butter croissant','Pastries',3.20,0.95,40),
    (b,'Almond croissant','Pastries',3.80,1.20,22),
    (b,'Cinnamon roll','Pastries',3.60,1.10,20),
    (b,'Pain au chocolat','Pastries',3.50,1.05,26),
    (b,'Sourdough sandwich','Sandwiches',7.50,2.60,18),
    (b,'Halloumi sandwich','Sandwiches',8.20,3.10,12),
    (b,'Avocado toast','Breakfast',8.90,2.90,16),
    (b,'Porridge bowl','Breakfast',6.50,1.40,10),
    (b,'Carrot cake slice','Cakes',4.80,1.30,12),
    (b,'Basque cheesecake','Cakes',5.60,1.70,14),
    (b,'Iced latte','Cold drinks',4.90,0.90,34),
    (b,'Cold brew','Cold drinks',4.50,0.80,20),
    (b,'Filter coffee','Other',2.80,0.35,50),
    (b,'Sparkling water','Other',2.50,0.60,15);

  select id into pr_cinnamon from public.products where business_id=b and name='Cinnamon roll';
  select id into pr_sandwich from public.products where business_id=b and name='Sourdough sandwich';

  insert into public.ingredients (business_id, location_id, supplier_id, name, unit, current_stock, min_stock, avg_daily_usage, unit_cost, last_purchase) values
    (b,l1,s_dairy,'Whole milk','L',18,40,26,0.92,current_date-1),
    (b,l1,s_dairy,'Oat milk','L',34,25,14,1.35,current_date-2),
    (b,l1,s_roaster,'Coffee beans','kg',11,8,3.2,18.50,current_date-4),
    (b,l1,s_dairy,'Butter','kg',6,10,3.5,7.90,current_date-3),
    (b,l1,s_bakery,'Flour','kg',42,20,7,1.10,current_date-6),
    (b,l1,s_bakery,'Croissant dough','pcs',60,80,70,0.55,current_date-1),
    (b,l1,s_bakery,'Sandwich bread','loaf',5,8,6,2.40,current_date-1),
    (b,l1,s_bakery,'Avocados','pcs',0,20,18,0.85,current_date-2),
    (b,l1,s_roaster,'Syrups','btl',9,6,0.7,6.20,current_date-9),
    (b,l1,s_pack,'Cups','pcs',420,300,180,0.11,current_date-7),
    (b,l1,s_pack,'Lids','pcs',180,300,180,0.07,current_date-7);

  for p in select * from public.products where business_id = b loop
    for i in 0..89 loop
      d := current_date - i;
      dow := extract(dow from d);
      factor := case dow when 0 then 1.25 when 6 then 1.35 when 1 then 0.85 when 5 then 1.1 else 1.0 end;
      qty := greatest(1, round(p.base_daily_demand * factor * (0.85 + random()*0.3))::int);
      insert into public.sales_records (business_id, location_id, product_id, sold_on, quantity, revenue)
        values (b, l1, p.id, d, qty, qty * p.price);
      qty := greatest(1, round(p.base_daily_demand * 0.65 * factor * (0.85 + random()*0.3))::int);
      insert into public.sales_records (business_id, location_id, product_id, sold_on, quantity, revenue)
        values (b, l2, p.id, d, qty, qty * p.price);
    end loop;
  end loop;

  for i in -1..1 loop
    d := current_date + i;
    insert into public.production_plans (business_id, location_id, plan_date, status, approved_at)
      values (b, l1, d, case when i < 0 then 'approved' else 'draft' end, case when i < 0 then now() - interval '1 day' else null end)
      returning id into plan_id;
    for p in select * from public.products where business_id = b loop
      declare
        expected int := greatest(2, round(p.base_daily_demand * (0.9 + random()*0.25))::int);
        buffer int;
        rec int;
        made int;
        sold int;
      begin
        buffer := greatest(1, round(expected * 0.15)::int);
        rec := expected + buffer;
        if i < 0 then
          made := rec;
          sold := least(made, greatest(1, round(expected * (0.85 + random()*0.2))::int));
          insert into public.production_items (plan_id, product_id, expected_demand, safety_buffer, recommended_qty, planned_qty, actual_qty, sold_qty, remaining_qty, wasted_qty, status, reason)
            values (plan_id, p.id, expected, buffer, rec, rec, made, sold, made - sold, greatest(0, made - sold - 1), 'complete',
              'Based on the last four ' || trim(to_char(d,'Day')) || 's and recent waste.');
        elsif i = 0 then
          made := case when random() < 0.6 then rec else 0 end;
          sold := case when made > 0 then round(made * 0.45)::int else 0 end;
          insert into public.production_items (plan_id, product_id, expected_demand, safety_buffer, recommended_qty, planned_qty, actual_qty, sold_qty, remaining_qty, wasted_qty, status, reason)
            values (plan_id, p.id, expected, buffer, rec, rec, made, sold, greatest(0, made - sold), 0,
              case when made = 0 then 'not_started' else 'in_progress' end,
              'Based on the last four ' || trim(to_char(d,'Day')) || 's and current weather conditions.');
        else
          insert into public.production_items (plan_id, product_id, expected_demand, safety_buffer, recommended_qty, planned_qty, status, reason)
            values (plan_id, p.id, expected, buffer, rec, rec, 'not_started',
              'Based on the last four ' || trim(to_char(d,'Day')) || 's and current weather conditions.');
        end if;
      end;
    end loop;
  end loop;

  names := array['Marta Kask','Jonas Rebane','Liis Tamm','Oskar Saar','Nora Lepik','Anni Pärn'];
  roles := array['shift_leader','barista','barista','kitchen','barista','kitchen']::public.staff_role[];
  for i in 1..array_length(names,1) loop
    insert into public.profiles (business_id, location_id, full_name, email, staff_role, hourly_cost)
      values (b, l1, names[i], lower(replace(names[i],' ','.')) || '@rosa.example', roles[i], 13 + i)
      returning id into plan_id;
    prof_ids := array_append(prof_ids, plan_id);
    for dow in 0..6 loop
      insert into public.staff_availability (profile_id, day_of_week, available, note)
        values (plan_id, dow, not (dow = (i % 7)), case when dow = (i % 7) then 'Studying' else null end);
    end loop;
  end loop;

  for i in 0..6 loop
    d := date_trunc('week', current_date)::date + i;
    sh_start := d::timestamptz + interval '7 hours';
    insert into public.shifts (business_id, location_id, profile_id, role, starts_at, ends_at, confirmed)
      values (b, l1, prof_ids[1], 'shift_leader', sh_start, sh_start + interval '8 hours', true);
    insert into public.shifts (business_id, location_id, profile_id, role, starts_at, ends_at, confirmed)
      values (b, l1, prof_ids[2 + (i % 3)], 'barista', sh_start + interval '1 hour', sh_start + interval '9 hours', i % 2 = 0);
    insert into public.shifts (business_id, location_id, profile_id, role, starts_at, ends_at, confirmed)
      values (b, l1, prof_ids[4], 'kitchen', sh_start + interval '30 minutes', sh_start + interval '7 hours', true);
    if i in (2,5) then
      insert into public.shifts (business_id, location_id, role, starts_at, ends_at, is_open, note)
        values (b, l1, 'barista', sh_start + interval '4 hours', sh_start + interval '10 hours', true, 'Open shift - needs cover');
    end if;
  end loop;

  insert into public.shift_swap_requests (shift_id, requested_by, target_profile_id, reason)
    select s.id, s.profile_id, prof_ids[5], 'Dentist appointment' from public.shifts s
    where s.profile_id = prof_ids[2] order by s.starts_at limit 1;
  insert into public.shift_swap_requests (shift_id, requested_by, status, reason)
    select s.id, s.profile_id, 'approved', 'Family event' from public.shifts s
    where s.profile_id = prof_ids[3] order by s.starts_at limit 1;

  for i in 0..29 loop
    d := current_date - i;
    for p in select * from public.products where business_id = b and random() < 0.45 loop
      insert into public.waste_records (business_id, location_id, product_id, quantity, cost, reason, note, occurred_at, recorded_by)
        values (b, l1, p.id, greatest(1, round(p.base_daily_demand * 0.06 * random())::int),
          round((greatest(1, p.base_daily_demand * 0.06 * random()) * p.unit_cost)::numeric, 2),
          (array['Expired','Overproduction','Damaged','Incorrect preparation','Customer return','Other'])[1 + floor(random()*6)::int],
          null, d::timestamptz + interval '18 hours', prof_ids[1 + floor(random()*6)::int]);
    end loop;
  end loop;

  insert into public.daily_tasks (business_id, location_id, section, title, assigned_to) values
    (b,l1,'opening','Calibrate espresso grinder', prof_ids[2]),
    (b,l1,'opening','Fill pastry case and label prices', prof_ids[1]),
    (b,l1,'opening','Check milk and oat milk stock', prof_ids[3]),
    (b,l1,'opening','Record fridge temperatures', prof_ids[4]),
    (b,l1,'closing','Log unsold pastries as waste', prof_ids[2]),
    (b,l1,'closing','Backflush and clean machine', prof_ids[1]),
    (b,l1,'closing','Count cash drawer', prof_ids[1]),
    (b,l1,'closing','Take out bins and lock up', prof_ids[4]);

  insert into public.stockout_reports (business_id, location_id, product_id, ingredient_id, reported_by, note, reported_at)
    select b, l1, pr_sandwich, (select id from public.ingredients where business_id=b and name='Avocados'), prof_ids[2], 'Avocados ran out before lunch', now() - interval '5 hours';
  insert into public.stockout_reports (business_id, location_id, product_id, reported_by, note, reported_at, resolved)
    select b, l1, pr_cinnamon, prof_ids[3], 'Sold out by 11:00', now() - interval '2 days', true;

  insert into public.recommendations (business_id, location_id, category, title, detail, reason) values
    (b,l1,'production','Prepare 46 croissants','Recommended for today at Old Town','Average of the last four Mondays was 40, plus a 6 unit safety buffer for warm weather footfall.'),
    (b,l1,'production','Prepare 22 cinnamon rolls','Recommended for today at Old Town','Sold out before 11:00 twice last week, so production goes up by 10%.'),
    (b,l1,'staffing','Schedule 3 baristas from 08:00-11:00','Morning peak cover','Expected morning sales are 18% above the recent average for this weekday.'),
    (b,l1,'inventory','Order 30 litres of milk','Suggested order for tomorrow','Current stock of 18 L is below the 40 L minimum and daily use averages 26 L.'),
    (b,l1,'production','Reduce sandwich production after 15:00','Afternoon adjustment','Sandwich sales after 15:00 dropped 34% over the last three comparable days.');

  insert into public.notifications (business_id, title, body) values
    (b,'Avocados are out of stock','Reported 5 hours ago by Jonas at Old Town.'),
    (b,'Today''s plan needs approval','Review the recommended production quantities for today.'),
    (b,'Swap request waiting','Jonas asked Nora to cover the Wednesday morning shift.');

  insert into public.inventory_records (ingredient_id, counted_stock, counted_at, note)
    select id, current_stock, now() - interval '1 day', 'Morning count' from public.ingredients where business_id = b;
end $$;