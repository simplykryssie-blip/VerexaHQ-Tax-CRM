import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export type SupabaseServerClient = ReturnType<typeof createServerClient<Database>>;

/**
 * Server Component / Server Action / Route Handler Supabase client.
 * Runs with the caller's session — all queries are still subject to RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no response to attach cookies to.
            // Session refresh is handled by middleware, so this is safe to ignore.
          }
        },
      },
    },
  );
}
