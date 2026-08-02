"use client";

import { createContext, useContext, useMemo } from "react";
import type { PermissionMap, PermissionScope } from "@/lib/permissions/granular";

type PermissionContextValue = {
  can: (key: string) => boolean;
  whyDenied: (key: string) => string | null;
  allowedScope: (key: string) => PermissionScope | null;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ permissions, children }: { permissions: PermissionMap; children: React.ReactNode }) {
  const value = useMemo<PermissionContextValue>(() => ({
    can: (key) => permissions[key]?.allowed ?? false,
    whyDenied: (key) => permissions[key]?.allowed ? null : permissions[key]?.denialReason ?? "Your role does not include this permission.",
    allowedScope: (key) => permissions[key]?.allowed ? permissions[key].scope : null,
  }), [permissions]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error("usePermissions must be used within PermissionProvider");
  return context;
}
