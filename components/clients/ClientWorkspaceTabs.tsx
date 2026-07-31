"use client";

import { useState } from "react";
import type { ClientDetailExtended } from "@/lib/types-extended";
import { Tabs } from "@/components/ui/TabSwitcher";
import { ClientPersonalInfoTab } from "./tabs/ClientPersonalInfoTab";
import { ClientSpouseTab } from "./tabs/ClientSpouseTab";
import { ClientDependentsTab } from "./tabs/ClientDependentsTab";
import { ClientIncomeEmploymentTab } from "./tabs/ClientIncomeEmploymentTab";
import { ClientBusinessInfoTab } from "./tabs/ClientBusinessInfoTab";
import { ClientBankingTab } from "./tabs/ClientBankingTab";
import { ClientTaxHistoryTab } from "./tabs/ClientTaxHistoryTab";
import { ClientFirmServiceTab } from "./tabs/ClientFirmServiceTab";

export interface ClientWorkspaceTabsProps {
  clientDetail: ClientDetailExtended;
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientWorkspaceTabs({ clientDetail, workspaceId, onUpdate }: ClientWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState("personal");

  const tabs = [
    {
      id: "personal",
      label: "Personal Info",
      content: <ClientPersonalInfoTab client={clientDetail.client} workspaceId={workspaceId} onUpdate={onUpdate} />,
    },
    ...(clientDetail.client.filing_status === "mfj" || clientDetail.client.filing_status === "mfs"
      ? [
          {
            id: "spouse",
            label: "Spouse",
            content: (
              <ClientSpouseTab
                clientId={clientDetail.client.id}
                spouse={clientDetail.spouse}
                workspaceId={workspaceId}
                onUpdate={onUpdate}
              />
            ),
          },
        ]
      : []),
    {
      id: "dependents",
      label: "Dependents",
      content: (
        <ClientDependentsTab
          clientId={clientDetail.client.id}
          dependents={clientDetail.dependents}
          workspaceId={workspaceId}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      id: "income",
      label: "Income & Employment",
      content: (
        <ClientIncomeEmploymentTab
          clientId={clientDetail.client.id}
          employment={clientDetail.employment}
          workspaceId={workspaceId}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      id: "business",
      label: "Business Info",
      content: (
        <ClientBusinessInfoTab
          clientId={clientDetail.client.id}
          employment={clientDetail.employment}
          workspaceId={workspaceId}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      id: "banking",
      label: "Banking",
      content: (
        <ClientBankingTab
          clientId={clientDetail.client.id}
          banking={clientDetail.banking}
          workspaceId={workspaceId}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      id: "taxhistory",
      label: "Tax History",
      content: (
        <ClientTaxHistoryTab
          clientId={clientDetail.client.id}
          taxHistory={clientDetail.taxHistory}
          workspaceId={workspaceId}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      id: "firm",
      label: "Firm & Service",
      content: (
        <ClientFirmServiceTab client={clientDetail.client} workspaceId={workspaceId} onUpdate={onUpdate} />
      ),
    },
  ];

  return <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
}
