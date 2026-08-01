import { ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { validationSeverityMeta } from "@/lib/status";
import { formatRelativeTime } from "@/lib/utils";
import type { IntakeValidationResult } from "@/lib/types";

export function IntakeValidationTab({ results }: { results: IntakeValidationResult[] }) {
  if (results.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={ShieldCheck}
            title="No validation results yet"
            description="Run validation from the actions panel to check this intake for issues."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="divide-y divide-border p-0">
        {results.map((result) => {
          const severity = validationSeverityMeta(result.severity);
          return (
            <div key={result.id} className="flex items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{result.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {result.code} · {formatRelativeTime(result.created_at)}
                </p>
              </div>
              <StatusBadge
                label={result.is_resolved ? "Resolved" : severity.label}
                tone={result.is_resolved ? "success" : severity.tone}
              />
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
