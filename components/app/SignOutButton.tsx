"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => signOutAction())}
      disabled={isPending}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-100 disabled:opacity-60",
        className,
      )}
    >
      <LogOut className="size-4" />
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
