import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedUserStatus = "active" | "disabled" | "pending";

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "staff";
  status: ManagedUserStatus;
  last_login: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOwner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_owner", {
    _user_id: context.userId,
  });
  if (data !== true) throw new Error("Forbidden: owners only");
}

async function logAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  entry: {
    action: string;
    admin_id: string;
    admin_email?: string | null;
    target_id?: string | null;
    target_email?: string | null;
    status?: string;
    detail?: string | null;
  },
) {
  try {
    await admin.from("audit_logs").insert({ status: "success", ...entry });
  } catch {
    /* ignore audit failures */
  }
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw error;

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p]),
    );
    const roleMap = new Map<string, "owner" | "staff">();
    for (const r of roles ?? []) {
      const existing = roleMap.get(r.user_id);
      if (r.role === "owner" || !existing) roleMap.set(r.user_id, r.role);
    }

    return list.users.map((u) => {
      const banned =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u as any).banned_until &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Date((u as any).banned_until).getTime() > Date.now();
      const status: ManagedUserStatus = banned
        ? "disabled"
        : u.email_confirmed_at
          ? "active"
          : "pending";
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? profile?.email ?? "",
        full_name:
          profile?.full_name ??
          (u.user_metadata?.full_name as string) ??
          u.email ??
          "",
        role: roleMap.get(u.id) ?? "staff",
        status,
        last_login: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      };
    });
  });

export const inviteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        fullName: z.string().trim().max(120).optional(),
        role: z.enum(["owner", "staff"]),
        redirectTo: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: invited, error } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: data.redirectTo,
        data: { full_name: data.fullName || data.email },
      });
    if (error) throw error;
    const newUser = invited.user;
    // Ensure role assignment (handle_new_user may default to staff).
    if (newUser) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", newUser.id);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.id, role: data.role });
    }
    await logAudit(supabaseAdmin, {
      action: "invite_user",
      admin_id: context.userId,
      admin_email: (context.claims?.email as string) ?? null,
      target_id: newUser?.id ?? null,
      target_email: data.email,
      detail: `role=${data.role}`,
    });
    return { ok: true };
  });

export const setManagedUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["owner", "staff"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw error;
    await logAudit(supabaseAdmin, {
      action: "change_role",
      admin_id: context.userId,
      admin_email: (context.claims?.email as string) ?? null,
      target_id: data.userId,
      detail: `role=${data.role}`,
    });
    return { ok: true };
  });

export const setManagedUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        disabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.userId === context.userId)
      throw new Error("You cannot disable your own account");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ban_duration: data.disabled ? "876000h" : "none" } as any,
    );
    if (error) throw error;
    await logAudit(supabaseAdmin, {
      action: data.disabled ? "disable_user" : "enable_user",
      admin_id: context.userId,
      admin_email: (context.claims?.email as string) ?? null,
      target_id: data.userId,
    });
    return { ok: true };
  });

export const resetManagedUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        userId: z.string().uuid(),
        redirectTo: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { createClient } = await import("@supabase/supabase-js");
    const publicClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await publicClient.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await logAudit(supabaseAdmin, {
      action: "reset_password",
      admin_id: context.userId,
      admin_email: (context.claims?.email as string) ?? null,
      target_id: data.userId,
      target_email: data.email,
    });
    return { ok: true };
  });

export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), email: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.userId === context.userId)
      throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    await logAudit(supabaseAdmin, {
      action: "delete_user",
      admin_id: context.userId,
      admin_email: (context.claims?.email as string) ?? null,
      target_id: data.userId,
      target_email: data.email ?? null,
    });
    return { ok: true };
  });