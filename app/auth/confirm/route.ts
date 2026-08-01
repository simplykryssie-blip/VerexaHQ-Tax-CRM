import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
  "phone_change",
  "reauthentication",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = getEmailOtpType(searchParams.get("type"));
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if ((!tokenHash && !code) || (tokenHash && !type)) {
    return recoveryLinkError(request);
  }

  const destination = type === "recovery" ? "/reset-password" : next;
  const response = NextResponse.redirect(new URL(destination, request.url));
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options as CookieOptions);
          }
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    return recoveryLinkError(request);
  }

  return response;
}

function getEmailOtpType(type: string | null): EmailOtpType | null {
  if (!type || !EMAIL_OTP_TYPES.has(type as EmailOtpType)) {
    return null;
  }
  return type as EmailOtpType;
}

function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

function recoveryLinkError(request: NextRequest) {
  const errorUrl = new URL("/forgot-password", request.url);
  errorUrl.searchParams.set("error", "recovery_link_invalid");
  return NextResponse.redirect(errorUrl);
}
