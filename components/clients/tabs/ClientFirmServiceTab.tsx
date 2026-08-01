"use client";

import type { Client } from "@/lib/types";
import { titleCase } from "@/lib/utils";

interface ClientFirmServiceTabProps {
  client: Client;
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientFirmServiceTab({ client, workspaceId, onUpdate }: ClientFirmServiceTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-700">Status</p>
          <p className="mt-1 text-sm text-gray-900">{titleCase(client.status)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Client Since</p>
          <p className="mt-1 text-sm text-gray-900">{client.client_since || "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-700">Service Package</p>
          <p className="mt-1 text-sm text-gray-900">{client.service_package || "—"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Referral Source</p>
          <p className="mt-1 text-sm text-gray-900">{client.referral_source || "—"}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700">Notes</p>
        <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{client.notes || "—"}</p>
      </div>
    </div>
  );
}
