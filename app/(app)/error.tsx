"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application section error:", error.digest ?? error.message);
  }, [error]);

  return (
    <ErrorState
      title="We couldn't load this page"
      description="An unexpected error occurred while loading this data. Please try again."
      onRetry={reset}
    />
  );
}
