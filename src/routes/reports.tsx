import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ErrorState, LoadingBlock, PageHeader, StatCard } from "@/components/cafe-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_CATEGORIES,
  STAFF_ROLES,
  addDays,
  downloadCsv,
  eur,
  eur2,
  today,
  useLocations,
} from "@/lib/cafe";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — CaféFlow" },
      {
        name: "description",
        content:
          "Compare sales, waste cost, food cost, labour cost and production accuracy across any date range, and export the numbers.",
      },
      { property: "og:title", content: "Reports — CaféFlow" },
      {
        property: "og:description",
        content: "This month against last month, with waste percentage and estimated savings.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Reports />
    </AppShell>
  ),
});

function Reports() {
  const { data: locations = [] } = useLocations();
  const [locationId, setLocationId] = useState("all");
  const [category, setCategory] = useState("all");
  const [staffRole, setStaffRole] = useState("all");
  const [from, setFrom] = useState(addDays(today(), -29));
  const [to, setTo] = useState(today());

  const spanDays = Math.max(
    1,
    Math.round(
      (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) /
        86400000,
    ) + 1,
  );
  const prevFrom = addDays(from, -spanDays);
  const prevTo = addDays(from, -1);

  const report = useQuery({
    queryKey: ["reports", from, to, locationId, category, staffRole],
    queryFn: async () => {
      const [sales, waste, shifts, stockouts, items] = await Promise.all([
        supabase
          .from("sales_records")
          .select("sold_on, quantity, revenue, location_id, products(name, category, unit_cost)")
          .gte("sold_on", prevFrom)
          .lte("sold_on", to),
        supabase
          .from("waste_records")
          .select("cost, occurred_at, location_id, products(category)")
          .gte("occurred_at", prevFrom + "T00:00:00"),
        supabase
          .from("shifts")
          .select("starts_at, ends_at, role, location_id, profiles(hourly_cost)")
          .gte("starts_at", prevFrom + "T00:00:00")
          .lte("starts_at", to + "T23:59:59"),
        supabase
          .from("stockout_reports")
          .select("reported_at, location_id")
          .gte("reported_at", prevFrom + "T00:00:00"),
        supabase
          .from("production_items")
          .select(
            "planned_qty, actual_qty, sold_qty, products(category), production_plans(plan_date, location_id)",
          ),
      ]);
      const err = [sales, waste, shifts, stockouts, items].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        sales: (sales.data ?? []) as {
          sold_on: string;
          quantity: number;
          revenue: number;
          location_id: string;
          products: { name: string; category: string; unit_cost: number } | null;
        }[],
        waste: (waste.data ?? []) as {
          cost: number;
          occurred_at: string;
          location_id: string;
          products: { category: string } | null;
        }[],
        shifts: (shifts.data ?? []) as {
          starts_at: string;
          ends_at: string;
          role: string;
          location_id: string;
          profiles: { hourly_cost: number } | null;
        }[],
        stockouts: (stockouts.data ?? []) as { reported_at: string; location_id: string }[],
        items: (items.data ?? []) as {
          planned_qty: number;
          actual_qty: number;
          sold_qty: number;
          products: { category: string } | null;
          production_plans: { plan_date: string; location_id: string } | null;
        }[],
      };
    },
  });

  const metrics = useMemo(() => {
    const d = report.data;
    if (!d) return null;
    const inLoc = (loc: string) => locationId === "all" || loc === locationId;
    const inCat = (cat?: string | null) => category === "all" || cat === category;
    const inRole = (role: string) => staffRole === "all" || role === staffRole;

    const window_ = (start: string, end: string) => {
      const sales = d.sales.filter(
        (s) => s.sold_on >= start && s.sold_on <= end && inLoc(s.location_id) && inCat(s.products?.category),
      );
      const waste = d.waste.filter((w) => {
        const day = w.occurred_at.slice(0, 10);
        return day >= start && day <= end && inLoc(w.location_id) && inCat(w.products?.category);
      });
      const shifts = d.shifts.filter((s) => {
        const day = s.starts_at.slice(0, 10);
        return day >= start && day <= end && inLoc(s.location_id) && inRole(s.role);
      });
      const stockouts = d.stockouts.filter((s) => {
        const day = s.reported_at.slice(0, 10);
        return day >= start && day <= end && inLoc(s.location_id);
      });
      const items = d.items.filter((i) => {
        const day = i.production_plans?.plan_date ?? "";
        return (
          day >= start &&
          day <= end &&
          inLoc(i.production_plans?.location_id ?? "") &&
          inCat(i.products?.category)
        );
      });

      const revenue = sales.reduce((s, r) => s + Number(r.revenue), 0);
      const foodCost = sales.reduce(
        (s, r) => s + Number(r.quantity) * Number(r.products?.unit_cost ?? 0),
        0,
      );
      const wasteCost = waste.reduce((s, r) => s + Number(r.cost), 0);
      const labour = shifts.reduce((s, r) => {
        const hours =
          (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 3600000;
        return s + hours * Number(r.profiles?.hourly_cost ?? 16);
      }, 0);
      const planned = items.reduce((s, i) => s + Number(i.actual_qty || i.planned_qty), 0);
      const sold = items.reduce((s, i) => s + Number(i.sold_qty), 0);
      const accuracy = planned ? Math.min(100, Math.round((sold / planned) * 100)) : 0;

      return {
        revenue,
        foodCost,
        wasteCost,
        labour,
        stockouts: stockouts.length,
        accuracy,
        wastePct: revenue ? (wasteCost / revenue) * 100 : 0,
      };
    };

    const current = window_(from, to);
    const previous = window_(prevFrom, prevTo);
    const savings = Math.max(0, previous.wasteCost - current.wasteCost);
    return { current, previous, savings };
  }, [report.data, from, to, prevFrom, prevTo, locationId, category, staffRole]);

  const change = (now: number, before: number) =>
    before === 0 ? null : Math.round(((now - before) / before) * 100);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Plain numbers for the period you choose, next to the period before it."
      >
        <Button
          variant="outline"
          disabled={!metrics}
          onClick={() =>
            metrics
              ? downloadCsv("cafeflow-report.csv", [
                  {
                    From: from,
                    To: to,
                    Sales: metrics.current.revenue.toFixed(2),
                    "Waste cost": metrics.current.wasteCost.toFixed(2),
                    "Food cost": metrics.current.foodCost.toFixed(2),
                    "Labour cost": metrics.current.labour.toFixed(2),
                    Stockouts: metrics.current.stockouts,
                    "Production accuracy %": metrics.current.accuracy,
                    "Waste %": metrics.current.wastePct.toFixed(1),
                  },
                ])
              : undefined
          }
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="card-surface grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="r-from">From</Label>
          <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-to">To</Label>
          <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
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
        </div>
        <div className="space-y-2">
          <Label>Product category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Staff role</Label>
          <Select value={staffRole} onValueChange={setStaffRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {STAFF_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {report.isError ? <ErrorState message={(report.error as Error)?.message} /> : null}
      {report.isLoading ? <LoadingBlock rows={5} /> : null}

      {metrics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sales"
              value={eur(metrics.current.revenue)}
              {...(change(metrics.current.revenue, metrics.previous.revenue) !== null
                ? { trend: change(metrics.current.revenue, metrics.previous.revenue) as number }
                : {})}
            />
            <StatCard
              label="Waste cost"
              value={eur2(metrics.current.wasteCost)}
              tone="terracotta"
              {...(change(metrics.current.wasteCost, metrics.previous.wasteCost) !== null
                ? { trend: change(metrics.current.wasteCost, metrics.previous.wasteCost) as number }
                : {})}
            />
            <StatCard label="Estimated food cost" value={eur(metrics.current.foodCost)} />
            <StatCard label="Labour cost" value={eur(metrics.current.labour)} />
            <StatCard
              label="Stockout incidents"
              value={String(metrics.current.stockouts)}
              tone={metrics.current.stockouts ? "warning" : "sage"}
            />
            <StatCard
              label="Production accuracy"
              value={`${metrics.current.accuracy}%`}
              hint="Sold against prepared"
            />
            <StatCard
              label="Waste percentage"
              value={`${metrics.current.wastePct.toFixed(1)}%`}
              hint="Of sales revenue"
            />
            <StatCard
              label="Estimated savings"
              value={eur2(metrics.savings)}
              tone="sage"
              hint="Less waste than the previous period"
            />
          </div>

          <div className="card-surface overflow-hidden">
            <h2 className="border-b border-border p-4 font-display text-lg">
              This period compared with the one before
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Measure</th>
                    <th className="p-3">
                      {from} → {to}
                    </th>
                    <th className="p-3">
                      {prevFrom} → {prevTo}
                    </th>
                    <th className="p-3">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Sales", metrics.current.revenue, metrics.previous.revenue, true],
                    ["Waste cost", metrics.current.wasteCost, metrics.previous.wasteCost, true],
                    ["Food cost", metrics.current.foodCost, metrics.previous.foodCost, true],
                    ["Labour cost", metrics.current.labour, metrics.previous.labour, true],
                    ["Stockouts", metrics.current.stockouts, metrics.previous.stockouts, false],
                    [
                      "Production accuracy %",
                      metrics.current.accuracy,
                      metrics.previous.accuracy,
                      false,
                    ],
                  ].map(([label, now, before, money]) => {
                    const pct = change(Number(now), Number(before));
                    return (
                      <tr key={String(label)}>
                        <td className="p-3 font-medium">{String(label)}</td>
                        <td className="p-3">{money ? eur2(Number(now)) : String(now)}</td>
                        <td className="p-3 text-muted-foreground">
                          {money ? eur2(Number(before)) : String(before)}
                        </td>
                        <td className="p-3">{pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Figures come from your recorded sales, waste, shifts and production. They are estimates to
            help you decide, not accounting numbers.
          </p>
        </>
      ) : null}
    </>
  );
}
