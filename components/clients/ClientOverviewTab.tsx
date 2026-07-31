import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { clientStatusMeta } from "@/lib/status";
import { formatDate, maskLast4, titleCase } from "@/lib/utils";
import type { Client } from "@/lib/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function ClientOverviewTab({ client }: { client: Client }) {
  const status = clientStatusMeta(client.status);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-foreground">Client overview</h2>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Status" value={<StatusBadge label={status.label} tone={status.tone} />} />
          <Field label="Client type" value={titleCase(client.client_type)} />
          <Field label="Company" value={client.company || "—"} />
          <Field label="Date of birth" value={formatDate(client.date_of_birth)} />
          <Field label="Preferred language" value={titleCase(client.preferred_language)} />
          <Field
            label="Preferred contact method"
            value={client.preferred_contact_method ? titleCase(client.preferred_contact_method) : "—"}
          />
          <Field label="SSN (last 4)" value={maskLast4(client.ssn_last4)} />
          <Field label="EIN (last 4)" value={maskLast4(client.ein_last4)} />
          <Field label="Source" value={client.source || "—"} />
          <Field label="Client since" value={formatDate(client.created_at)} />
        </dl>
        {client.notes && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{client.notes}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
