import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { clientStatusMeta } from "@/lib/status";
import { clientDisplayName, formatRelativeTime } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function RecentClientsCard({ clients }: { clients: Client[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Recent clients</h2>
        <Link href="/clients" className="text-sm text-accent-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardBody className="p-0">
        {clients.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Users} title="No clients yet" description="Add your first client to get started." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {clients.map((client) => {
              const status = clientStatusMeta(client.status);
              return (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent-50/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {clientDisplayName(client)}
                      </p>
                      <p className="truncate text-xs text-muted">{client.email || "No email"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge label={status.label} tone={status.tone} />
                      <span className="text-xs text-muted">{formatRelativeTime(client.created_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
