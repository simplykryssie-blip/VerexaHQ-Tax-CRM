import { redirect } from "next/navigation";
import { resolveHomePath } from "@/lib/auth/portal";

export default async function RootPage() {
  redirect(await resolveHomePath());
}
