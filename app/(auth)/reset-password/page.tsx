import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">This link is invalid or has expired</h1>
        <p className="text-sm text-muted">
          Password-reset links can only be used once and expire after a short time. Request a new one to
          continue.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm />;
}
