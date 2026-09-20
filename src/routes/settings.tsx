import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatusBadge } from "@/components/cafe-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eur2, useBusiness, useLocations, useProducts, useTeam } from "@/lib/cafe";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CaféFlow" },
      {
        name: "description",
        content:
          "Manage your café profile, locations, opening hours, product prices, ingredient costs, team and sales data import.",
      },
      { property: "og:title", content: "Settings — CaféFlow" },
      {
        property: "og:description",
        content: "Café profile, locations, products, costs, team, permissions and data import.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Settings />
    </AppShell>
  ),
});

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function Settings() {
  const qc = useQueryClient();
  const { data: business } = useBusiness();
  const { data: locations = [] } = useLocations();
  const { data: products = [] } = useProducts();
  const { data: team = [] } = useTeam();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [hours, setHours] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState({
    lowStock: true,
    swapRequests: true,
    dailySummary: false,
  });
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    if (business) {
      setName((business.name as string) ?? "");
      setCurrency((business.currency as string) ?? "EUR");
      const oh = (business.opening_hours ?? {}) as Record<string, string>;
      setHours(
        Object.fromEntries(WEEK.map((d) => [d, oh[d] ?? "08:00-18:00"])) as Record<string, string>,
      );
    }
  }, [business]);

  const ingredients = useQuery({
    queryKey: ["all-ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, unit, unit_cost")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; unit: string; unit_cost: number }[];
    },
  });

  const saveBusiness = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No café found.");
      const { error } = await supabase
        .from("businesses")
        .update({ name, currency, opening_hours: hours })
        .eq("id", business.id as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Café profile saved.");
      void qc.invalidateQueries({ queryKey: ["business"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProduct = useMutation({
    mutationFn: async ({
      id,
      price,
      unit_cost,
    }: {
      id: string;
      price: number;
      unit_cost: number;
    }) => {
      const { error } = await supabase.from("products").update({ price, unit_cost }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product updated.");
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveIngredientCost = useMutation({
    mutationFn: async ({ id, unit_cost }: { id: string; unit_cost: number }) => {
      const { error } = await supabase.from("ingredients").update({ unit_cost }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ingredient cost updated.");
      void qc.invalidateQueries({ queryKey: ["all-ingredients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
      const headers = lines[0]?.split(",").map((h) => h.trim()) ?? [];
      setImportResult(
        `${file.name}: read ${Math.max(0, lines.length - 1)} rows with columns ${headers
          .slice(0, 6)
          .join(", ")}. This is a preview only — nothing was added to your café yet.`,
      );
      toast.success("File read. Preview shown below.");
    };
    reader.readAsText(file);
  }

  return (
    <>
      <PageHeader title="Settings" description="Your café details, prices, team and data." />

      <Tabs defaultValue="profile" className="w-full">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="profile">Café</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="costs">Ingredient costs</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="import">Data import</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-4">
          <div className="card-surface space-y-4 p-5">
            <h2 className="font-display text-lg">Café profile</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="b-name">Café name</Label>
                <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-cur">Currency</Label>
                <Input id="b-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Opening hours</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {WEEK.map((day) => (
                  <div key={day} className="space-y-1">
                    <Label htmlFor={`h-${day}`} className="text-xs uppercase">
                      {day}
                    </Label>
                    <Input
                      id={`h-${day}`}
                      value={hours[day] ?? ""}
                      placeholder="08:00-18:00"
                      onChange={(e) => setHours({ ...hours, [day]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Button disabled={saveBusiness.isPending} onClick={() => saveBusiness.mutate()}>
              Save café profile
            </Button>
          </div>

          <div className="card-surface p-5">
            <h2 className="font-display text-lg">Locations</h2>
            <ul className="mt-3 divide-y divide-border">
              {locations.map((l: { id: string; name: string; address: string | null }) => (
                <li key={l.id} className="py-2.5 text-sm">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.address ?? "No address set"}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-surface p-5">
            <h2 className="font-display text-lg">Roles and permissions</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Owner</strong> — everything, including prices,
                costs, reports and team.
              </li>
              <li>
                <strong className="text-foreground">Manager</strong> — daily plan, production,
                inventory, shifts, waste and reports.
              </li>
              <li>
                <strong className="text-foreground">Staff</strong> — own shifts, availability, swap
                requests, checklist, waste and sold-out reports.
              </li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <div className="card-surface overflow-hidden">
            <h2 className="border-b border-border p-4 font-display text-lg">Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Selling price</th>
                    <th className="p-3">Cost to make</th>
                    <th className="p-3">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(
                    products as {
                      id: string;
                      name: string;
                      category: string;
                      price: number;
                      unit_cost: number;
                    }[]
                  ).map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-muted-foreground">{p.category}</td>
                      <td className="p-3">
                        <Input
                          type="number"
                          step="0.05"
                          defaultValue={Number(p.price)}
                          className="h-9 w-24"
                          onBlur={(e) =>
                            Number(e.target.value) !== Number(p.price)
                              ? saveProduct.mutate({
                                  id: p.id,
                                  price: Number(e.target.value),
                                  unit_cost: Number(p.unit_cost),
                                })
                              : undefined
                          }
                          aria-label={`Price for ${p.name}`}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          step="0.05"
                          defaultValue={Number(p.unit_cost)}
                          className="h-9 w-24"
                          onBlur={(e) =>
                            Number(e.target.value) !== Number(p.unit_cost)
                              ? saveProduct.mutate({
                                  id: p.id,
                                  price: Number(p.price),
                                  unit_cost: Number(e.target.value),
                                })
                              : undefined
                          }
                          aria-label={`Cost for ${p.name}`}
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {eur2(Number(p.price) - Number(p.unit_cost))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="costs">
          <div className="card-surface overflow-hidden">
            <h2 className="border-b border-border p-4 font-display text-lg">Ingredient costs</h2>
            <ul className="divide-y divide-border">
              {(ingredients.data ?? []).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">per {i.unit}</p>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={Number(i.unit_cost)}
                    className="h-9 w-28"
                    onBlur={(e) =>
                      Number(e.target.value) !== Number(i.unit_cost)
                        ? saveIngredientCost.mutate({
                            id: i.id,
                            unit_cost: Number(e.target.value),
                          })
                        : undefined
                    }
                    aria-label={`Cost for ${i.name}`}
                  />
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <div className="card-surface overflow-hidden">
            <h2 className="border-b border-border p-4 font-display text-lg">Team</h2>
            <ul className="divide-y divide-border">
              {(
                team as {
                  id: string;
                  full_name: string;
                  email: string | null;
                  staff_role: string;
                  hourly_cost: number;
                  active: boolean;
                }[]
              ).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {m.staff_role.replace("_", " ")} · {eur2(Number(m.hourly_cost))}/hour
                      {m.email ? ` · ${m.email}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={m.active ? "Active" : "Inactive"} />
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="card-surface space-y-3 p-5">
            <h2 className="font-display text-lg">Notification preferences</h2>
            {(
              [
                ["lowStock", "Low stock alerts"],
                ["swapRequests", "Shift swap requests"],
                ["dailySummary", "Daily summary at closing"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <span className="text-sm">{label}</span>
                <Button
                  size="sm"
                  variant={notifications[key] ? "default" : "outline"}
                  onClick={() =>
                    setNotifications({ ...notifications, [key]: !notifications[key] })
                  }
                >
                  {notifications[key] ? "On" : "Off"}
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Preferences are kept for this session in the demo.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="import">
          <div className="card-surface space-y-4 p-5">
            <h2 className="font-display text-lg">Import sales data</h2>
            <p className="text-sm text-muted-foreground">
              Upload a CSV export from your till with columns like date, product and quantity. We show
              you what we found before anything is saved.
            </p>
            <div className="flex items-center gap-3">
              <Label
                htmlFor="csv"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <Upload className="size-4" /> Choose CSV file
              </Label>
              <input
                id="csv"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
            </div>
            {importResult ? (
              <div className="rounded-xl border border-sage/40 bg-sage-soft/40 p-4 text-sm">
                {importResult}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              There is no till connection yet, so imports are a preview only.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
