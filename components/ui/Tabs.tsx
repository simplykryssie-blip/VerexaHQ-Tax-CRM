"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TabDefinition = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export function Tabs({ tabs, defaultTab }: { tabs: TabDefinition[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab.id === activeTab?.id
                ? "border-accent-600 text-accent-700"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-5">{activeTab?.content}</div>
    </div>
  );
}
