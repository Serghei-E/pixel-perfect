import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
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
  eur,
  prettyDate,
  stockStatus,
  suggestedOrder,
  timeRange,
  today,
  useLocations,
} from "@/lib/cafe";

export const Route = createFileRoute("/daily-plan")({
  head: () => ({
    meta: [
      { title: "Daily plan — CaféFlow" },
      {
        name: "description",
        content:
          "Review recommended production, staffing and ordering for a chosen day, adjust the numbers and approve the plan.",
      },
      { property: "og:title", content: "Daily plan — CaféFlow" },
      {
        property: "og:description",
        content: "Recommended quantities with expected demand, safety buffer and the reason behind each.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <DailyPlan />
    </AppShell>
  ),
});

type PlanItem = {
  id: string;
  expected_demand: number;
  safety_buffer: number;
  recommended_qty: number;
  planned_qty: number;
  status: string;
  source: string;
  reason: string | null;
  products: { name: string; category: string; price: number } | null;
};

function DailyPlan() {
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [locationId, setLocationId] = useState("");
  const { data: locations = [] } = useLocations();

  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0]!.id as string);
  }, [locations, locationId]);

  const plan = useQuery({
    queryKey: ["plan", date, locationId],
    enabled: Boolean(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_plans")
        .select(
          "id, status, plan_date, approved_at, production_items(id, expected_demand, safety_buffer, recommended_qty, planned_qty, status, source, reason, products(name, category, price))",
        )
        .eq("plan_date", date)
        .eq("location_id", locationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const extras = useQuery({
    queryKey: ["plan-extras", date, locationId],
    enabled: Boolean(locationId),
    queryFn: async () => {
      const [shifts, ingredients, stockouts, recs] = await Promise.all([
        supabase
          .from("shifts")
          .select("id, starts_at, ends_at, role, is_open, profiles(full_name)")
          .eq("location_id", locationId)
          .gte("starts_at", date + "T00:00:00")
          .lte("starts_at", date + "T23:59:59")
          .order("starts_at"),
        supabase.from("ingredients").select("*").eq("location_id", locationId).order("name"),
        supabase.from("stockout_reports").select("id, note, resolved").eq("resolved", false),
        supabase
          .from("recommendations")
          .select("*")
          .eq("rec_date", date)
          .eq("location_id", locationId),
      ]);
      const err = [shifts, ingredients, stockouts, recs].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        shifts: (shifts.data ?? []) as {
          id: string;
          starts_at: string;
          ends_at: string;
          role: string;
          is_open: boolean;
          profiles?: { full_name: string } | null;
        }[],
        ingredients: (ingredients.data ?? []) as {
          id: string;
          name: string;
          unit: string;
          current_stock: number;
          min_stock: number;
          avg_daily_usage: number;
        }[],
        stockouts: (stockouts.data ?? []) as { id: string; note: string | null }[],
        recommendations: (recs.data ?? []) as {
          id: string;
          category: string;
          title: string;
          reason: string | null;
        }[],
      };
    },
  });

  const saveItem = useMutation({
    mutationFn: async ({ id, qty, source }: { id: string; qty: number; source: string }) => {
      const { error } = await supabase
        .from("production_items")
        .update({ planned_qty: qty, source, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approvePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("production_plans")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan approved. The team can see it on Production.");
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = ((plan.data?.production_items ?? []) as PlanItem[]).slice().sort((a, b) =>
    (a.products?.name ?? "").localeCompare(b.products?.name ?? ""),
  );
  const lowStock = (extras.data?.ingredients ?? [])
    .map((i) => ({ ...i, status: stockStatus(Number(i.current_stock), Number(i.min_stock)) }))
    .filter((i) => i.status !== "In stock");
  const expectedRevenue = items.reduce(
    (sum, i) => sum + i.expected_demand * Number(i.products?.price ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Daily plan"
        description="Every number below is a suggestion from your recent sales. Change anything that doesn't match what you know about today."
      >
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || today())}
          className="w-[160px]"
          aria-label="Plan date"
        />
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-[170px]" aria-label="Location">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l: { id: string; name: string }) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {plan.isError ? <ErrorState message={(plan.error as Error)?.message} /> : null}
      {plan.isLoading ? <LoadingBlock rows={6} /> : null}

      {!plan.isLoading && !plan.data ? (
        <EmptyState
          title={`No plan for ${prettyDate(date)} yet`}
          description="Choose another date — demo plans exist for yesterday, today and tomorrow at Old Town."
        />
      ) : null}

      {plan.data ? (
        <>
          <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Plan for {prettyDate(date)}</p>
              <p className="font-display text-xl">
                Expected takings {eur(expectedRevenue)} · {items.length} products
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={plan.data.status === "approved" ? "Approved" : "Draft"} />
              <Button
                disabled={plan.data.status === "approved" || approvePlan.isPending}
                onClick={() => approvePlan.mutate(plan.data!.id as string)}
              >
                <CheckCircle2 className="size-4" />
                {plan.data.status === "approved" ? "Plan approved" : "Mark plan as approved"}
              </Button>
            </div>
          </div>

          <section className="card-surface p-5">
            <h2 className="font-display text-lg">1. Expected demand</h2>
            <p className="text-sm text-muted-foreground">
              What we think the café will sell, based on the same weekday over the last four weeks.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium">{item.products?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.expected_demand} expected · {eur(item.expected_demand * Number(item.products?.price ?? 0))}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="font-display text-lg">2. Recommended production</h2>
            <p className="text-sm text-muted-foreground">
              Recommended amount = expected sales + safety buffer. Adjust and approve each line.
            </p>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  onSave={(qty, source) => saveItem.mutate({ id: item.id, qty, source })}
                />
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="font-display text-lg">3. Recommended staffing</h2>
            <div className="mt-3 space-y-2">
              {(extras.data?.recommendations ?? [])
                .filter((r) => r.category === "staffing")
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-sage/40 bg-sage-soft/40 p-4"
                  >
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-sm text-muted-foreground">{r.reason}</p>
                    </div>
                    <WhyTooltip reason={r.reason} />
                  </div>
                ))}
              {(extras.data?.shifts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No shifts scheduled for this day yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(extras.data?.shifts ?? []).map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        {s.is_open ? "Open shift" : (s.profiles?.full_name ?? "Unassigned")}{" "}
                        <span className="capitalize text-muted-foreground">
                          · {s.role.replace("_", " ")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeRange(s.starts_at, s.ends_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="font-display text-lg">4. Inventory requirements</h2>
            {lowStock.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing needs ordering for this plan.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {lowStock.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Order about{" "}
                        {suggestedOrder(
                          Number(i.current_stock),
                          Number(i.min_stock),
                          Number(i.avg_daily_usage),
                        )}{" "}
                        {i.unit} — stock is {Number(i.current_stock)} {i.unit} against a{" "}
                        {Number(i.min_stock)} {i.unit} minimum.
                      </p>
                    </div>
                    <StatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="font-display text-lg">5. Important warnings</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lowStock
                .filter((i) => i.status === "Out of stock" || i.status === "Critical")
                .map((i) => (
                  <li
                    key={i.id}
                    className="flex items-start gap-2 rounded-xl border border-terracotta/40 bg-terracotta-soft/40 p-3"
                  >
                    <AlertTriangle className="mt-0.5 size-4 text-terracotta" />
                    <span>
                      {i.name} is {i.status.toLowerCase()} — products using it may sell out today.
                    </span>
                  </li>
                ))}
              {(extras.data?.stockouts ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3"
                >
                  <AlertTriangle className="mt-0.5 size-4" />
                  <span>{s.note ?? "An item was reported unavailable."}</span>
                </li>
              ))}
              {lowStock.length === 0 && (extras.data?.stockouts ?? []).length === 0 ? (
                <li className="text-muted-foreground">No warnings for this day.</li>
              ) : null}
            </ul>
          </section>

          <section className="card-surface p-5">
            <h2 className="font-display text-lg">6. Manager approval</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approving locks today's numbers in for the team. You can still edit afterwards.
            </p>
            <Button
              className="mt-4"
              disabled={plan.data.status === "approved" || approvePlan.isPending}
              onClick={() => approvePlan.mutate(plan.data!.id as string)}
            >
              <CheckCircle2 className="size-4" /> Mark plan as approved
            </Button>
          </section>
        </>
      ) : null}
    </>
  );
}

function PlanRow({
  item,
  onSave,
}: {
  item: PlanItem;
  onSave: (qty: number, source: string) => void;
}) {
  const [value, setValue] = useState(String(item.planned_qty));
  const changed = Number(value) !== item.planned_qty;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[180px]">
          <p className="font-medium">{item.products?.name}</p>
          <p className="text-xs text-muted-foreground">{item.products?.category}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            Recommended <strong className="text-foreground">{item.recommended_qty}</strong>
          </span>
          <span>
            Expected sales <strong className="text-foreground">{item.expected_demand}</strong>
          </span>
          <span>
            Safety buffer <strong className="text-foreground">{item.safety_buffer}</strong>
          </span>
          <StatusBadge
            status={
              item.source === "approved"
                ? "Approved"
                : item.source === "override"
                  ? "In progress"
                  : "Draft"
            }
          />
          <WhyTooltip reason={item.reason} />
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20"
            aria-label={`Quantity for ${item.products?.name}`}
          />
          {changed ? (
            <>
              <Button size="sm" onClick={() => onSave(Number(value), "override")}>
                Override
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setValue(String(item.planned_qty))}
                aria-label="Undo change"
              >
                <RotateCcw className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSave(item.recommended_qty, "approved")}
            >
              <Check className="size-4" /> Approve
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {item.source === "override" ? "Manager override" : item.source === "approved" ? "Approved plan" : "System recommendation"}
        {item.reason ? ` — ${item.reason}` : ""}
      </p>
    </div>
  );
}
