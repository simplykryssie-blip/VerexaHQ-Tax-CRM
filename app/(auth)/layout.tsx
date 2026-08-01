import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent-600 text-white">
          <ShieldCheck className="size-5" />
        </div>
        <span className="text-lg font-semibold text-foreground">
          VerexaHQ Tax CRM
        </span>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
