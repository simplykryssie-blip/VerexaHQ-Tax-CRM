import { Building2 } from "lucide-react";
import { SignOutButton } from "@/components/app/SignOutButton";

export function NoWorkspaceState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <Building2 className="size-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">
            No workspace access yet
          </h1>
          <p className="text-sm text-muted">
            Your account isn&apos;t an active member of any VerexaHQ Tax CRM
            workspace. Ask your firm administrator to invite you, then sign
            back in.
          </p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
