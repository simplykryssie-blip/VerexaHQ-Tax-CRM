"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyClientLinks, CLIENT_COOKIE } from "@/lib/auth/portal";

export async function switchClientAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");

  // Never trust the posted ID on its own — confirm it's one of the user's
  // own linked clients before switching the cookie.
  const links = await listMyClientLinks();
  const match = links.find((l) => l.client.id === clientId);
  if (!match) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(CLIENT_COOKIE, match.client.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/portal/dashboard");
}
