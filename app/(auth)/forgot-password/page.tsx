import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-4">
      {params.error === "recovery_link_invalid" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          This password-reset link is invalid or has expired. Please request a new email.
        </p>
      )}
      <ForgotPasswordForm />
    </div>
  );
}
