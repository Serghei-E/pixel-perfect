# Fill every date with information

Right now sample plans exist only for yesterday, today and tomorrow at Old Town, and sample shifts may all be in the past. Goal: whatever date or location you pick, the screens show real-looking information.

## What you will see
- **Daily Plan, Production, Dashboard:** any date at either location (Old Town or Kalamaja) shows a plan. If none exists yet, the app builds one automatically from past sales for that weekday, recent waste and a safety buffer, labelled "System recommendation". Past dates show filled-in prepared, sold, remaining and wasted numbers; future dates start as drafts.
- **Staff & Shifts, My Day, Dashboard upcoming shifts:** every week (past and next 8 weeks) has shifts for both locations, with a few open shifts and swap requests, so calendars are never empty.
- **Waste, Reports, Dashboard charts:** sample sales and waste extended to cover the last 90 days and up to today at both locations, so every date range has numbers.
- **Inventory:** stock counts and recent purchase dates at Kalamaja too.

## Technical details
- New database function `ensure_production_plan(location, date)` (security definer, callable by signed-in users) that creates the plan + items from the rule-based logic (avg sales same weekday last 4 weeks, safety buffer 10%, minus recent overproduction waste) and returns its id. For past dates it fills actual/sold/remaining/wasted from sales records.
- Daily Plan, Production and Dashboard call it when the selected date/location has no plan, then reload.
- Seed migration: shifts for both locations from 4 weeks ago to 8 weeks ahead (generated relative to the current date), extra open shifts and swap requests, Kalamaja ingredients and inventory records, and sales/waste back-filled to today with no duplicates.
