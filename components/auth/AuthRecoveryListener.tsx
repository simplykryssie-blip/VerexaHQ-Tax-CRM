"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Defensive fallback for the password-recovery flow. The primary path is
 * server-side (app/auth/confirm/route.ts exchanges the recovery code/token
 * before any client code runs), but if the Supabase project's Site URL /
 * Redirect URLs allow-list is out of sync with the domain actually being
 * used (a real risk on Vercel Preview, whose URL changes per deployment),
 * Supabase can fall back to redirecting the browser straight to the Site
 * URL with the recovery tokens in the URL hash instead of through our
 * route. The Supabase browser client still parses that hash and fires
 * PASSWORD_RECOVERY — this listener just makes sure that always lands the
 * user on /reset-password instead of wherever the bare redirect happened
 * to point (commonly /login, since no cookie session exists yet).
 */
export function AuthRecoveryListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && pathname !== "/reset-password") {
        router.replace("/reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}
