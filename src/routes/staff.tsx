import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ErrorState, LoadingBlock, PageHeader, StatCard, StatusBadge } from "@/components/cafe-ui";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAY_NAMES,
  STAFF_ROLES,
  addDays,
  prettyDate,
  startOfWeek,
  timeRange,
  today,
  useBusiness,
  useLocations,
  useTeam,
} from "@/lib/cafe";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff & shifts — CaféFlow" },
      {
        name: "description",
        content:
          "Plan the week's café shifts, see coverage at a glance, fill open shifts and handle shift swap requests.",
      },
      { property: "og:title", content: "Staff & shifts — CaféFlow" },
      {
        property: "og:description",
        content: "Weekly shift calendar, coverage labels, open shifts and swap approvals.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Staff />
    </AppShell>
  ),
});

type Shift = {
  id: string;
  profile_id: string | null;
  role: string;
  starts_at: string;
  ends_at: string;
  is_open: boolean;
  confirmed: boolean;
  profiles: { full_name: string } | null;
};

type Swap = {
  id: string;
  status: string;
  reason: string | null;
  shift_id: string;
  shifts: { starts_at: string; ends_at: string; role: string } | null;
  requested_by: string | null;
};

function Staff() {
  const qc = useQueryClient();
  const { data: business } = useBusiness();
  const { data: locations = [] } = useLocations();
  const { data: team = [] } = useTeam();
  const [locationId, setLocationId] = useState("");
  const [weekStart, setWeekStart] = useState(startOfWeek(today()));
  const [creating, setCreating] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shift | null>(null);

  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0]!.id as string);
  }, [locations, locationId]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const shifts = useQuery({
    queryKey: ["shifts", weekStart, locationId],
    enabled: Boolean(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, profile_id, role, starts_at, ends_at, is_open, confirmed, profiles(full_name)")
        .eq("location_id", locationId)
        .gte("starts_at", weekStart + "T00:00:00")
        .lte("starts_at", addDays(weekStart, 6) + "T23:59:59")
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
  });

  const swaps = useQuery({
    queryKey: ["swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_swap_requests")
        .select("id, status, reason, shift_id, requested_by, shifts(starts_at, ends_at, role)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Swap[];
    },
  });

  const saveShift = useMutation({
    mutationFn: async (payload: {
      id?: string;
      date: string;
      start: string;
      end: string;
      role: string;
      profile_id: string;
    }) => {
      const body = {
        role: payload.role as "barista" | "kitchen" | "shift_leader" | "manager",
        starts_at: new Date(`${payload.date}T${payload.start}:00`).toISOString(),
        ends_at: new Date(`${payload.date}T${payload.end}:00`).toISOString(),
        profile_id: payload.profile_id === "open" ? null : payload.profile_id,
        is_open: payload.profile_id === "open",
      };
      if (payload.id) {
        const { error } = await supabase.from("shifts").update(body).eq("id", payload.id);
        if (error) throw error;
        return;
      }
      if (!business) throw new Error("No café found.");
      const { error } = await supabase
        .from("shifts")
        .insert({ ...body, business_id: business.id as string, location_id: locationId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift saved.");
      setCreating(null);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markOpen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shifts")
        .update({ is_open: true, profile_id: null, confirmed: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift marked as open.");
      void qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideSwap = useMutation({
    mutationFn: async ({ swap, status }: { swap: Swap; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("shift_swap_requests")
        .update({ status })
        .eq("id", swap.id);
      if (error) throw error;
      if (status === "approved") {
        await supabase.from("shifts").update({ is_open: true, profile_id: null }).eq("id", swap.shift_id);
      }
    },
    onSuccess: () => {
      toast.success("Swap request updated.");
      void qc.invalidateQueries({ queryKey: ["swaps"] });
      void qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = shifts.data ?? [];
  const openShifts = rows.filter((s) => s.is_open);
  const pendingSwaps = (swaps.data ?? []).filter((s) => s.status === "pending");

  function coverageFor(day: string) {
    const dayShifts = rows.filter((s) => s.starts_at.slice(0, 10) === day && !s.is_open);
    if (dayShifts.length <= 1) return "Understaffed";
    if (dayShifts.length >= 5) return "Overstaffed";
    return "Balanced";
  }

  return (
    <>
      <PageHeader
        title="Staff & shifts"
        description="A week at a time. Coverage labels are a guide, not a rule — you know your café best."
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
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous week"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next week"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button onClick={() => setCreating(today())}>
          <Plus className="size-4" /> New shift
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Shifts this week" value={String(rows.length)} />
        <StatCard
          label="Open shifts"
          value={String(openShifts.length)}
          tone={openShifts.length ? "terracotta" : "sage"}
        />
        <StatCard
          label="Swap requests waiting"
          value={String(pendingSwaps.length)}
          tone={pendingSwaps.length ? "warning" : "sage"}
        />
      </div>

      {shifts.isError ? <ErrorState message={(shifts.error as Error)?.message} /> : null}
      {shifts.isLoading ? <LoadingBlock rows={5} /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {weekDays.map((day) => {
          const dayShifts = rows.filter((s) => s.starts_at.slice(0, 10) === day);
          return (
            <div key={day} className="card-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{DAY_NAMES[new Date(day + "T00:00:00").getDay()]}</p>
                  <p className="text-xs text-muted-foreground">{prettyDate(day)}</p>
                </div>
                <StatusBadge status={coverageFor(day)} />
              </div>
              <ul className="mt-3 space-y-2">
                {dayShifts.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No shifts.</li>
                ) : (
                  dayShifts.map((s) => (
                    <li key={s.id} className="rounded-lg border border-border p-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {s.is_open ? "Open shift" : (s.profiles?.full_name ?? "Unassigned")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {timeRange(s.starts_at, s.ends_at)}
                        </span>
                      </div>
                      <p className="text-xs capitalize text-muted-foreground">
                        {s.role.replace("_", " ")}
                        {s.confirmed ? " · confirmed" : ""}
                      </p>
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        {!s.is_open ? (
                          <Button size="sm" variant="ghost" onClick={() => markOpen.mutate(s.id)}>
                            Mark open
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setCreating(day)}
              >
                <UserPlus className="size-4" /> Add shift
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="font-display text-lg">Shift swap requests</h2>
          {(swaps.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {(swaps.data ?? []).map((s) => (
                <li key={s.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {s.shifts ? prettyDate(s.shifts.starts_at.slice(0, 10)) : "Shift"} ·{" "}
                        {s.shifts ? timeRange(s.shifts.starts_at, s.shifts.ends_at) : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.reason ?? "No reason given"}</p>
                    </div>
                    <StatusBadge
                      status={
                        s.status === "pending"
                          ? "Pending"
                          : s.status === "approved"
                            ? "Approved"
                            : "Rejected"
                      }
                    />
                  </div>
                  {s.status === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => decideSwap.mutate({ swap: s, status: "approved" })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideSwap.mutate({ swap: s, status: "rejected" })}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface p-5">
          <h2 className="font-display text-lg">Team</h2>
          <ul className="mt-3 divide-y divide-border">
            {(team as { id: string; full_name: string; staff_role: string; active: boolean }[]).map(
              (m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {m.staff_role.replace("_", " ")}
                    </p>
                  </div>
                  <StatusBadge status={m.active ? "Available" : "Unavailable"} />
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      <ShiftDialog
        open={Boolean(creating) || Boolean(editing)}
        shift={editing}
        defaultDate={creating ?? today()}
        team={team as { id: string; full_name: string; staff_role: string }[]}
        onClose={() => {
          setCreating(null);
          setEditing(null);
        }}
        onSave={(p) => saveShift.mutate(p)}
        pending={saveShift.isPending}
      />
    </>
  );
}

function ShiftDialog({
  open,
  shift,
  defaultDate,
  team,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  shift: Shift | null;
  defaultDate: string;
  team: { id: string; full_name: string; staff_role: string }[];
  onClose: () => void;
  onSave: (p: {
    id?: string;
    date: string;
    start: string;
    end: string;
    role: string;
    profile_id: string;
  }) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    date: defaultDate,
    start: "08:00",
    end: "16:00",
    role: "barista",
    profile_id: "open",
  });

  useEffect(() => {
    if (shift) {
      const s = new Date(shift.starts_at);
      const e = new Date(shift.ends_at);
      const hhmm = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      setForm({
        date: shift.starts_at.slice(0, 10),
        start: hhmm(s),
        end: hhmm(e),
        role: shift.role,
        profile_id: shift.profile_id ?? "open",
      });
    } else {
      setForm({ date: defaultDate, start: "08:00", end: "16:00", role: "barista", profile_id: "open" });
    }
  }, [shift, defaultDate, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shift ? "Edit shift" : "New shift"}</DialogTitle>
          <DialogDescription>Leave the person as "Open shift" if it still needs cover.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sh-date">Date</Label>
            <Input
              id="sh-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sh-start">Starts</Label>
            <Input
              id="sh-start"
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sh-end">Ends</Label>
            <Input
              id="sh-end"
              type="time"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Person</Label>
            <Select
              value={form.profile_id}
              onValueChange={(v) => setForm({ ...form, profile_id: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open shift</SelectItem>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
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
            disabled={pending}
            onClick={() => onSave(shift ? { ...form, id: shift.id } : form)}
          >
            Save shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
