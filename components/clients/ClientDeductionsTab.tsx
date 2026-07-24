import { Receipt } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { titleCase } from "@/lib/utils";
import type { IntakeDeductionCredit } from "@/lib/types";

function formatCurrency(amount: number | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function ClientDeductionsTab({ items }: { items: IntakeDeductionCredit[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={Receipt} title="No deductions or credits on file" />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardBody className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{titleCase(item.item_type)}</p>
            <div className="flex items-center gap-3">
              <StatusBadge
                label={item.document_received ? "Document received" : "Document pending"}
                tone={item.document_received ? "success" : "warning"}
              />
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(item.amount_estimate)}
              </span>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
