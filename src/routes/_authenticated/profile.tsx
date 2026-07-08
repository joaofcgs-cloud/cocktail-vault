import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PasswordStrength } from "@/components/PasswordStrength";
import { isPasswordValid } from "@/lib/password";
import { toast } from "sonner";
import {
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  LogOut,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "My Profile — Imprensa Bar Command Center" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    db.from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: { full_name: string | null } | null }) => {
        setFullName(data?.full_name ?? "");
      });
  }, [user?.id]);

  const lastLogin = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-IE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  async function saveName() {
    if (!user?.id) return;
    setSavingName(true);
    const { error } = await db
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", user.id);
    setSavingName(false);
    if (error) {
      toast.error("Could not update name");
    } else {
      toast.success("Profile updated");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account details and password
        </p>
      </div>

      <Card className="space-y-5 p-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11"
            />
            <Button
              onClick={saveName}
              disabled={savingName}
              className="h-11 shrink-0"
            >
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} readOnly disabled className="h-11" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div>
              <Badge
                variant={role === "owner" ? "default" : "secondary"}
                className="uppercase"
              >
                {role ?? "…"}
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Last login</Label>
            <p className="text-sm text-muted-foreground">{lastLogin}</p>
          </div>
        </div>
      </Card>

      <ChangePasswordCard email={user?.email ?? ""} />

      <Button
        variant="destructive"
        onClick={signOut}
        className="h-11 w-full gap-2 font-semibold"
      >
        <LogOut className="h-4 w-4" /> Log Out
      </Button>
    </div>
  );
}

function ChangePasswordCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = isPasswordValid(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = current.length > 0 && valid && matches && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      // Re-authenticate with the current password.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (reauthError) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully");
      setCurrent("");
      setPassword("");
      setConfirm("");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update password",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-secondary/50">
          <span className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4 text-teal" /> Change Password
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new">New password</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <Label htmlFor="confirm-new">Confirm new password</Label>
              <Input
                id="confirm-new"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              Update Password
            </Button>
          </form>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}