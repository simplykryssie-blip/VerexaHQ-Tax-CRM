"use server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClientSchema, type CreateClientInput } from "@/lib/validation/clients";
import { STAFF_ROLES } from "@/lib/types";
import { defaultReviewerFor, listWorkspaceStaff } from "@/lib/data/users";

type ActionResult = { error?: string; clientId?: string; next?: "client" | "engagement" };

export async function createClientAction(input: CreateClientInput): Promise<ActionResult> {
  const { workspace, user } = await requireWorkspace();
  if (!workspace || !STAFF_ROLES.includes(workspace.role)) {
    return { error: "You don't have permission to add clients in this workspace." };
  }

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { firstName, lastName, clientType, setupMode, email, phone, company, notes } = parsed.data;
  const supabase = await createClient();
  const staff = await listWorkspaceStaff(supabase, workspace.workspace.id);
  const reviewerId = defaultReviewerFor(staff, user.id, workspace.role);
  const status = setupMode === "lead" ? "lead" : "active";

  const { data, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: workspace.workspace.id,
      first_name: firstName,
      last_name: lastName,
      client_type: clientType,
      status,
      email: email || null,
      phone: phone || null,
      company: company || null,
      notes: notes || null,
      assigned_reviewer_user_id: reviewerId,
      ero_user_id: workspace.role === "preparer" ? reviewerId : user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "We couldn't save this client. Please try again." };
  }

  return {
    clientId: data.id,
    next: setupMode === "active_with_engagement" ? "engagement" : "client",
  };
}
