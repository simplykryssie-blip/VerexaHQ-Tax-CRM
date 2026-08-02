import { redirect } from "next/navigation";

/**
 * Organizer templates are the "form" kind inside the canonical Templates &
 * Forms area — this used to be a second, separately-managed library over
 * the same `templates` rows. Redirecting keeps the deep link working
 * without maintaining two UIs over one source of truth.
 */
export default function OrganizerTemplatesRedirectPage() {
  redirect("/templates?kind=form");
}
