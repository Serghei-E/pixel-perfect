import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_CATEGORIES = [
  "Pastries",
  "Sandwiches",
  "Cakes",
  "Breakfast",
  "Cold drinks",
  "Other",
] as const;

export const WASTE_REASONS = [
  "Expired",
  "Overproduction",
  "Damaged",
  "Incorrect preparation",
  "Customer return",
  "Other",
] as const;

export const STAFF_ROLES = [
  { value: "barista", label: "Barista" },
  { value: "kitchen", label: "Kitchen" },
  { value: "shift_leader", label: "Shift leader" },
  { value: "manager", label: "Manager" },
] as const;

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function eur(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function eur2(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    Number(value ?? 0),
  );
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function prettyDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function timeRange(startsAt: string, endsAt: string) {
  const f = (v: string) =>
    new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${f(startsAt)}–${f(endsAt)}`;
}

export function startOfWeek(date: string = today()) {
  const d = new Date(date + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday first
  d.setDate(d.getDate() - day);
  return isoDate(d);
}

export type StockStatus = "In stock" | "Low stock" | "Critical" | "Out of stock";

export function stockStatus(current: number, min: number): StockStatus {
  if (current <= 0) return "Out of stock";
  if (current < min * 0.5) return "Critical";
  if (current < min) return "Low stock";
  return "In stock";
}

export function daysRemaining(current: number, usage: number) {
  if (!usage) return null;
  return Math.max(0, Math.round((current / usage) * 10) / 10);
}

export function suggestedOrder(current: number, min: number, usage: number) {
  const target = Math.max(min * 1.5, usage * 3);
  return Math.max(0, Math.ceil(target - current));
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n",
  );
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useBusiness() {
  return useQuery({
    queryKey: ["business"],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
