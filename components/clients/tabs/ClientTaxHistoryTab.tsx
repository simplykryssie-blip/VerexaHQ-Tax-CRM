"use client";

import type { ClientTaxHistory } from "@/lib/types-extended";
import { Button } from "@/components/ui/LegacyButton";

interface ClientTaxHistoryTabProps {
  clientId: string;
  taxHistory: ClientTaxHistory[];
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientTaxHistoryTab({ clientId, taxHistory, workspaceId, onUpdate }: ClientTaxHistoryTabProps) {
  return (
    <div className="space-y-4">
      {taxHistory.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tax Year</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">AGI</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Refund/Owed</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">IRS Notices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {taxHistory.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{record.tax_year}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">${record.agi?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">${record.refund_amount?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{record.has_irs_notices ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No tax history records added yet.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary">Add Tax Year</Button>
      </div>
    </div>
  );
}
