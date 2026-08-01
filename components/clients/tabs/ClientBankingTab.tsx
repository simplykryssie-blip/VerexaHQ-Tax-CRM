"use client";

import type { ClientBanking } from "@/lib/types-extended";
import { Button } from "@/components/ui/LegacyButton";

interface ClientBankingTabProps {
  clientId: string;
  banking: ClientBanking[];
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientBankingTab({ clientId, banking, workspaceId, onUpdate }: ClientBankingTabProps) {
  const primaryBank = banking.find((b) => b.is_primary);

  return (
    <div className="space-y-4">
      {banking.length > 0 ? (
        <div className="space-y-2">
          {banking.map((bank) => (
            <div key={bank.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{bank.bank_name}</h3>
                {bank.is_primary && <span className="text-xs font-semibold text-blue-600">PRIMARY</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">Account Type: {bank.account_type}</p>
              <p className="text-sm text-gray-600">Routing: {bank.routing_number}</p>
              <p className="text-sm text-gray-600">Account: ••••{bank.account_number?.slice(-4)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No banking information added yet.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary">Add Bank Account</Button>
      </div>
    </div>
  );
}
