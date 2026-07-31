"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePortalAccess } from "@/lib/auth/portal";
import {
  updateContactInfoSchema,
  updateMailingAddressSchema,
  type UpdateContactInfoInput,
  type UpdateMailingAddressInput,
} from "@/lib/validation/portal-profile";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

type ActionResult = { error?: string; success?: true };

export async function updateContactInfoAction(input: UpdateContactInfoInput): Promise<ActionResult> {
  const parsed = updateContactInfoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  // A dedicated SECURITY DEFINER function is used instead of a direct table
  // update because `clients` has no client-facing UPDATE policy at all
  // (RLS is row-level, not column-level, so a broad policy would let a
  // client rewrite any column) — the function only ever touches phone and
  // preferred_contact_method, after checking the caller is this client's
  // own portal user or an active portal-enabled contact.
  const { error } = await supabase.rpc("update_client_portal_contact_info", {
    p_client_id: client.client.id,
    p_phone: parsed.data.phone || "",
    p_preferred_contact_method: parsed.data.preferredContactMethod,
  });

  if (error) return { error: "We couldn't save your changes. Please try again." };

  revalidatePath("/portal/profile");
  return { success: true };
}

export async function updateMailingAddressAction(input: UpdateMailingAddressInput): Promise<ActionResult> {
  const parsed = updateMailingAddressSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_client_mailing_address", {
    p_client_id: client.client.id,
    p_line1: parsed.data.line1 || "",
    p_line2: parsed.data.line2 || "",
    p_city: parsed.data.city || "",
    p_state: parsed.data.state || "",
    p_postal_code: parsed.data.postalCode || "",
  });

  if (error) return { error: "We couldn't save your address. Please try again." };

  revalidatePath("/portal/profile");
  return { success: true };
}

export async function updatePortalPasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "We couldn't update your password. Please try again." };

  return { success: true };
}
