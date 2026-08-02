import { redirect } from "next/navigation";

/** See app/(app)/settings/organizers/page.tsx — same template rows, one
 * canonical detail view now. */
export default async function OrganizerTemplateDetailRedirectPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  redirect(`/templates/${templateId}`);
}
