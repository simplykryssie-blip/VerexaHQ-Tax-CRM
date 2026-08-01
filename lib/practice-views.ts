import type { MembershipRole, Workspace } from "@/lib/types";

export type PracticeView = "ptin" | "ero" | "service_bureau";

export const PRACTICE_VIEW_LABELS: Record<PracticeView, string> = {
  ptin: "My client work",
  ero: "Tax office",
  service_bureau: "Service Bureau network",
};

export const PRACTICE_VIEW_HOME: Record<PracticeView, string> = {
  ptin: "/ptin",
  ero: "/ero",
  service_bureau: "/service-bureau",
};

export function practiceViewsForWorkspace(
  workspaceType: Workspace["workspace_type"],
  role: MembershipRole,
): PracticeView[] {
  if (workspaceType === "platform_admin") return ["service_bureau"];

  if (workspaceType === "independent_ptin") return ["ptin"];

  if (workspaceType === "ero_office") {
    if (["owner", "admin"].includes(role)) return ["ero", "ptin"];
    if (["ero", "reviewer"].includes(role)) return ["ero"];
    return ["ptin"];
  }

  if (["owner", "admin"].includes(role)) {
    return ["service_bureau", "ero", "ptin"];
  }

  return role === "ero" || role === "reviewer" ? ["ero"] : ["ptin"];
}

export function defaultPracticeView(
  workspaceType: Workspace["workspace_type"],
  role: MembershipRole,
): PracticeView {
  return practiceViewsForWorkspace(workspaceType, role)[0] ?? "ptin";
}
