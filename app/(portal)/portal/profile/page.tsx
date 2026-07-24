import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalProfile } from "@/lib/data/portal-profile";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ContactInfoForm } from "@/components/portal/profile/ContactInfoForm";
import { MailingAddressForm } from "@/components/portal/profile/MailingAddressForm";
import { PasswordForm } from "@/components/portal/profile/PasswordForm";
import { clientDisplayName, titleCase } from "@/lib/utils";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalProfilePage() {
  const { user, client, links } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const profile = await getPortalProfile(supabase, client.client.id);
  if (!profile) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <PortalPageHeader title="Profile" description="Your account information." />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Overview</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Name</dt>
              <dd className="mt-1 text-sm text-foreground">{clientDisplayName(profile.client)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
              <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Taxpayer / entity type</dt>
              <dd className="mt-1 text-sm text-foreground">{titleCase(profile.client.client_type)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Portal status</dt>
              <dd className="mt-1">
                <StatusBadge label={titleCase(profile.client.portal_status)} tone="success" />
              </dd>
            </div>
          </dl>

          {links.length > 1 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Linked accounts</p>
              <ul className="mt-1 space-y-1">
                {links.map((link) => (
                  <li key={link.client.id} className="text-sm text-foreground">
                    {clientDisplayName(link.client)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Contact information</h2>
        </CardHeader>
        <CardBody>
          <ContactInfoForm client={profile.client} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Mailing address</h2>
        </CardHeader>
        <CardBody>
          <MailingAddressForm address={profile.mailingAddress} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Password</h2>
        </CardHeader>
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
