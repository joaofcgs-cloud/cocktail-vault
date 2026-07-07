import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Boxes,
  Martini,
  ReceiptText,
  Scale,
  LogOut,
  Users,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { Calculator, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: Shell,
});

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true, ownerOnly: false },
  { to: "/stock", label: "Stock", icon: Boxes, exact: false, ownerOnly: false },
  { to: "/sales", label: "Sales", icon: TrendingUp, exact: false, ownerOnly: false },
  { to: "/invoices", label: "Invoices", icon: ReceiptText, exact: false, ownerOnly: false },
  { to: "/calculators", label: "Calc", icon: Calculator, exact: false, ownerOnly: false },
  { to: "/analytics", label: "Charts", icon: BarChart3, exact: false, ownerOnly: true },
  { to: "/variance", label: "Variance", icon: Scale, exact: false, ownerOnly: true },
  { to: "/staff", label: "Staff", icon: Users, exact: false, ownerOnly: true },
  { to: "/costs", label: "Costs", icon: Wallet, exact: false, ownerOnly: true },
] as const;

function Shell() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = NAV.filter((item) => !item.ownerOnly || role === "owner");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal">
            <Martini className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black leading-tight">
              Imprensa Bar
            </p>
            <p className="text-xs text-muted-foreground">Command Center</p>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-teal/15 text-teal"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 px-2">
            <p className="truncate text-xs font-medium">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {role ?? "…"}
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={signOut}
            className="h-10 w-full justify-start gap-2 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal/15 text-teal">
            <Martini className="h-4 w-4" />
          </div>
          <span className="text-sm font-black">Bar Command</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pb-28 pt-4 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t border-border bg-background/95 backdrop-blur md:hidden">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex h-16 min-w-[3.6rem] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold ${
                active ? "text-teal" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
