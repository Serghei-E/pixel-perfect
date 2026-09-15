import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_ACCOUNTS, signInDemo, useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to CaféFlow" },
      {
        name: "description",
        content:
          "Sign in to CaféFlow to plan daily café production, track waste and manage shifts, or try a demo account.",
      },
      { property: "og:title", content: "Sign in to CaféFlow" },
      {
        property: "og:description",
        content: "Owner, manager and staff demo accounts are ready to explore.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState<AppRole>("manager");

  useEffect(() => {
    if (session) void navigate({ to: role === "staff" ? "/my-shifts" : "/" });
  }, [session, role, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy("signin");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) toast.error(error.message);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy("signup");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: signupRole } },
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("Account created. Welcome to CaféFlow.");
  }

  async function handleReset() {
    if (!email) return toast.error("Enter your email address first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email.");
  }

  async function handleDemo(demoRole: AppRole) {
    setBusy(demoRole);
    try {
      await signInDemo(demoRole);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed.");
    }
    setBusy(null);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Coffee className="size-5" />
          </span>
          <span className="font-display text-lg">CaféFlow</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-4xl leading-tight">
            Plan the day before the first customer walks in.
          </h1>
          <p className="text-sm text-primary-foreground/80">
            CaféFlow turns your sales history into clear daily production, ordering and staffing
            suggestions — each one explained, always yours to override.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          Suggestions are guidance based on past sales, never guaranteed predictions.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Coffee className="size-4" />
              </span>
              <span className="font-display text-lg">CaféFlow</span>
            </div>
          </div>

          <div className="card-surface p-6">
            <Tabs defaultValue="signin">
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Create account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-4" onSubmit={handleSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy === "signin"}>
                    {busy === "signin" ? <Loader2 className="size-4 animate-spin" /> : null}
                    Sign in
                  </Button>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4" onSubmit={handleSignUp}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Email</Label>
                    <Input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Password</Label>
                    <Input
                      id="password2"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Your role</Label>
                    <Select
                      value={signupRole}
                      onValueChange={(v) => setSignupRole(v as AppRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Café owner</SelectItem>
                        <SelectItem value="manager">Café manager</SelectItem>
                        <SelectItem value="staff">Staff member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy === "signup"}>
                    {busy === "signup" ? <Loader2 className="size-4 animate-spin" /> : null}
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <div className="card-surface p-5">
            <p className="text-sm font-medium">Try a demo account</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Each demo account opens the same café with realistic data.
            </p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.role}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={busy === account.role}
                  onClick={() => void handleDemo(account.role)}
                >
                  <span>{account.label}</span>
                  {busy === account.role ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{account.name}</span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
