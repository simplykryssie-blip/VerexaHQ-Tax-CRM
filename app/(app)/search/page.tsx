import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { globalSearch } from "@/lib/data/search";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Search } from "lucide-react";
import Link from "next/link";
import { clientDisplayName, titleCase } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { q } = await searchParams;
  const supabase = await createClient();
  const results = await globalSearch(supabase, workspace.workspace.id, q ?? "");

  const hasResults =
    results.clients.length > 0 ||
    results.engagements.length > 0 ||
    results.intakes.length > 0 ||
    results.documents.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Results"
        description={q ? `Results for "${q}"` : "Enter a search term"}
      />

      {!q || !hasResults ? (
        <Card className="p-12">
          <EmptyState
            icon={Search}
            title="No results found"
            description={
              q
                ? "We couldn't find anything matching your search."
                : "Enter a search term in the global search bar to get started."
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {results.clients.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Clients</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.clients.map((client) => (
                  <Link key={client.id} href={`/clients/${client.id}`}>
                    <Card className="p-4 hover:border-accent-500 transition-colors">
                      <p className="font-medium text-foreground">{clientDisplayName(client)}</p>
                      <p className="text-sm text-muted">{client.company || client.email || "No details"}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.engagements.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Engagements</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.engagements.map((engagement) => (
                  <Link key={engagement.id} href={`/intakes/${engagement.id}`}>
                    <Card className="p-4 hover:border-accent-500 transition-colors">
                      <p className="font-medium text-foreground">
                        {titleCase(engagement.engagement_type)}
                      </p>
                      <p className="text-sm text-muted">
                        Client: {clientDisplayName(engagement.client)}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.intakes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Intakes</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.intakes.map((intake) => (
                  <Link key={intake.id} href={`/intakes/${intake.id}`}>
                    <Card className="p-4 hover:border-accent-500 transition-colors">
                      <p className="font-medium text-foreground">
                        Tax Year: {intake.tax_year || "N/A"}
                      </p>
                      <p className="text-sm text-muted">
                        Status: {titleCase(intake.status)}
                      </p>
                      <p className="text-xs text-muted">
                        Client: {clientDisplayName(intake.client)}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.documents.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Documents</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.documents.map((doc) => (
                  <Link key={doc.id} href={`/document-requests/${doc.id}`}>
                    <Card className="p-4 hover:border-accent-500 transition-colors">
                      <p className="font-medium text-foreground">{doc.title}</p>
                      <p className="text-sm text-muted">
                        Client: {clientDisplayName(doc.client)}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
