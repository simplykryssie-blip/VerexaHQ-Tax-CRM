import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Contact } from "lucide-react";
import { titleCase } from "@/lib/utils";
import type { ClientAddress, ClientContact } from "@/lib/types";

export function ClientContactTab({
  contacts,
  addresses,
}: {
  contacts: ClientContact[];
  addresses: ClientAddress[];
}) {
  if (contacts.length === 0 && addresses.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={Contact} title="No contact information on file" />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {contacts.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Contacts</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || titleCase(contact.contact_type)}
                    {contact.is_primary && (
                      <span className="ml-2 text-xs font-normal text-accent-700">Primary</span>
                    )}
                  </p>
                  <span className="text-xs text-muted">{titleCase(contact.contact_type)}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted sm:grid-cols-2">
                  <p>{contact.email || "No email"}</p>
                  <p>{contact.phone || "No phone"}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {addresses.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Addresses</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-lg border border-border p-4 text-sm text-foreground">
                <p className="font-medium">
                  {titleCase(address.address_type)}
                  {address.is_primary && <span className="ml-2 text-xs font-normal text-accent-700">Primary</span>}
                </p>
                <p className="mt-1 text-muted">
                  {[address.line1, address.line2, address.city, address.state, address.postal_code]
                    .filter(Boolean)
                    .join(", ") || "No address on file"}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
