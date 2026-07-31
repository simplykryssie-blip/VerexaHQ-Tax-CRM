"use client";

import type { ClientEmployment } from "@/lib/types-extended";
import { Button } from "@/components/ui/Button";

interface ClientBusinessInfoTabProps {
  clientId: string;
  employment: ClientEmployment[];
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientBusinessInfoTab({ clientId, employment, workspaceId, onUpdate }: ClientBusinessInfoTabProps) {
  const businesses = employment.filter((e) => e.is_self_employed);

  return (
    <div className="space-y-4">
      {businesses.length > 0 ? (
        <div className="space-y-2">
          {businesses.map((biz) => (
            <div key={biz.id} className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900">{biz.employer_name}</h3>
              <p className="mt-1 text-sm text-gray-600">Entity Type: {biz.business_entity_type}</p>
              <p className="text-sm text-gray-600">EIN: {biz.employer_ein}</p>
              <p className="text-sm text-gray-600">NAICS: {biz.naics_code}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No business information added yet.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary">Add Business</Button>
      </div>
    </div>
  );
}
