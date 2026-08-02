import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, requireAuthUser } from "@/lib/auth/session";
import { listMyWorkspaces } from "@/lib/auth/workspace";
import type { Client } from "@/lib/types";

export const CLIENT_COOKIE = "verexa-client-id";

export type ClientLink = {
  client: Client;
  linkType: "primary" | "contact";
  contactId: string | null;
};

/**
 * Every client record the current user can act as, resolved strictly from
 * clients.portal_user_id (primary taxpayer) and client_contacts.auth_user_id
 * (an additional contact explicitly granted can_access_portal) — never from
 * a client-supplied ID. A single user can be linked to more than one client
 * (e.g. an authorized contact on a household member's return, or the
 * taxpayer on both an individual and a business client record).
 */
export const listMyClientLinks = cache(async (): Promise<ClientLink[]> => {
  const user = await getAuthUser();
  if (!user) return [];

  const supabase = await createClient();

  const [primaryResult, contactResult] = await Promise.all([
    supabase.from("clients").select("*").eq("portal_user_id", user.id),
    supabase
      .from("client_contacts")
      .select("id, client:clients(*)")
      .eq("auth_user_id", user.id)
      .eq("can_access_portal", true)
      .eq("is_active", true),
  ]);

  const links = new Map<string, ClientLink>();

  for (const client of primaryResult.data ?? []) {
    links.set(client.id, { client, linkType: "primary", contactId: null });
  }

  for (const row of contactResult.data ?? []) {
    const client = (row as unknown as { client: Client | null }).client;
    if (client && !links.has(client.id)) {
      links.set(client.id, { client, linkType: "contact", contactId: row.id });
    }
  }

  return Array.from(links.values());
});

/**
 * Resolves the "current" client for this request: the client named by the
 * verexa-client-id cookie IF the user is still linked to it, otherwise the
 * user's first linked client.
 */
export const getCurrentClientLink = cache(async (): Promise<ClientLink | null> => {
  const links = await listMyClientLinks();
  if (links.length === 0) return null;

  const cookieStore = await cookies();
  const preferredId = cookieStore.get(CLIENT_COOKIE)?.value;

  const preferred = preferredId ? links.find((l) => l.client.id === preferredId) : undefined;
  return preferred ?? links[0];
});

export type RequirePortalResult = {
  user: NonNullable<Awaited<ReturnType<typeof requireAuthUser>>>;
  client: ClientLink | null;
  links: ClientLink[];
};

export async function requirePortalAccess(): Promise<RequirePortalResult> {
  const user = await requireAuthUser();
  const [client, links] = await Promise.all([getCurrentClientLink(), listMyClientLinks()]);
  return { user, client, links };
}

export type AccountType = "staff" | "client" | "none";

/**
 * Determines where an authenticated user should land. A user who is both an
 * active workspace staff member AND a linked portal client is treated as
 * staff by default (documented priority) — the staff dashboard is the safer
 * default surface, and staff can be given a client-context link explicitly
 * if they need to view the portal. This never trusts anything from the
 * request other than the authenticated user id.
 */
export async function resolveAccountType(): Promise<AccountType> {
  const memberships = await listMyWorkspaces();
  if (memberships.length > 0) return "staff";

  const links = await listMyClientLinks();
  if (links.length > 0) return "client";

  return "none";
}

export async function resolveHomePath(): Promise<string> {
  const type = await resolveAccountType();
  if (type === "client") return "/portal/dashboard";
  // "staff" and "none" both land on /dashboard — a user with neither a
  // workspace membership nor a client link sees NoWorkspaceState there
  // rather than a separate dead-end route.
  return "/dashboard";
}
