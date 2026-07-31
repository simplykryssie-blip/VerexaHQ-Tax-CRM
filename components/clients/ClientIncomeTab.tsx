import { DollarSign } from "lucide-react";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { titleCase } from "@/lib/utils";
import type { IntakeIncomeSource } from "@/lib/types";

function formatCurrency(amount: number | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function ClientIncomeTab({ sources }: { sources: IntakeIncomeSource[] }) {
  if (sources.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={DollarSign} title="No income sources on file" />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <Card key={source.id}>
          <CardBody className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{titleCase(source.income_type)}</p>
              <p className="text-xs text-muted">{source.payer_name || "Payer not specified"}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge
                label={source.document_received ? "Document received" : "Document pending"}
                tone={source.document_received ? "success" : "warning"}
              />
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(source.amount_estimate)}
              </span>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
