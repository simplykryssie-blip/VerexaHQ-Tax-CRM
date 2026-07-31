import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client. SERVER-ONLY — bypasses RLS entirely.
 *
 * Never import this module from a Client Component or anything that ends up
 * in a browser bundle. Only use it for operations that genuinely require
 * bypassing row-level security (e.g. admin provisioning triggered server-side).
 * Ordinary staff-facing reads/writes must go through lib/supabase/server.ts
 * so RLS stays the primary security boundary.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
