import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PasswordStrength } from "@/components/PasswordStrength";
import { isPasswordValid } from "@/lib/password";
import { toast } from "sonner";
import {
  Martini,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Create new password — Imprensa Bar Command Center" }],
  }),
  component: ResetPasswordPage,
});

type TokenState = "checking" | "valid" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [tokenState, setTokenState] = useState<TokenState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && !settled)) {
        settled = true;
        setTokenState("valid");
      }
    });
    // Fallback: check for an existing recovery session in the URL.
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      settled = true;
      setTokenState(data.session ? "valid" : "invalid");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate({ to: "/auth" }), 3000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const valid = isPasswordValid(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = valid && matches && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update password",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal/15 text-teal">
            <Martini className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Create New Password
          </h1>
        </div>

        <Card className="border-border/60 bg-card/70 p-6 shadow-2xl backdrop-blur-xl">
          {tokenState === "checking" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying link…
            </div>
          )}

          {tokenState === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-red/15 text-red">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                This link has expired or is invalid.
              </p>
              <Button asChild className="h-11 w-full font-semibold">
                <Link to="/forgot-password">Request New Link</Link>
              </Button>
            </div>
          )}

          {tokenState === "valid" && done && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-green/15 text-green">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold">
                Password updated successfully
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting you to sign in…
              </p>
            </div>
          )}

          {tokenState === "valid" && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                  >
                    {show ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11"
                />
                {confirm.length > 0 && !matches && (
                  <p className="text-xs text-red">Passwords do not match</p>
                )}
              </div>

              <PasswordStrength password={password} />

              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-11 w-full font-semibold"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? "Updating…" : "Update Password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}