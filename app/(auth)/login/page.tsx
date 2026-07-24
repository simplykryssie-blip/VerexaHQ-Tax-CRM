import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; checkEmail?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-4">
      {params.checkEmail && (
        <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">
          Check your inbox to confirm your email, then sign in.
        </p>
      )}
      <LoginForm redirectTo={params.redirectTo} />
    </div>
  );
}
