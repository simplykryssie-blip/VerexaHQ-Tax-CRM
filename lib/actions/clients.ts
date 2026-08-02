"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClientSchema, updateClientSchema, type CreateClientInput, type UpdateClientInput } from "@/lib/validation/clients";
import { STAFF_ROLES } from "@/lib/types";

type ActionResult = { error?: string };

export async function createClientAction(input: CreateClientInput): Promise<ActionResult> {
  const { workspace } = await requireWorkspace();
  if (!workspace || !STAFF_ROLES.includes(workspace.role)) {
    return { error: "You don't have permission to add clients in this workspace." };
  }

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { firstName, lastName, clientType, status, email, phone, company, notes, dateOfBirth, ssnLast4, einLast4, preferredContactMethod, source } =
    parsed.data;
  const supabase = await createClient();

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
      date_of_birth: dateOfBirth || null,
      ssn_last4: ssnLast4 || null,
      ein_last4: einLast4 || null,
      preferred_contact_method: preferredContactMethod || null,
      source: source || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "We couldn't save this client. Please try again." };
  }

  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(clientId: string, input: UpdateClientInput): Promise<ActionResult> {
  const { workspace } = await requireWorkspace();
  if (!workspace || !STAFF_ROLES.includes(workspace.role)) {
    return { error: "You don't have permission to edit clients in this workspace." };
  }

  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { firstName, lastName, clientType, status, email, phone, company, notes, dateOfBirth, ssnLast4, einLast4, preferredContactMethod, source } =
    parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      first_name: firstName,
      last_name: lastName,
      client_type: clientType,
      status,
      email: email || null,
      phone: phone || null,
      company: company || null,
      notes: notes || null,
      date_of_birth: dateOfBirth || null,
      ssn_last4: ssnLast4 || null,
      ein_last4: einLast4 || null,
      preferred_contact_method: preferredContactMethod || null,
      source: source || null,
    })
    .eq("id", clientId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) {
    return { error: "We couldn't save these changes. Please try again." };
  }

  redirect(`/clients/${clientId}`);
}
