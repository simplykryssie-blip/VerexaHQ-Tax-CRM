"use client";

import type { ClientDependent } from "@/lib/types-extended";
import { Button } from "@/components/ui/LegacyButton";

interface ClientDependentsTabProps {
  clientId: string;
  dependents: ClientDependent[];
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientDependentsTab({ clientId, dependents, workspaceId, onUpdate }: ClientDependentsTabProps) {
  return (
    <div className="space-y-4">
      {dependents.length > 0 ? (
        <div className="space-y-2">
          {dependents.map((dep) => (
            <div key={dep.id} className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900">{dep.first_name} {dep.last_name}</h3>
              <p className="mt-1 text-sm text-gray-600">Relationship: {dep.relationship}</p>
              <p className="text-sm text-gray-600">DOB: {dep.date_of_birth}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No dependents added yet.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary">Add Dependent</Button>
      </div>
    </div>
  );
}
