import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/LegacyButton";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon={FileQuestion}
          title="Page not found"
          description="The page you're looking for doesn't exist or you may not have access to it."
          action={
            <Link href="/dashboard">
              <Button size="sm">Go to dashboard</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
