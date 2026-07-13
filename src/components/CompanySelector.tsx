import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronsUpDown, Layers } from "lucide-react";
import { useCompanyContext } from "@/lib/company-context";

/**
 * Global company switcher. Persists across pages (localStorage-backed context)
 * and is role-gated: owners/lab managers see every company, bar managers see
 * their bar + the Lab. "All Companies" is the consolidated group view.
 */
export function CompanySelector({ className }: { className?: string }) {
  const { selected, setSelected, visibleCompanies, loading } =
    useCompanyContext();

  const current =
    selected === "all"
      ? undefined
      : visibleCompanies.find((c) => c.id === selected);

  const dotColor = current?.brand_color ?? "#e8e8e8";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Select company"
          disabled={loading}
          className={`flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${className ?? ""}`}
        >
          {selected === "all" ? (
            <Layers className="h-4 w-4 text-muted-foreground" />
          ) : (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
          )}
          <span className="max-w-[8.5rem] truncate">
            {selected === "all"
              ? "All Companies"
              : current?.commercial_name ?? "Select"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Company view
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setSelected("all")}>
          <Layers className="mr-2 h-4 w-4" />
          <span className="flex-1">All Companies</span>
          {selected === "all" && <Check className="h-4 w-4 text-teal" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visibleCompanies.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setSelected(c.id)}>
            <span
              className="mr-2 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: c.brand_color }}
            />
            <span className="flex-1 truncate">{c.commercial_name}</span>
            {selected === c.id && <Check className="h-4 w-4 text-teal" />}
          </DropdownMenuItem>
        ))}
        {visibleCompanies.length === 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4" /> No companies
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}