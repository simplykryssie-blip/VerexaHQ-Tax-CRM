import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Client, ClientAddress } from "@/lib/types";

export type PortalProfile = {
  client: Client;
  mailingAddress: ClientAddress | null;
};

export async function getPortalProfile(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalProfile | null> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) return null;

  const { data: address } = await supabase
    .from("client_addresses")
    .select("*")
    .eq("client_id", clientId)
    .eq("address_type", "mailing")
    .maybeSingle();

  return { client, mailingAddress: address ?? null };
}
