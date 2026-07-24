import Link from "next/link";
import { UserRound } from "lucide-react";
import { SignOutButton } from "@/components/app/SignOutButton";

export function PortalNotLinkedState({ hasStaffAccess = false }: { hasStaffAccess?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <UserRound className="size-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">
            No client account linked
          </h1>
          <p className="text-sm text-muted">
            We couldn&apos;t find a client record linked to your sign-in.
            Please contact your tax office so they can grant your account
            portal access.
          </p>
        </div>
        {hasStaffAccess && (
          <Link href="/dashboard" className="text-sm font-medium text-accent-700 hover:underline">
            Go to your staff dashboard instead
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
