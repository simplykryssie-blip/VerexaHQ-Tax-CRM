import { z } from "zod";

export const clientTypeOptions = ["individual", "business", "household", "organization"] as const;
export const clientStatusOptions = ["lead", "prospect", "active", "inactive", "archived"] as const;
export const CONTACT_METHODS = ["email", "phone", "sms", "address", "other"] as const;
export const CLIENT_TYPES = clientTypeOptions;
export const CLIENT_STATUSES = clientStatusOptions;
export const CLIENT_TYPE_LABELS: Record<(typeof CLIENT_TYPES)[number], string> = {
  individual: "Individual",
  business: "Business",
  household: "Household",
  organization: "Organization",
};
export const CLIENT_STATUS_LABELS: Record<(typeof CLIENT_STATUSES)[number], string> = {
  lead: "Lead",
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const optionalEmail = z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]).optional();
const lastFour = z.union([z.string().regex(/^\d{4}$/, "Enter exactly 4 digits"), z.literal("")]).optional();

export const clientSchema = z.object({
  clientType: z.enum(CLIENT_TYPES),
  status: z.enum(CLIENT_STATUSES),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  company: z.string().trim().max(200).optional(),
  personalEmail: optionalEmail,
  personalPhone: z.string().trim().max(40).optional(),
  businessEmail: optionalEmail,
  businessPhone: z.string().trim().max(40).optional(),
  preferredContactMethod: z.enum(CONTACT_METHODS).optional(),
  preferredLanguage: z.string().trim().max(20).optional(),
  dateOfBirth: z.string().optional(),
  ssnLast4: lastFour,
  einLast4: lastFour,
  source: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const createClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  clientType: z.enum(clientTypeOptions),
  status: z.enum(clientStatusOptions),
  email: z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  dateOfBirth: z.string().optional(),
  ssnLast4: lastFour,
  einLast4: lastFour,
  preferredContactMethod: z.enum(CONTACT_METHODS).optional(),
  source: z.string().trim().max(200).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
