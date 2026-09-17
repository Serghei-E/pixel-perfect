import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/cafe-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  daysRemaining,
  downloadCsv,
  eur2,
  stockStatus,
  suggestedOrder,
  toCsv,
  useBusiness,
  useLocations,
  useSuppliers,
} from "@/lib/cafe";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — CaféFlow" },
      {
        name: "description",
        content:
          "Track café ingredient stock levels, days remaining, suppliers and suggested order quantities, and export an order list.",
      },
      { property: "og:title", content: "Inventory — CaféFlow" },
      {
        property: "og:description",
        content: "Stock levels, low-stock status, suppliers and simulated ordering for your café.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Inventory />
    </AppShell>
  ),
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  avg_daily_usage: number;
  unit_cost: number;
  last_purchase: string | null;
  supplier_id: string | null;
  suppliers: { name: string } | null;
};

function Inventory() {
  const qc = useQueryClient();
  const { data: business } = useBusiness();
  const { data: locations = [] } = useLocations();
  const { data: suppliers = [] } = useSuppliers();
  const [locationId, setLocationId] = useState("");
  const [countFor, setCountFor] = useState<Ingredient | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0]!.id as string);
  }, [locations, locationId]);

  const list = useQuery({
    queryKey: ["ingredients", locationId],
    enabled: Boolean(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*, suppliers(name)")
        .eq("location_id", locationId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Ingredient[];
    },
  });

  const rows = useMemo(
    () =>
      (list.data ?? []).map((i) => ({
        ...i,
        status: stockStatus(Number(i.current_stock), Number(i.min_stock)),
        days: daysRemaining(Number(i.current_stock), Number(i.avg_daily_usage)),
        order: suggestedOrder(
          Number(i.current_stock),
          Number(i.min_stock),
          Number(i.avg_daily_usage),
        ),
      })),
    [list.data],
  );

  const orderRows = rows.filter((r) => r.status !== "In stock" && r.order > 0);
  const orderValue = orderRows.reduce((sum, r) => sum + r.order * Number(r.unit_cost), 0);

  const saveIngredient = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (payload.id) {
        const { id, ...patch } = payload;
        const { error } = await supabase.from("ingredients").update(patch).eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ingredients")
          .insert({ ...payload, business_id: business?.id, location_id: locationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Inventory saved.");
      setAddOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordCount = useMutation({
    mutationFn: async ({ ingredient, counted }: { ingredient: Ingredient; counted: number }) => {
      const { error } = await supabase
        .from("inventory_records")
        .insert({ ingredient_id: ingredient.id, counted_stock: counted });
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("ingredients")
        .update({ current_stock: counted })
        .eq("id", ingredient.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Stock count recorded.");
      setCountFor(null);
      void qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSupplier = useMutation({
    mutationFn: async (payload: { name: string; contact_email: string; lead_time_days: number }) => {
      const { error } = await supabase
        .from("suppliers")
        .insert({ ...payload, business_id: business?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier added.");
      setSupplierOpen(false);
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPlaced = useMutation({
    mutationFn: async () => {
      const stamp = new Date().toISOString().slice(0, 10);
      for (const r of orderRows) {
        await supabase.from("ingredients").update({ last_purchase: stamp }).eq("id", r.id);
        await supabase.from("inventory_records").insert({
          ingredient_id: r.id,
          counted_stock: Number(r.current_stock),
          order_status: "placed",
          note: `Order of ${r.order} ${r.unit} marked as placed`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Order marked as placed (demo only — no supplier was contacted).");
      setOrderOpen(false);
      void qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock levels with a plain estimate of how many days each ingredient will last."
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
        <Button variant="outline" onClick={() => setSupplierOpen(true)}>
          Add supplier
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add ingredient
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Items tracked" value={String(rows.length)} />
        <StatCard
          label="Need attention"
          value={String(orderRows.length)}
          tone={orderRows.length ? "terracotta" : "sage"}
        />
        <StatCard label="Suggested order value" value={eur2(orderValue)} />
      </div>

      {list.isError ? <ErrorState message={(list.error as Error)?.message} /> : null}
      {list.isLoading ? <LoadingBlock rows={6} /> : null}
      {!list.isLoading && rows.length === 0 ? (
        <EmptyState title="No ingredients yet" description="Add your first ingredient to start tracking stock." />
      ) : null}

      {rows.length ? (
        <div className="card-surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <h2 className="font-display text-lg">Ingredients</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOrderOpen(true)}>
                <ClipboardList className="size-4" /> Suggested order
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  downloadCsv(
                    "inventory.csv",
                    toCsv(
                      rows.map((r) => ({
                        Ingredient: r.name,
                        Stock: Number(r.current_stock),
                        Unit: r.unit,
                        Minimum: Number(r.min_stock),
                        "Days left": r.days ?? "",
                        Supplier: r.suppliers?.name ?? "",
                        Status: r.status,
                      })),
                    ),
                  )
                }
              >
                <Download className="size-4" /> Export
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Ingredient</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Minimum</th>
                  <th className="p-3">Days left</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Last purchase</th>
                  <th className="p-3">Suggested order</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">
                      {Number(r.current_stock)} {r.unit}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {Number(r.min_stock)} {r.unit}
                    </td>
                    <td className="p-3 text-muted-foreground">{r.days ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.suppliers?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.last_purchase ?? "—"}</td>
                    <td className="p-3">
                      {r.order ? `${r.order} ${r.unit}` : "—"}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setCountFor(r)}>
                          Count
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Add / edit ingredient */}
      <IngredientDialog
        open={addOpen || Boolean(editing)}
        ingredient={editing}
        suppliers={suppliers as { id: string; name: string }[]}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSave={(payload) => saveIngredient.mutate(payload)}
        pending={saveIngredient.isPending}
      />

      {/* Stock count */}
      <Dialog open={Boolean(countFor)} onOpenChange={(o) => (!o ? setCountFor(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record stock count</DialogTitle>
            <DialogDescription>
              {countFor?.name} — enter what you actually counted in {countFor?.unit}.
            </DialogDescription>
          </DialogHeader>
          <CountForm
            defaultValue={Number(countFor?.current_stock ?? 0)}
            onSubmit={(counted) =>
              countFor ? recordCount.mutate({ ingredient: countFor, counted }) : undefined
            }
            pending={recordCount.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Supplier */}
      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>Used for suggested orders. No live ordering yet.</DialogDescription>
          </DialogHeader>
          <SupplierForm onSubmit={(p) => addSupplier.mutate(p)} pending={addSupplier.isPending} />
        </DialogContent>
      </Dialog>

      {/* Suggested order */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested order</DialogTitle>
            <DialogDescription>
              Based on your minimum levels and average daily use. Nothing is sent to suppliers.
            </DialogDescription>
          </DialogHeader>
          {orderRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs ordering right now.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
              {orderRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span>
                    {r.name}
                    <span className="block text-xs text-muted-foreground">
                      {r.suppliers?.name ?? "No supplier set"}
                    </span>
                  </span>
                  <span className="text-right">
                    {r.order} {r.unit}
                    <span className="block text-xs text-muted-foreground">
                      {eur2(r.order * Number(r.unit_cost))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "suggested-order.csv",
                  toCsv(
                    orderRows.map((r) => ({
                      Ingredient: r.name,
                      Quantity: r.order,
                      Unit: r.unit,
                      Supplier: r.suppliers?.name ?? "",
                      "Estimated cost": (r.order * Number(r.unit_cost)).toFixed(2),
                    })),
                  ),
                )
              }
            >
              <Download className="size-4" /> Export CSV
            </Button>
            <Button
              disabled={orderRows.length === 0 || markPlaced.isPending}
              onClick={() => markPlaced.mutate()}
            >
              Mark order as placed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IngredientDialog({
  open,
  ingredient,
  suppliers,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  ingredient: Ingredient | null;
  suppliers: { id: string; name: string }[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    unit: "kg",
    current_stock: "0",
    min_stock: "0",
    avg_daily_usage: "0",
    unit_cost: "0",
    supplier_id: "none",
  });

  useEffect(() => {
    if (ingredient) {
      setForm({
        name: ingredient.name,
        unit: ingredient.unit,
        current_stock: String(Number(ingredient.current_stock)),
        min_stock: String(Number(ingredient.min_stock)),
        avg_daily_usage: String(Number(ingredient.avg_daily_usage)),
        unit_cost: String(Number(ingredient.unit_cost)),
        supplier_id: ingredient.supplier_id ?? "none",
      });
    } else {
      setForm({
        name: "",
        unit: "kg",
        current_stock: "0",
        min_stock: "0",
        avg_daily_usage: "0",
        unit_cost: "0",
        supplier_id: "none",
      });
    }
  }, [ingredient, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ingredient ? "Edit ingredient" : "Add ingredient"}</DialogTitle>
          <DialogDescription>Stock, minimum level and cost keep the alerts useful.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="i-name">Name</Label>
            <Input
              id="i-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-unit">Unit</Label>
            <Input
              id="i-unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-stock">Current stock</Label>
            <Input
              id="i-stock"
              type="number"
              value={form.current_stock}
              onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-min">Minimum stock</Label>
            <Input
              id="i-min"
              type="number"
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-use">Average daily use</Label>
            <Input
              id="i-use"
              type="number"
              value={form.avg_daily_usage}
              onChange={(e) => setForm({ ...form, avg_daily_usage: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-cost">Cost per unit (EUR)</Label>
            <Input
              id="i-cost"
              type="number"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select
              value={form.supplier_id}
              onValueChange={(v) => setForm({ ...form, supplier_id: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !form.name.trim()}
            onClick={() =>
              onSave({
                ...(ingredient ? { id: ingredient.id } : {}),
                name: form.name.trim(),
                unit: form.unit || "kg",
                current_stock: Number(form.current_stock) || 0,
                min_stock: Number(form.min_stock) || 0,
                avg_daily_usage: Number(form.avg_daily_usage) || 0,
                unit_cost: Number(form.unit_cost) || 0,
                supplier_id: form.supplier_id === "none" ? null : form.supplier_id,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountForm({
  defaultValue,
  onSubmit,
  pending,
}: {
  defaultValue: number;
  onSubmit: (counted: number) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState(String(defaultValue));
  useEffect(() => setValue(String(defaultValue)), [defaultValue]);
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="count">Counted amount</Label>
        <Input id="count" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <DialogFooter>
        <Button disabled={pending} onClick={() => onSubmit(Number(value) || 0)}>
          Save count
        </Button>
      </DialogFooter>
    </>
  );
}

function SupplierForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: { name: string; contact_email: string; lead_time_days: number }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lead, setLead] = useState("2");
  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="s-name">Supplier name</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-email">Contact email</Label>
          <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-lead">Delivery time (days)</Label>
          <Input id="s-lead" type="number" value={lead} onChange={(e) => setLead(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              contact_email: email.trim(),
              lead_time_days: Number(lead) || 1,
            })
          }
        >
          Add supplier
        </Button>
      </DialogFooter>
    </>
  );
}
