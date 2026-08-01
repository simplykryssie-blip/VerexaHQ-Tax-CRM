import { MessageSquare } from "lucide-react";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { intakeAnswerStatusMeta } from "@/lib/status";
import type { FormField, IntakeAnswer } from "@/lib/types";

function renderAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function IntakeAnswersTab({
  answers,
}: {
  answers: (IntakeAnswer & { field: FormField | null })[];
}) {
  if (answers.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={MessageSquare} title="No answers recorded yet" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="divide-y divide-border p-0">
        {answers.map((answer) => {
          const status = intakeAnswerStatusMeta(answer.status);
          return (
            <div key={answer.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {answer.field?.label || answer.field_key}
                </p>
                <StatusBadge label={status.label} tone={status.tone} />
              </div>
              <p className="mt-1 text-sm text-muted">{renderAnswerValue(answer.answer_value)}</p>
              {answer.clarification_message && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {answer.clarification_message}
                </p>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
