"use client";

import type { ClientEmployment } from "@/lib/types-extended";
import { Button } from "@/components/ui/Button";

interface ClientIncomeEmploymentTabProps {
  clientId: string;
  employment: ClientEmployment[];
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientIncomeEmploymentTab({ clientId, employment, workspaceId, onUpdate }: ClientIncomeEmploymentTabProps) {
  return (
    <div className="space-y-4">
      {employment.length > 0 ? (
        <div className="space-y-2">
          {employment.map((emp) => (
            <div key={emp.id} className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900">{emp.employer_name}</h3>
              <p className="mt-1 text-sm text-gray-600">Income Type: {emp.income_type}</p>
              <p className="text-sm text-gray-600">EIN: {emp.employer_ein}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No employment information added yet.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary">Add Employment</Button>
      </div>
    </div>
  );
}
