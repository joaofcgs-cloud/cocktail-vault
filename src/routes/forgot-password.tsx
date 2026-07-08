import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Martini, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { checkRateLimit } from "@/lib/password";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Reset password — Imprensa Bar Command Center" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    // Best-effort client rate limit: max 3 per email per hour.
    const { allowed } = checkRateLimit(`forgot:${normalized}`, 3, 60 * 60 * 1000);
    if (!allowed) {
      // Still show the same generic message to avoid enumeration.
      setSent(true);
      return;
    }

    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // swallow — never reveal outcome
    } finally {
      setBusy(false);
      setSent(true);
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
            Reset Your Password
          </h1>
          <p className="text-sm text-muted-foreground">
            We'll email you a secure reset link
          </p>
        </div>

        <Card className="border-border/60 bg-card/70 p-6 shadow-2xl backdrop-blur-xl">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-green/15 text-green">
                <MailCheck className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                If this email is registered, you will receive a reset link
                shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@bar.com"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full font-semibold"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}