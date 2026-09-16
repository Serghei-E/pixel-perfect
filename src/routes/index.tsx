import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  WhyTooltip,
} from "@/components/cafe-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDays,
  daysRemaining,
  eur,
  eur2,
  prettyDate,
  stockStatus,
  timeRange,
  today,
  useLocations,
} from "@/lib/cafe";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Café dashboard — CaféFlow" },
      {
        name: "description",
        content:
          "See today's expected and actual sales, waste cost, labour cost, stock alerts and staff coverage for your café at a glance.",
      },
      { property: "og:title", content: "Café dashboard — CaféFlow" },
      {
        property: "og:description",
        content: "Today's operating plan, waste and sales trends, shifts and low-stock alerts.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const [date, setDate] = useState(today());
  const [locationId, setLocationId] = useState("all");
  const { data: locations = [] } = useLocations();

  const from = addDays(date, -13);

  const dash = useQuery({
    queryKey: ["dashboard", date, locationId],
    queryFn: async () => {
      const loc = locationId === "all" ? null : locationId;
      const salesQ = supabase
        .from("sales_records")
        .select("sold_on, quantity, revenue, location_id, products(name, category, unit_cost)")
        .gte("sold_on", from)
        .lte("sold_on", date);
      const wasteQ = supabase
        .from("waste_records")
        .select("cost, quantity, occurred_at, location_id, products(name)")
        .gte("occurred_at", from);
      const planQ = supabase
        .from("production_plans")
        .select(
          "id, status, plan_date, location_id, production_items(expected_demand, recommended_qty, planned_qty, actual_qty, sold_qty, products(name, price))",
        )
        .eq("plan_date", date);
      const shiftsQ = supabase
        .from("shifts")
        .select("id, starts_at, ends_at, role, is_open, confirmed, location_id, profiles(full_name, hourly_cost)")
        .gte("starts_at", date + "T00:00:00")
        .lte("starts_at", date + "T23:59:59")
        .order("starts_at");
      const upcomingQ = supabase
        .from("shifts")
        .select("id, starts_at, ends_at, role, is_open, location_id, profiles(full_name)")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(6);

      const [sales, waste, plans, shifts, upcoming, ingredients, stockouts, recs] =
        await Promise.all([
          salesQ,
          wasteQ,
          planQ,
          shiftsQ,
          upcomingQ,
          supabase.from("ingredients").select("*").order("name"),
          supabase.from("stockout_reports").select("id").eq("resolved", false),
          supabase.from("recommendations").select("*").eq("rec_date", date).order("created_at"),
        ]);

      const err = [sales, waste, plans, shifts, upcoming, ingredients, stockouts, recs].find(
        (r) => r.error,
      );
      if (err?.error) throw err.error;

      const byLoc = <T extends { location_id?: string | null }>(rows: T[] | null) =>
        (rows ?? []).filter((r) => !loc || r.location_id === loc);

      return {
        sales: byLoc(sales.data as never[]),
        waste: byLoc(waste.data as never[]),
        plans: byLoc(plans.data as never[]),
        shifts: byLoc(shifts.data as never[]),
        upcoming: byLoc(upcoming.data as never[]),
        ingredients: (ingredients.data ?? []) as never[],
        stockouts: (stockouts.data ?? []).length,
        recommendations: (recs.data ?? []) as never[],
      };
    },
  });

  const metrics = useMemo(() => {
    if (!dash.data) return null;
    const d = dash.data as {
      sales: { sold_on: string; quantity: number; revenue: number }[];
      waste: { cost: number; occurred_at: string; products?: { name: string } | null }[];
      plans: {
        status: string;
        production_items: {
          expected_demand: number;
          products?: { name: string; price: number } | null;
        }[];
      }[];
      shifts: { starts_at: string; ends_at: string; profiles?: { hourly_cost: number } | null }[];
      ingredients: { name: string; current_stock: number; min_stock: number; unit: string; avg_daily_usage: number }[];
    };

    const actualToday = d.sales
      .filter((s) => s.sold_on === date)
      .reduce((sum, s) => sum + Number(s.revenue), 0);

    const estimatedToday = d.plans
      .flatMap((p) => p.production_items ?? [])
      .reduce((sum, i) => sum + i.expected_demand * Number(i.products?.price ?? 0), 0);

    const wasteToday = d.waste
      .filter((w) => w.occurred_at.slice(0, 10) === date)
      .reduce((sum, w) => sum + Number(w.cost), 0);

    const laborToday = d.shifts.reduce((sum, s) => {
      const hours =
        (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / (1000 * 60 * 60);
      return sum + hours * Number(s.profiles?.hourly_cost ?? 16);
    }, 0);

    const days: { day: string; label: string; sales: number; waste: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = addDays(date, -i);
      days.push({
        day,
        label: new Date(day + "T00:00:00").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        sales: Math.round(
          d.sales.filter((s) => s.sold_on === day).reduce((sum, s) => sum + Number(s.revenue), 0),
        ),
        waste:
          Math.round(
            d.waste
              .filter((w) => w.occurred_at.slice(0, 10) === day)
              .reduce((sum, w) => sum + Number(w.cost), 0) * 100,
          ) / 100,
      });
    }

    const morningCover = d.shifts.filter((s) => new Date(s.starts_at).getHours() <= 10).length;
    const coverage =
      morningCover === 0
        ? "Understaffed"
        : morningCover < 3
          ? "Understaffed"
          : morningCover > 4
            ? "Overstaffed"
            : "Balanced";

    const lowStock = d.ingredients
      .map((i) => ({ ...i, status: stockStatus(Number(i.current_stock), Number(i.min_stock)) }))
      .filter((i) => i.status !== "In stock");

    return {
      actualToday,
      estimatedToday,
      wasteToday,
      laborToday,
      days,
      coverage,
      morningCover,
      lowStock,
      planStatus: d.plans[0]?.status ?? "draft",
    };
  }, [dash.data, date]);

  const recommendations = (dash.data?.recommendations ?? []) as {
    id: string;
    title: string;
    detail: string | null;
    reason: string | null;
    status: string;
    category: string;
  }[];

  const upcoming = (dash.data?.upcoming ?? []) as {
    id: string;
    starts_at: string;
    ends_at: string;
    role: string;
    is_open: boolean;
    profiles?: { full_name: string } | null;
  }[];

  return (
    <>
      <PageHeader
        title="Today at a glance"
        description="Everything you need before the doors open — expected demand, cost of waste, cover and stock."
      >
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || today())}
          className="w-[160px]"
          aria-label="Select date"
        />
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-[170px]" aria-label="Select location">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l: { id: string; name: string }) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {dash.isError ? <ErrorState message={(dash.error as Error)?.message} /> : null}
      {dash.isLoading ? <LoadingBlock rows={5} /> : null}

      {metrics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Estimated sales today"
              value={eur(metrics.estimatedToday)}
              hint="From the recommended plan"
            />
            <StatCard
              label="Actual sales today"
              value={eur(metrics.actualToday)}
              hint={
                metrics.estimatedToday
                  ? `${Math.round((metrics.actualToday / metrics.estimatedToday) * 100)}% of estimate`
                  : undefined
              }
            />
            <StatCard
              label="Food waste cost"
              value={eur2(metrics.wasteToday)}
              tone={metrics.wasteToday > 25 ? "terracotta" : "sage"}
              hint="Recorded so far today"
            />
            <StatCard label="Labour cost today" value={eur(metrics.laborToday)} hint="Scheduled shifts" />
            <StatCard
              label="Stockouts"
              value={String(dash.data?.stockouts ?? 0)}
              tone={(dash.data?.stockouts ?? 0) > 0 ? "warning" : "sage"}
              hint="Open reports"
            />
            <div className="card-surface flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Staff coverage
                </p>
                <p className="mt-2 font-display text-2xl">{metrics.coverage}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics.morningCover} people on the morning peak
                </p>
              </div>
              <StatusBadge status={metrics.coverage} />
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Today's operating plan</h2>
                <p className="text-sm text-muted-foreground">
                  Suggestions based on your recent sales — review and adjust before you start.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={metrics.planStatus === "approved" ? "Approved" : "Draft"} />
                <Button asChild size="sm">
                  <Link to="/daily-plan">
                    Review plan <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {recommendations.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No suggestions for this date yet"
                  description="Pick a date with sales history, or open the Daily Plan to generate quantities."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {recommendations.map((rec) => (
                  <li
                    key={rec.id}
                    className="rounded-xl border border-border bg-background/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{rec.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs capitalize text-muted-foreground">
                          {rec.category}
                        </span>
                        <WhyTooltip reason={rec.reason} />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {rec.status === "system" ? "System recommendation" : "Manager override"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-surface p-5">
              <h2 className="font-display text-lg">Sales trend</h2>
              <p className="text-sm text-muted-foreground">Revenue over the last 14 days</p>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <ReTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v) => eur(Number(v))}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="var(--chart-3)"
                      fill="var(--chart-3)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-surface p-5">
              <h2 className="font-display text-lg">Waste trend</h2>
              <p className="text-sm text-muted-foreground">Cost of recorded waste per day</p>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <ReTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v) => eur2(Number(v))}
                    />
                    <Line
                      type="monotone"
                      dataKey="waste"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-surface p-5">
              <h2 className="font-display text-lg">Upcoming shifts</h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No shifts scheduled yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {upcoming.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium">
                          {s.is_open ? "Open shift" : (s.profiles?.full_name ?? "Unassigned")}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {s.role.replace("_", " ")} · {prettyDate(s.starts_at.slice(0, 10))}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {timeRange(s.starts_at, s.ends_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card-surface p-5">
              <h2 className="font-display text-lg">Low stock alerts</h2>
              {metrics.lowStock.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Everything is above minimum.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {metrics.lowStock.map((i) => (
                    <li key={i.name} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          {i.status === "Out of stock" ? (
                            <AlertTriangle className="size-3.5 text-destructive" />
                          ) : null}
                          {i.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Number(i.current_stock)} {i.unit} left · minimum {Number(i.min_stock)}{" "}
                          {i.unit}
                          {daysRemaining(Number(i.current_stock), Number(i.avg_daily_usage)) !== null
                            ? ` · ~${daysRemaining(Number(i.current_stock), Number(i.avg_daily_usage))} days`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/inventory">Open inventory</Link>
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
