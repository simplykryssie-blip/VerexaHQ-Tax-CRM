"use client";

import { useEffect } from "react";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

export default function PortalSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal section error:", error.digest ?? error.message);
  }, [error]);

  return (
    <PortalErrorState
      title="We couldn't load this page"
      description="An unexpected error occurred. Please try again."
      onRetry={reset}
    />
  );
}
