"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyWorkspaces, WORKSPACE_COOKIE } from "@/lib/auth/workspace";

export async function switchWorkspaceAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");

  // Never trust the posted ID on its own — confirm it's one of the user's
  // own active memberships before switching the cookie.
  const memberships = await listMyWorkspaces();
  const match = memberships.find((m) => m.workspace.id === workspaceId);
  if (!match) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, match.workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
