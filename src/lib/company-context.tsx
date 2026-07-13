import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { useCompanies, type Company } from "@/lib/group";
import { useQuery } from "@tanstack/react-query";

const STORAGE_KEY = "imprensa.selectedCompany";

/** "all" = consolidated group view (inter-company transactions eliminated). */
export type CompanySelection = string | "all";

interface CompanyContextValue {
  /** Currently selected company id, or "all" for the consolidated group view. */
  selected: CompanySelection;
  setSelected: (v: CompanySelection) => void;
  /** The full selected Company object, or undefined when "all" or loading. */
  selectedCompany?: Company;
  /** Companies the signed-in user is allowed to see, respecting role gating. */
  visibleCompanies: Company[];
  /** True while companies/assignments are loading or a switch is settling. */
  loading: boolean;
  switching: boolean;
}

const CompanyContext = createContext<CompanyContextValue>({
  selected: "all",
  setSelected: () => {},
  visibleCompanies: [],
  loading: true,
  switching: false,
});

function useAssignedCompanyIds(userId?: string) {
  return useQuery({
    queryKey: ["user_company_assignments", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await db
        .from("user_company_assignments")
        .select("company_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r: { company_id: string }) => r.company_id);
    },
  });
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: assigned = [], isLoading: assignedLoading } =
    useAssignedCompanyIds(user?.id);

  const [selected, setSelectedState] = useState<CompanySelection>("all");
  const [switching, setSwitching] = useState(false);

  // Restore persisted selection once on mount (client only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setSelectedState(saved as CompanySelection);
  }, []);

  // Role-gated visible companies.
  const visibleCompanies = useMemo(() => {
    if (companies.length === 0) return [];
    // Owner + lab_manager: every company (Lab manager sees Lab + all bars).
    if (role === "owner" || role === "lab_manager") return companies;
    if (role === "bar_manager") {
      // Their assigned bar(s) + the Lab.
      return companies.filter(
        (c) => c.type === "lab" || assigned.includes(c.id),
      );
    }
    // staff / unknown: assigned companies only (fallback to all if none set).
    const scoped = companies.filter((c) => assigned.includes(c.id));
    return scoped.length > 0 ? scoped : companies;
  }, [companies, role, assigned]);

  // Keep the selection valid for the current role.
  useEffect(() => {
    if (visibleCompanies.length === 0) return;
    if (selected === "all") return;
    if (!visibleCompanies.some((c) => c.id === selected)) {
      setSelectedState("all");
    }
  }, [visibleCompanies, selected]);

  const setSelected = (v: CompanySelection) => {
    setSwitching(true);
    setSelectedState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v);
    }
    // Brief settle window so dependent views can show a loading state.
    window.setTimeout(() => setSwitching(false), 350);
  };

  const selectedCompany =
    selected === "all"
      ? undefined
      : companies.find((c) => c.id === selected);

  return (
    <CompanyContext.Provider
      value={{
        selected,
        setSelected,
        selectedCompany,
        visibleCompanies,
        loading: companiesLoading || assignedLoading,
        switching,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  return useContext(CompanyContext);
}