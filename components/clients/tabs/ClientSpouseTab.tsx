"use client";

import type { ClientSpouse } from "@/lib/types-extended";
import { Button } from "@/components/ui/Button";

interface ClientSpouseTabProps {
  clientId: string;
  spouse: ClientSpouse | null;
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientSpouseTab({ clientId, spouse, workspaceId, onUpdate }: ClientSpouseTabProps) {
  return (
    <div className="space-y-4">
      {spouse ? (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900">{spouse.first_name} {spouse.last_name}</h3>
          <p className="mt-1 text-sm text-gray-600">{spouse.email}</p>
          <p className="text-sm text-gray-600">{spouse.phone}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No spouse information added yet.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary">Add/Edit Spouse</Button>
      </div>
    </div>
  );
}
