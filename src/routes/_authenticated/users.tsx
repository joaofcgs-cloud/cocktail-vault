import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  listManagedUsers,
  inviteManagedUser,
  setManagedUserRole,
  setManagedUserDisabled,
  resetManagedUserPassword,
  deleteManagedUser,
  type ManagedUser,
} from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  KeyRound,
  Trash2,
  Ban,
  CircleCheck,
  Download,
  Search,
  ArrowUpDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [{ title: "User Management — Imprensa Bar Command Center" }],
  }),
  component: UsersPage,
});

interface AuditRow {
  id: string;
  action: string;
  admin_email: string | null;
  target_email: string | null;
  target_id: string | null;
  status: string;
  created_at: string;
}

const PAGE_SIZE = 8;

function statusBadge(status: ManagedUser["status"]) {
  if (status === "active")
    return <Badge className="bg-green/15 text-green hover:bg-green/15">Active</Badge>;
  if (status === "disabled")
    return <Badge variant="secondary">Disabled</Badge>;
  return (
    <Badge className="bg-orange/15 text-orange hover:bg-orange/15">
      Pending Verification
    </Badge>
  );
}

function UsersPage() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Owner-only guard (UI level; server fns also enforce).
  useEffect(() => {
    if (role && role !== "owner") navigate({ to: "/" });
  }, [role, navigate]);

  const fetchUsers = useServerFn(listManagedUsers);
  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => fetchUsers(),
    enabled: role === "owner",
  });

  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data } = await db
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as AuditRow[];
    },
    enabled: role === "owner",
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"full_name" | "last_login">("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    let list = usersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    if (statusFilter !== "all")
      list = list.filter((u) => u.status === statusFilter);
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "full_name")
        cmp = a.full_name.localeCompare(b.full_name);
      else
        cmp =
          (a.last_login ? Date.parse(a.last_login) : 0) -
          (b.last_login ? Date.parse(b.last_login) : 0);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [usersQuery.data, search, statusFilter, roleFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [search, statusFilter, roleFilter]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ManagedUser | null>(null);

  const roleFn = useServerFn(setManagedUserRole);
  const disableFn = useServerFn(setManagedUserDisabled);
  const resetFn = useServerFn(resetManagedUserPassword);
  const deleteFn = useServerFn(deleteManagedUser);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  }

  async function run<T>(id: string, fn: () => Promise<T>, ok: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const header = ["Name", "Email", "Role", "Status", "Last Login"];
    const lines = rows.map((u) =>
      [
        u.full_name,
        u.email,
        u.role,
        u.status,
        u.last_login ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmtDate = (v: string | null) =>
    v
      ? new Date(v).toLocaleString("en-IE", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Never";

  if (role !== "owner") return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members, roles and access
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Invite New User
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="h-10 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-10 gap-2"
            onClick={() => {
              setSortKey((k) => (k === "full_name" ? "last_login" : "full_name"));
              setSortAsc(true);
            }}
          >
            <ArrowUpDown className="h-4 w-4" />
            {sortKey === "full_name" ? "Name" : "Last login"}
          </Button>
        </div>

        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
          </div>
        ) : usersQuery.isError ? (
          <p className="py-10 text-center text-sm text-red">
            Could not load users.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((u) => {
                  const isSelf = u.id === user?.id;
                  const busy = busyId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          disabled={busy || isSelf}
                          onValueChange={(v) =>
                            run(
                              u.id,
                              () =>
                                roleFn({
                                  data: {
                                    userId: u.id,
                                    role: v as "owner" | "staff",
                                  },
                                }),
                              "Role updated",
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{statusBadge(u.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(u.last_login)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Send password reset email"
                            disabled={busy}
                            onClick={() =>
                              run(
                                u.id,
                                () =>
                                  resetFn({
                                    data: {
                                      email: u.email,
                                      userId: u.id,
                                      redirectTo: `${window.location.origin}/reset-password`,
                                    },
                                  }),
                                "Reset email sent",
                              )
                            }
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={
                              u.status === "disabled" ? "Enable" : "Disable"
                            }
                            disabled={busy || isSelf}
                            onClick={() =>
                              run(
                                u.id,
                                () =>
                                  disableFn({
                                    data: {
                                      userId: u.id,
                                      disabled: u.status !== "disabled",
                                    },
                                  }),
                                u.status === "disabled"
                                  ? "User enabled"
                                  : "User disabled",
                              )
                            }
                          >
                            {u.status === "disabled" ? (
                              <CircleCheck className="h-4 w-4 text-green" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            disabled={busy || isSelf}
                            onClick={() => setConfirmDelete(u)}
                          >
                            <Trash2 className="h-4 w-4 text-red" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{rows.length} user(s)</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-bold">Audit Log</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditQuery.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(a.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.action.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.admin_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.target_email ?? a.target_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        a.status === "success"
                          ? "bg-green/15 text-green hover:bg-green/15"
                          : "bg-red/15 text-red hover:bg-red/15"
                      }
                    >
                      {a.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(auditQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No activity yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onDone={refresh}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {confirmDelete?.email}. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red text-white hover:bg-red/90"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (target)
                  run(
                    target.id,
                    () =>
                      deleteFn({
                        data: { userId: target.id, email: target.email },
                      }),
                    "User deleted",
                  );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");
  const [busy, setBusy] = useState(false);
  const inviteFn = useServerFn(inviteManagedUser);

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await inviteFn({
        data: {
          email: email.trim(),
          fullName: name.trim() || undefined,
          role,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      toast.success("Invitation sent");
      setName("");
      setEmail("");
      setRole("staff");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Name</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Barman"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@bar.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "owner" | "staff")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}