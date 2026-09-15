import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Coffee;
  roles: AppRole[];
  primary?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "manager"], primary: true },
  {
    to: "/daily-plan",
    label: "Daily Plan",
    icon: ClipboardList,
    roles: ["owner", "manager"],
    primary: true,
  },
  { to: "/production", label: "Production", icon: Coffee, roles: ["owner", "manager"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["owner", "manager"] },
  {
    to: "/staff",
    label: "Staff & Shifts",
    icon: Users,
    roles: ["owner", "manager"],
    primary: true,
  },
  {
    to: "/my-shifts",
    label: "My Day",
    icon: CalendarClock,
    roles: ["staff", "owner", "manager"],
    primary: true,
  },
  { to: "/waste", label: "Waste", icon: Trash2, roles: ["owner", "manager", "staff"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "manager"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["owner", "manager"] },
];

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (role === "staff" && !["/my-shifts", "/waste"].includes(pathname)) {
      void navigate({ to: "/my-shifts" });
    }
  }, [role, pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen space-y-4 p-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const visible = NAV.filter((item) => (role ? item.roles.includes(role) : false));
  const mobile = visible.filter((i) => i.primary).slice(0, 4);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {visible.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="flex items-center gap-2 px-2 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Coffee className="size-5" />
          </span>
          <span className="font-display text-lg">CaféFlow</span>
        </div>
        <div className="mt-4 flex-1">
          <NavLinks />
        </div>
        <div className="rounded-xl border border-sidebar-border bg-card p-3">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? "Team member"}</p>
          <p className="text-xs text-muted-foreground">{role ? roleLabels[role] : ""}</p>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Coffee className="size-4" />
          </span>
          <span className="font-display text-base">CaféFlow</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open menu">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-sidebar p-4">
            <SheetTitle className="font-display px-2 text-lg">Menu</SheetTitle>
            <div className="mt-4">
              <NavLinks />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-6 w-full"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </SheetContent>
        </Sheet>
      </header>

      <main className="px-4 pb-24 pt-5 md:px-6 lg:ml-64 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-7xl space-y-6">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {mobile.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-terracotta" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
