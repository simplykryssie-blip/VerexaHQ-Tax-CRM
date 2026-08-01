import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refreshes the Supabase session on every request and redirects unauthenticated
 * users away from protected routes. Must run in middleware.ts for every route
 * that renders authenticated data — see https://supabase.com/docs/guides/auth/server-side/nextjs.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    // Staff land on /dashboard, portal-only clients on /portal/dashboard; a
    // user with neither also goes to /dashboard, which renders
    // NoWorkspaceState rather than a dead-end route. See
    // lib/auth/portal.ts#resolveHomePath for the full (server-only) logic —
    // duplicated minimally here since middleware can't reuse React `cache()`.
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    let destination = "/dashboard";
    if (!membership) {
      const { data: primaryClient } = await supabase
        .from("clients")
        .select("id")
        .eq("portal_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (primaryClient) {
        destination = "/portal/dashboard";
      } else {
        const { data: contactClient } = await supabase
          .from("client_contacts")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("can_access_portal", true)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (contactClient) destination = "/portal/dashboard";
      }
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANT: return supabaseResponse as-is so refreshed auth cookies persist.
  return supabaseResponse;
}
