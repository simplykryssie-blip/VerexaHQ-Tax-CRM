import { z } from "zod";

// A household is a relationship group, never a client record.
export const clientTypeOptions = ["individual", "business"] as const;
export const clientStatusOptions = ["lead", "prospect", "active", "inactive", "archived"] as const;
export const CONTACT_METHODS = ["email", "phone", "sms", "address", "other"] as const;
export const CLIENT_TYPES = clientTypeOptions;
export const CLIENT_STATUSES = clientStatusOptions;
export const CLIENT_TYPE_LABELS: Record<(typeof CLIENT_TYPES)[number], string> = {
  individual: "Individual",
  business: "Business",
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
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  clientType: z.enum(clientTypeOptions),
  setupMode: z.enum(["active", "active_with_engagement"]),
  email: z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  duplicateOverrideReason: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.clientType === "individual") {
    if (!value.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: "First name is required" });
    if (!value.lastName) ctx.addIssue({ code: "custom", path: ["lastName"], message: "Last name is required" });
  }
  if (value.clientType === "business" && !value.company) {
    ctx.addIssue({ code: "custom", path: ["company"], message: "Business name is required" });
  }
});
export type CreateClientInput = z.infer<typeof createClientSchema>;
