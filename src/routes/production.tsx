import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { PRODUCT_CATEGORIES, WASTE_REASONS, today, useLocations } from "@/lib/cafe";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/production")({
  head: () => ({
    meta: [
      { title: "Production — CaféFlow" },
      {
        name: "description",
        content:
          "Track what was prepared, sold, left over and wasted for each café product, and update preparation status as the day runs.",
      },
      { property: "og:title", content: "Production — CaféFlow" },
      {
        property: "og:description",
        content: "Prepared, sold, remaining and wasted quantities per product with clear status.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Production />
    </AppShell>
  ),
});

const STATUSES = ["not_started", "in_progress", "complete", "attention"] as const;
const statusLabels: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  attention: "Attention needed",
};

type Item = {
  id: string;
  planned_qty: number;
  recommended_qty: number;
  actual_qty: number;
  sold_qty: number;
  remaining_qty: number;
  wasted_qty: number;
  status: string;
  note: string | null;
  reason: string | null;
  product_id: string;
  products: { name: string; category: string; unit_cost: number } | null;
};

function Production() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [date, setDate] = useState(today());
  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState("all");
  const [wasteFor, setWasteFor] = useState<Item | null>(null);
  const { data: locations = [] } = useLocations();

  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0]!.id as string);
  }, [locations, locationId]);

  const plan = useQuery({
    queryKey: ["production", date, locationId],
    enabled: Boolean(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_plans")
        .select(
          "id, status, production_items(id, planned_qty, recommended_qty, actual_qty, sold_qty, remaining_qty, wasted_qty, status, note, reason, product_id, products(name, category, unit_cost))",
        )
        .eq("plan_date", date)
        .eq("location_id", locationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("production_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["production"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const recordWaste = useMutation({
    mutationFn: async ({
      item,
      quantity,
      reason,
      note,
    }: {
      item: Item;
      quantity: number;
      reason: string;
      note: string;
    }) => {
      const business = await supabase.from("businesses").select("id").limit(1).maybeSingle();
      const { error } = await supabase.from("waste_records").insert({
        business_id: business.data?.id,
        location_id: locationId,
        product_id: item.product_id,
        quantity,
        cost: quantity * Number(item.products?.unit_cost ?? 0),
        reason,
        note: note || null,
        recorded_by: profile?.id ?? null,
      });
      if (error) throw error;
      await supabase
        .from("production_items")
        .update({
          wasted_qty: Number(item.wasted_qty) + quantity,
          remaining_qty: Math.max(0, Number(item.remaining_qty) - quantity),
        })
        .eq("id", item.id);
    },
    onSuccess: () => {
      toast.success("Waste recorded.");
      setWasteFor(null);
      void qc.invalidateQueries({ queryKey: ["production"] });
      void qc.invalidateQueries({ queryKey: ["waste"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = ((plan.data?.production_items ?? []) as Item[])
    .filter((i) => category === "all" || i.products?.category === category)
    .sort((a, b) => (a.products?.name ?? "").localeCompare(b.products?.name ?? ""));

  return (
    <>
      <PageHeader
        title="Production"
        description="Keep the prep board honest: what was made, what sold, what is left and what went in the bin."
      >
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || today())}
          className="w-[160px]"
          aria-label="Production date"
        />
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-[160px]" aria-label="Location">
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
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[150px]" aria-label="Category">
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
      </PageHeader>

      {plan.isError ? <ErrorState message={(plan.error as Error)?.message} /> : null}
      {plan.isLoading ? <LoadingBlock rows={6} /> : null}
      {!plan.isLoading && items.length === 0 ? (
        <EmptyState
          title="Nothing to prepare here"
          description="There is no plan for this date, location and category yet."
        />
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.products?.name}</p>
                <p className="text-xs text-muted-foreground">{item.products?.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <WhyTooltip reason={item.reason} />
                <StatusBadge status={statusLabels[item.status] ?? "Not started"} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Recommended">
                <p className="px-1 py-2 text-sm">{item.recommended_qty}</p>
              </Field>
              <Field label="Prepared">
                <NumberField
                  value={item.actual_qty}
                  onCommit={(v) => update.mutate({ id: item.id, patch: { actual_qty: v } })}
                />
              </Field>
              <Field label="Sold">
                <NumberField
                  value={item.sold_qty}
                  onCommit={(v) => update.mutate({ id: item.id, patch: { sold_qty: v } })}
                />
              </Field>
              <Field label="Remaining">
                <NumberField
                  value={item.remaining_qty}
                  onCommit={(v) => update.mutate({ id: item.id, patch: { remaining_qty: v } })}
                />
              </Field>
              <Field label="Wasted">
                <p className="px-1 py-2 text-sm">{item.wasted_qty}</p>
              </Field>
              <Field label="Status">
                <Select
                  value={item.status}
                  onValueChange={(v) => update.mutate({ id: item.id, patch: { status: v } })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                defaultValue={item.note ?? ""}
                placeholder="Add a note for the team"
                className="max-w-sm"
                onBlur={(e) =>
                  e.target.value !== (item.note ?? "")
                    ? update.mutate({ id: item.id, patch: { note: e.target.value || null } })
                    : undefined
                }
                aria-label={`Note for ${item.products?.name}`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update.mutate({
                    id: item.id,
                    patch: { actual_qty: item.planned_qty, status: "complete" },
                  })
                }
              >
                Mark as prepared
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setWasteFor(item)}>
                <Trash2 className="size-4" /> Record waste
              </Button>
            </div>
          </div>
        ))}
      </div>

      <WasteDialog
        item={wasteFor}
        onClose={() => setWasteFor(null)}
        onSubmit={(quantity, reason, note) =>
          wasteFor ? recordWaste.mutate({ item: wasteFor, quantity, reason, note }) : undefined
        }
        pending={recordWaste.isPending}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function NumberField({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <Input
      type="number"
      min={0}
      value={local}
      className="h-9"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => (Number(local) !== value ? onCommit(Number(local) || 0) : undefined)}
    />
  );
}

function WasteDialog({
  item,
  onClose,
  onSubmit,
  pending,
}: {
  item: Item | null;
  onClose: () => void;
  onSubmit: (quantity: number, reason: string, note: string) => void;
  pending: boolean;
}) {
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(WASTE_REASONS[1] ?? "Overproduction");
  const [note, setNote] = useState("");

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record waste</DialogTitle>
          <DialogDescription>
            {item?.products?.name} — this also reduces the remaining count.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wq">How many?</Label>
            <Input
              id="wq"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="wn">Note (optional)</Label>
            <Textarea id="wn" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => onSubmit(Math.max(1, Number(quantity) || 1), reason, note)}
          >
            Save waste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
