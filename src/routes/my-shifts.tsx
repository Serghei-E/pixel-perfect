import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, CircleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState, LoadingBlock, PageHeader, StatusBadge } from "@/components/cafe-ui";
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
  DAY_NAMES,
  WASTE_REASONS,
  addDays,
  prettyDate,
  startOfWeek,
  timeRange,
  today,
  useProducts,
} from "@/lib/cafe";

export const Route = createFileRoute("/my-shifts")({
  head: () => ({
    meta: [
      { title: "My day — CaféFlow" },
      {
        name: "description",
        content:
          "Your next café shift, this week's schedule, opening and closing tasks, and quick ways to log waste or a sold-out item.",
      },
      { property: "og:title", content: "My day — CaféFlow" },
      {
        property: "og:description",
        content: "Shifts, availability, swap requests, checklist and quick waste reporting for café staff.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <MyDay />
    </AppShell>
  ),
});

type Shift = {
  id: string;
  starts_at: string;
  ends_at: string;
  role: string;
  confirmed: boolean;
  is_open: boolean;
  location_id: string;
  business_id: string;
};

function MyDay() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: products = [] } = useProducts();
  const [swapFor, setSwapFor] = useState<Shift | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [stockoutOpen, setStockoutOpen] = useState(false);
  const weekStart = startOfWeek(today());

  const data = useQuery({
    queryKey: ["my-day", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const pid = profile!.id as string;
      const [shifts, tasks, availability, swaps] = await Promise.all([
        supabase
          .from("shifts")
          .select("id, starts_at, ends_at, role, confirmed, is_open, location_id, business_id")
          .eq("profile_id", pid)
          .gte("starts_at", weekStart + "T00:00:00")
          .lte("starts_at", addDays(weekStart, 13) + "T23:59:59")
          .order("starts_at"),
        supabase
          .from("daily_tasks")
          .select("id, title, section, completed")
          .eq("task_date", today())
          .order("section"),
        supabase
          .from("staff_availability")
          .select("id, day_of_week, available")
          .eq("profile_id", pid)
          .order("day_of_week"),
        supabase
          .from("shift_swap_requests")
          .select("id, status, reason, shifts(starts_at, ends_at)")
          .eq("requested_by", pid)
          .order("created_at", { ascending: false }),
      ]);
      const err = [shifts, tasks, availability, swaps].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        shifts: (shifts.data ?? []) as Shift[],
        tasks: (tasks.data ?? []) as {
          id: string;
          title: string;
          section: string;
          completed: boolean;
        }[],
        availability: (availability.data ?? []) as {
          id: string;
          day_of_week: number;
          available: boolean;
        }[],
        swaps: (swaps.data ?? []) as {
          id: string;
          status: string;
          reason: string | null;
          shifts: { starts_at: string; ends_at: string } | null;
        }[],
      };
    },
  });

  const nextShift = useMemo(() => {
    const now = new Date().toISOString();
    return (data.data?.shifts ?? []).find((s) => s.ends_at > now) ?? null;
  }, [data.data]);

  const confirmShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").update({ confirmed: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift confirmed. Thanks!");
      void qc.invalidateQueries({ queryKey: ["my-day"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("daily_tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-day"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase
        .from("staff_availability")
        .update({ available })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Availability updated.");
      void qc.invalidateQueries({ queryKey: ["my-day"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestSwap = useMutation({
    mutationFn: async ({ shift, reason }: { shift: Shift; reason: string }) => {
      const { error } = await supabase.from("shift_swap_requests").insert({
        shift_id: shift.id,
        requested_by: (profile?.id ?? "") as string,
        status: "pending",
        reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Swap request sent to your manager.");
      setSwapFor(null);
      void qc.invalidateQueries({ queryKey: ["my-day"] });
      void qc.invalidateQueries({ queryKey: ["swaps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reportWaste = useMutation({
    mutationFn: async ({
      productId,
      quantity,
      reason,
      note,
    }: {
      productId: string;
      quantity: number;
      reason: string;
      note: string;
    }) => {
      const product = (products as { id: string; unit_cost: number }[]).find(
        (p) => p.id === productId,
      );
      const loc = nextShift?.location_id ?? (data.data?.shifts[0]?.location_id ?? null);
      const biz = nextShift?.business_id ?? (data.data?.shifts[0]?.business_id ?? null);
      if (!loc || !biz) throw new Error("No café location found for your account.");
      const { error } = await supabase.from("waste_records").insert({
        business_id: biz,
        location_id: loc,
        product_id: productId,
        quantity,
        cost: quantity * Number(product?.unit_cost ?? 0),
        reason,
        note: note || null,
        recorded_by: (profile?.id ?? null) as string | null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — waste recorded.");
      setWasteOpen(false);
      void qc.invalidateQueries({ queryKey: ["waste"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reportStockout = useMutation({
    mutationFn: async ({ productId, note }: { productId: string; note: string }) => {
      const loc = nextShift?.location_id ?? (data.data?.shifts[0]?.location_id ?? null);
      const biz = nextShift?.business_id ?? (data.data?.shifts[0]?.business_id ?? null);
      if (!loc || !biz) throw new Error("No café location found for your account.");
      const { error } = await supabase.from("stockout_reports").insert({
        business_id: biz,
        location_id: loc,
        product_id: productId,
        reported_by: (profile?.id ?? null) as string | null,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reported. Your manager will see it on the dashboard.");
      setStockoutOpen(false);
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = data.data?.tasks ?? [];

  return (
    <>
      <PageHeader
        title={`Hello ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        description="Your shifts, your tasks and two quick buttons for waste and sold-out items."
      >
        <Button variant="outline" onClick={() => setStockoutOpen(true)}>
          <CircleAlert className="size-4" /> Report sold out
        </Button>
        <Button onClick={() => setWasteOpen(true)}>
          <Trash2 className="size-4" /> Record waste
        </Button>
      </PageHeader>

      {data.isLoading ? <LoadingBlock rows={4} /> : null}

      <div className="card-surface p-5">
        <h2 className="font-display text-lg">Next shift</h2>
        {nextShift ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl">
                {prettyDate(nextShift.starts_at.slice(0, 10))}
              </p>
              <p className="text-sm text-muted-foreground">
                {timeRange(nextShift.starts_at, nextShift.ends_at)} ·{" "}
                <span className="capitalize">{nextShift.role.replace("_", " ")}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={nextShift.confirmed ? "Confirmed" : "Pending"} />
              {!nextShift.confirmed ? (
                <Button size="sm" onClick={() => confirmShift.mutate(nextShift.id)}>
                  <Check className="size-4" /> Confirm
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setSwapFor(nextShift)}>
                Request swap
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming shifts scheduled.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="font-display text-lg">Your schedule</h2>
          {(data.data?.shifts ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {(data.data?.shifts ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{prettyDate(s.starts_at.slice(0, 10))}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {s.role.replace("_", " ")} · {timeRange(s.starts_at, s.ends_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.confirmed ? "Confirmed" : "Pending"} />
                    <Button size="sm" variant="ghost" onClick={() => setSwapFor(s)}>
                      Swap
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface p-5">
          <h2 className="font-display text-lg">Your availability</h2>
          <p className="text-sm text-muted-foreground">Tap a day to switch it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data.data?.availability ?? []).map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={a.available ? "default" : "outline"}
                onClick={() => toggleAvailability.mutate({ id: a.id, available: !a.available })}
              >
                {DAY_NAMES[a.day_of_week]?.slice(0, 3)}
              </Button>
            ))}
          </div>

          <h3 className="mt-6 font-medium">Your swap requests</h3>
          {(data.data?.swaps ?? []).length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {(data.data?.swaps ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    {s.shifts ? prettyDate(s.shifts.starts_at.slice(0, 10)) : "Shift"}
                  </span>
                  <StatusBadge
                    status={
                      s.status === "pending"
                        ? "Pending"
                        : s.status === "approved"
                          ? "Approved"
                          : "Rejected"
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="font-display text-lg">Today's checklist</h2>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks for today" description="Your manager hasn't added any yet." />
        ) : (
          ["opening", "closing"].map((section) => (
            <div key={section} className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section}
              </p>
              <ul className="mt-2 space-y-2">
                {tasks
                  .filter((t) => t.section === section)
                  .map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggleTask.mutate({ id: t.id, completed: !t.completed })}
                        className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span
                          className={`flex size-5 items-center justify-center rounded-md border ${
                            t.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          }`}
                        >
                          {t.completed ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className={t.completed ? "text-muted-foreground line-through" : ""}>
                          {t.title}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Swap dialog */}
      <Dialog open={Boolean(swapFor)} onOpenChange={(o) => (!o ? setSwapFor(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a shift swap</DialogTitle>
            <DialogDescription>
              {swapFor ? prettyDate(swapFor.starts_at.slice(0, 10)) : ""} — your manager approves or declines.
            </DialogDescription>
          </DialogHeader>
          <SwapForm
            onSubmit={(reason) =>
              swapFor ? requestSwap.mutate({ shift: swapFor, reason }) : undefined
            }
            pending={requestSwap.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Waste dialog */}
      <Dialog open={wasteOpen} onOpenChange={setWasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record waste</DialogTitle>
            <DialogDescription>Quick and blame-free — it helps plan better tomorrow.</DialogDescription>
          </DialogHeader>
          <StaffWasteForm
            products={products as { id: string; name: string }[]}
            onSubmit={(p) => reportWaste.mutate(p)}
            pending={reportWaste.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Stockout dialog */}
      <Dialog open={stockoutOpen} onOpenChange={setStockoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a sold-out item</DialogTitle>
            <DialogDescription>Let the manager know what customers couldn't get.</DialogDescription>
          </DialogHeader>
          <StockoutForm
            products={products as { id: string; name: string }[]}
            onSubmit={(p) => reportStockout.mutate(p)}
            pending={reportStockout.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SwapForm({
  onSubmit,
  pending,
}: {
  onSubmit: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="swap-reason">Why?</Label>
        <Textarea
          id="swap-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Doctor's appointment in the morning"
        />
      </div>
      <DialogFooter>
        <Button disabled={pending} onClick={() => onSubmit(reason)}>
          Send request
        </Button>
      </DialogFooter>
    </>
  );
}

function StaffWasteForm({
  products,
  onSubmit,
  pending,
}: {
  products: { id: string; name: string }[];
  onSubmit: (p: { productId: string; quantity: number; reason: string; note: string }) => void;
  pending: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(WASTE_REASONS[1] ?? "Overproduction");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!productId && products.length) setProductId(products[0]!.id);
  }, [products, productId]);

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2">
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
          <Label htmlFor="sw-qty">How many?</Label>
          <Input
            id="sw-qty"
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
          <Label htmlFor="sw-note">Note (optional)</Label>
          <Textarea id="sw-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !productId}
          onClick={() =>
            onSubmit({ productId, quantity: Math.max(1, Number(quantity) || 1), reason, note })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

function StockoutForm({
  products,
  onSubmit,
  pending,
}: {
  products: { id: string; name: string }[];
  onSubmit: (p: { productId: string; note: string }) => void;
  pending: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!productId && products.length) setProductId(products[0]!.id);
  }, [products, productId]);
  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2">
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
          <Label htmlFor="so-note">What happened?</Label>
          <Textarea
            id="so-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ran out of croissants around 11:00"
          />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !productId} onClick={() => onSubmit({ productId, note })}>
          Send report
        </Button>
      </DialogFooter>
    </>
  );
}
