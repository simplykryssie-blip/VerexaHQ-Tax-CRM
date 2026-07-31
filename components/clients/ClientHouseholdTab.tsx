import { Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { titleCase } from "@/lib/utils";
import type { IntakeHouseholdPerson } from "@/lib/types";

export function ClientHouseholdTab({ people }: { people: IntakeHouseholdPerson[] }) {
  if (people.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={Users} title="No household members on file" description="Household data appears here once an intake is submitted." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {people.map((person) => (
        <Card key={person.id}>
          <CardBody>
            <p className="text-sm font-medium text-foreground">
              {[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || "Unnamed"}
              {person.suffix ? ` ${person.suffix}` : ""}
            </p>
            <p className="text-xs text-muted">{titleCase(person.person_role)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>
                <dt className="uppercase tracking-wide">Relationship</dt>
                <dd className="mt-0.5 text-foreground">{person.relationship || "—"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Occupation</dt>
                <dd className="mt-0.5 text-foreground">{person.occupation || "—"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Student</dt>
                <dd className="mt-0.5 text-foreground">{person.is_student ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Disabled</dt>
                <dd className="mt-0.5 text-foreground">{person.is_disabled ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
