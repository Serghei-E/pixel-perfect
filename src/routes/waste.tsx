import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlock, PageHeader, StatCard } from "@/components/cafe-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  WASTE_REASONS,
  addDays,
  eur2,
  prettyDate,
  today,
  useBusiness,
  useLocations,
  useProducts,
} from "@/lib/cafe";

export const Route = createFileRoute("/waste")({
  head: () => ({
    meta: [
      { title: "Waste tracking — CaféFlow" },
      {
        name: "description",
        content:
          "Record café food waste in seconds and see what it costs by product, category, reason and day.",
      },
      { property: "og:title", content: "Waste tracking — CaféFlow" },
      {
        property: "og:description",
        content: "Waste cost totals, highest-waste products and reasons behind the bin.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Waste />
    </AppShell>
  ),
});

type Record_ = {
  id: string;
  quantity: number;
  cost: number;
  reason: string;
  note: string | null;
  occurred_at: string;
  products: { name: string; category: string } | null;
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
];

function Waste() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: business } = useBusiness();
  const { data: locations = [] } = useLocations();
  const { data: products = [] } = useProducts();
  const [locationId, setLocationId] = useState("");
  const [days, setDays] = useState("30");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0]!.id as string);
  }, [locations, locationId]);

  const from = addDays(today(), -(Number(days) - 1));

  const list = useQuery({
    queryKey: ["waste", locationId, days],
    enabled: Boolean(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_records")
        .select("id, quantity, cost, reason, note, occurred_at, products(name, category)")
        .eq("location_id", locationId)
        .gte("occurred_at", from + "T00:00:00")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Record_[];
    },
  });

  const add = useMutation({
    mutationFn: async (p: {
      productId: string;
      quantity: number;
      reason: string;
      note: string;
      date: string;
    }) => {
      if (!business) throw new Error("No café found.");
      const product = (products as { id: string; unit_cost: number }[]).find(
        (x) => x.id === p.productId,
      );
      const { error } = await supabase.from("waste_records").insert({
        business_id: business.id as string,
        location_id: locationId,
        product_id: p.productId,
        quantity: p.quantity,
        cost: p.quantity * Number(product?.unit_cost ?? 0),
        reason: p.reason,
        note: p.note || null,
        occurred_at: new Date(`${p.date}T12:00:00`).toISOString(),
        recorded_by: (profile?.id ?? null) as string | null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Waste recorded.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["waste"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const rows = list.data ?? [];
    const total = rows.reduce((s, r) => s + Number(r.cost), 0);
    const group = (key: (r: Record_) => string) => {
      const map = new Map<string, number>();
      rows.forEach((r) => map.set(key(r), (map.get(key(r)) ?? 0) + Number(r.cost)));
      return [...map.entries()]
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);
    };
    const trend: { label: string; cost: number }[] = [];
    for (let i = Number(days) - 1; i >= 0; i--) {
      const day = addDays(today(), -i);
      trend.push({
        label: new Date(day + "T00:00:00").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        cost:
          Math.round(
            rows
              .filter((r) => r.occurred_at.slice(0, 10) === day)
              .reduce((s, r) => s + Number(r.cost), 0) * 100,
          ) / 100,
      });
    }
    return {
      total,
      perDay: total / Number(days),
      byProduct: group((r) => r.products?.name ?? "Unknown").slice(0, 8),
      byCategory: group((r) => r.products?.category ?? "Other"),
      byReason: group((r) => r.reason),
      trend,
      rows,
    };
  }, [list.data, days]);

  return (
    <>
      <PageHeader
        title="Waste tracking"
        description="Recording waste is not about blame — it is the fastest way to prepare better amounts tomorrow."
      >
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
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Record waste
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total waste cost" value={eur2(stats.total)} tone="terracotta" />
        <StatCard label="Average per day" value={eur2(stats.perDay)} />
        <StatCard label="Entries recorded" value={String(stats.rows.length)} />
      </div>

      {list.isError ? <ErrorState message={(list.error as Error)?.message} /> : null}
      {list.isLoading ? <LoadingBlock rows={5} /> : null}

      {!list.isLoading && stats.rows.length === 0 ? (
        <EmptyState
          title="No waste recorded for this period"
          description="That is either very good news or a gap in the records."
        />
      ) : null}

      {stats.rows.length ? (
        <>
          <div className="card-surface p-5">
            <h2 className="font-display text-lg">Daily waste cost</h2>
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.ceil(Number(days) / 8)} />
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
                  <Line type="monotone" dataKey="cost" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card-surface p-5 lg:col-span-2">
              <h2 className="font-display text-lg">Highest-waste products</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byProduct} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <ReTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v) => eur2(Number(v))}
                    />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-surface p-5">
              <h2 className="font-display text-lg">By reason</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.byReason} dataKey="value" nameKey="name" outerRadius={80}>
                      {stats.byReason.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v) => eur2(Number(v))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card-surface p-5">
            <h2 className="font-display text-lg">Waste by category</h2>
            <ul className="mt-3 space-y-2">
              {stats.byCategory.map((c) => (
                <li key={c.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {eur2(c.value)} · {stats.total ? Math.round((c.value / stats.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-terracotta"
                      style={{
                        width: `${stats.total ? (c.value / stats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-surface overflow-hidden">
            <h2 className="border-b border-border p-4 font-display text-lg">Recent entries</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Cost</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.rows.slice(0, 25).map((r) => (
                    <tr key={r.id}>
                      <td className="p-3">{prettyDate(r.occurred_at.slice(0, 10))}</td>
                      <td className="p-3 font-medium">{r.products?.name ?? "—"}</td>
                      <td className="p-3">{Number(r.quantity)}</td>
                      <td className="p-3">{eur2(Number(r.cost))}</td>
                      <td className="p-3 text-muted-foreground">{r.reason}</td>
                      <td className="p-3 text-muted-foreground">{r.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record waste</DialogTitle>
            <DialogDescription>Cost is worked out from the product's ingredient cost.</DialogDescription>
          </DialogHeader>
          <WasteForm
            products={products as { id: string; name: string }[]}
            onSubmit={(p) => add.mutate(p)}
            pending={add.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function WasteForm({
  products,
  onSubmit,
  pending,
}: {
  products: { id: string; name: string }[];
  onSubmit: (p: {
    productId: string;
    quantity: number;
    reason: string;
    note: string;
    date: string;
  }) => void;
  pending: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(WASTE_REASONS[1] ?? "Overproduction");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (!productId && products.length) setProductId(products[0]!.id);
  }, [products, productId]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Product</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-qty">Quantity</Label>
          <Input
            id="w-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-date">Date</Label>
          <Input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WASTE_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="w-note">Note (optional)</Label>
          <Textarea id="w-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !productId}
          onClick={() =>
            onSubmit({
              productId,
              quantity: Math.max(1, Number(quantity) || 1),
              reason,
              note,
              date: date || today(),
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
